// Accès à Groq avec choix DYNAMIQUE du modèle.
// Pourquoi : Groq retire régulièrement des modèles (llama-3.1-70b-versatile en janvier 2025,
// llama-3.3-70b-versatile et llama-3.1-8b-instant en août 2026). Un nom de modèle écrit en dur finit
// toujours par renvoyer "model_not_found". Ici on interroge /models, on choisit le meilleur modèle
// disponible, et on bascule automatiquement sur le suivant si un modèle disparaît.
//
// Forçage manuel possible via la variable d'environnement GROQ_MODEL (ex. openai/gpt-oss-120b).

const API_BASE = 'https://api.groq.com/openai/v1';

// Ordre de préférence. Remplacements recommandés par Groq pour les Llama retirés en tête.
const PREFERRED = [
  'openai/gpt-oss-120b',
  'qwen/qwen3.6-27b',
  'openai/gpt-oss-20b',
  // anciens noms : gardés en dernier recours (encore actifs pour certains comptes entreprise)
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
];

// Modèles qui ne sont pas des modèles de discussion texte
const NOT_CHAT = /(whisper|tts|orpheus|guard|safeguard|embed|playai|allam|compound|distil)/i;

const MODELS_TTL_MS = 10 * 60_000;
const DEAD_TTL_MS = 60 * 60_000;

let modelsCache: { ids: string[]; at: number } | null = null;
const deadModels = new Map<string, number>();

export type GroqMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export type GroqResult =
  | { ok: true; text: string; model: string }
  | { ok: false; error: string; status?: number; tried: string[] };

async function listModels(apiKey: string): Promise<string[] | null> {
  if (modelsCache && Date.now() - modelsCache.at < MODELS_TTL_MS) return modelsCache.ids;
  try {
    const res = await fetch(`${API_BASE}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(5000),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { data?: { id?: string }[] };
    const ids = (data.data || []).map((m) => m.id || '').filter(Boolean);
    if (ids.length === 0) return null;
    modelsCache = { ids, at: Date.now() };
    return ids;
  } catch {
    return null;
  }
}

/** Liste ordonnée des modèles à essayer. */
export async function candidateModels(apiKey: string): Promise<string[]> {
  const forced = process.env.GROQ_MODEL?.trim();
  const available = await listModels(apiKey);
  const now = Date.now();
  const alive = (id: string) => (deadModels.get(id) ?? 0) < now;

  const out: string[] = [];
  const push = (id: string) => {
    if (id && !out.includes(id) && alive(id)) out.push(id);
  };

  if (forced) push(forced);

  if (available) {
    // 1) nos préférés, dans l'ordre, s'ils sont réellement disponibles
    for (const id of PREFERRED) if (available.includes(id)) push(id);
    // 2) sinon, n'importe quel modèle texte disponible (les plus récents d'abord, 3 max)
    const others = available.filter((id) => !NOT_CHAT.test(id) && !PREFERRED.includes(id)).sort().reverse();
    for (const id of others.slice(0, 3)) push(id);
  } else {
    // /models injoignable : on tente nos préférés à l'aveugle
    for (const id of PREFERRED) push(id);
  }
  return out;
}

function stripThinking(s: string): string {
  return s.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}

type RawError = { error?: { message?: string; code?: string; type?: string } };

function isModelGone(status: number, body: RawError): boolean {
  const code = (body.error?.code || '').toLowerCase();
  const msg = (body.error?.message || '').toLowerCase();
  return (
    status === 404 ||
    code === 'model_not_found' ||
    code === 'model_decommissioned' ||
    msg.includes('decommissioned') ||
    msg.includes('does not exist') ||
    msg.includes('no longer supported')
  );
}

export async function groqChat(opts: {
  messages: GroqMessage[];
  maxTokens?: number;
  temperature?: number;
  /** Durée totale maximale (tous essais confondus) */
  budgetMs?: number;
}): Promise<GroqResult> {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) return { ok: false, error: 'GROQ_API_KEY manquante', tried: [] };

  const started = Date.now();
  const budget = opts.budgetMs ?? 20_000;
  const models = await candidateModels(apiKey);
  const tried: string[] = [];
  let lastError = 'Aucun modèle Groq disponible';
  let lastStatus: number | undefined;

  for (const model of models.slice(0, 4)) {
    const remaining = budget - (Date.now() - started);
    if (remaining < 2000) break;
    tried.push(model);

    // Les modèles "raisonneurs" dépensent des jetons à réfléchir : on leur laisse de la marge
    // et on limite l'effort de raisonnement pour garder les réponses courtes et rapides.
    const isReasoner = /gpt-oss|qwen3/i.test(model);
    const baseBody: Record<string, unknown> = {
      model,
      messages: opts.messages,
      max_tokens: isReasoner ? Math.max(opts.maxTokens ?? 300, 600) : opts.maxTokens ?? 300,
      temperature: opts.temperature ?? 0.2,
    };
    const variants: Record<string, unknown>[] = [];
    if (/gpt-oss/i.test(model)) variants.push({ ...baseBody, reasoning_effort: 'low' });
    variants.push(baseBody);

    for (const body of variants) {
      try {
        const res = await fetch(`${API_BASE}/chat/completions`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(Math.min(remaining, 15_000)),
          cache: 'no-store',
        });

        if (!res.ok) {
          const raw = await res.text();
          let parsed: RawError = {};
          try {
            parsed = JSON.parse(raw) as RawError;
          } catch {}
          lastStatus = res.status;
          lastError = `${model} → HTTP ${res.status}: ${(parsed.error?.message || raw).slice(0, 160)}`;
          console.error('[groq]', lastError);

          if (isModelGone(res.status, parsed)) {
            deadModels.set(model, Date.now() + DEAD_TTL_MS);
            modelsCache = null; // force un nouveau listing
            break; // passe au modèle suivant
          }
          // paramètre non supporté (ex. reasoning_effort) : on retente la variante suivante
          if (res.status === 400 && body !== variants[variants.length - 1]) continue;
          break; // 401/429/5xx : modèle suivant
        }

        const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
        const text = stripThinking(data.choices?.[0]?.message?.content || '');
        if (text) return { ok: true, text, model };
        lastError = `${model} → réponse vide`;
        break;
      } catch (e) {
        const err = e as { name?: string; message?: string };
        lastError = `${model} → ${err?.name === 'TimeoutError' ? 'timeout' : err?.message || 'erreur réseau'}`;
        console.error('[groq]', lastError);
        break;
      }
    }
  }
  return { ok: false, error: lastError, status: lastStatus, tried };
}

/** Diagnostic : quels modèles seraient utilisés (sans consommer de jetons). */
export async function groqStatus(): Promise<{ configured: boolean; available?: string[]; candidates: string[] }> {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) return { configured: false, candidates: [] };
  const available = (await listModels(apiKey)) || undefined;
  return { configured: true, available, candidates: await candidateModels(apiKey) };
}

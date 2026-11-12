import { LineDiff } from './html-cleaner';

const SYSTEM_PROMPT = `Tu es SCEAU Analyse. Tu reçois un diff de page web. Résume en 1 phrase (max 200 char) le changement principal. Sois factuel.`;

export async function summarizeDiff(diff: LineDiff, url: string): Promise<{ summary: string | null; error?: string; model?: string }> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return { summary: null, error: 'GROQ_API_KEY manquante' };

  const context = `URL: ${url}\nRetiré: ${diff.removed.join(' | ')}\nAjouté: ${diff.added.join(' | ')}`;

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama3-70b-8192', // Modèle stable
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: context },
        ],
        max_tokens: 100,
        temperature: 0.1,
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      const err = await res.text();
      return { summary: null, error: `Groq HTTP ${res.status} : ${err.slice(0, 100)}` };
    }

    const data = await res.json();
    const summary = data.choices?.[0]?.message?.content?.trim();
    return { summary: summary || null, model: 'llama3-70b-8192' };
  } catch (e: any) {
    return { summary: null, error: e.message };
  }
}

export function describeDiff(diff: LineDiff): string {
  return `${diff.removed.length} ligne(s) retirée(s), ${diff.added.length} ajoutée(s)`;
}

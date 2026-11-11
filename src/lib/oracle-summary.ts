// Module partagé pour résumer les changements détectés par SCEAU Archive.
// Utilisé par le Cron (scan nocturne) et par le check manuel (bouton "Vérifier").

const SYSTEM_PROMPT = `Tu es SCEAU Analyse. Tu reçois deux versions d'une même page web (avant et après modification).
Tu dois résumer en UNE SEULE PHRASE (max 200 caractères) le changement principal.

RÈGLES STRICTES :
1. Sois factuel, pas d'interprétation ni d'opinion
2. En français
3. Si plusieurs changements, résume LE PLUS IMPORTANT (prix, date, mention légale)
4. Ne dis jamais "le site a changé". Dis directement CE QUI a changé.
5. Format naturel et direct

Exemples de bonnes réponses :
- "Le tarif de l'abonnement Pro est passé de 49€ à 59€."
- "La mention 'Gratuit' a été supprimée de la page tarifs."
- "La date de mise à jour est passée du 12 au 15 novembre."
- "Une nouvelle clause sur les données personnelles a été ajoutée."`;

export async function summarizeChange(
  oldText: string,
  newText: string,
  url: string
): Promise<string | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.warn('[oracle-summary] GROQ_API_KEY manquante, résumé ignoré.');
    return null;
  }

  // Limiter pour économiser les tokens (les 3000 premiers caractères suffisent)
  const MAX_CHARS = 3000;
  const oldSnippet = oldText.slice(0, MAX_CHARS);
  const newSnippet = newText.slice(0, MAX_CHARS);

  // Si le contenu est vide, pas la peine d'appeler Groq
  if (!oldSnippet.trim() || !newSnippet.trim()) return null;

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-70b-versatile',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: `URL: ${url}\n\n=== VERSION PRÉCÉDENTE ===\n${oldSnippet}\n\n=== VERSION ACTUELLE ===\n${newSnippet}`,
          },
        ],
        max_tokens: 120,
        temperature: 0.1,
      }),
      signal: AbortSignal.timeout(8000), // 8s max pour ne pas bloquer le Cron
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('[oracle-summary] Groq error:', res.status, err.slice(0, 200));
      return null;
    }

    const data = await res.json();
    const summary = data.choices?.[0]?.message?.content?.trim();
    return summary || null;
  } catch (e: any) {
    console.error('[oracle-summary] Exception:', e?.message || e);
    return null;
  }
}

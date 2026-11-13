// Nettoyage HTML robuste : vire les menus, footers, nav, et déduplique les lignes.

export function cleanHtmlToText(html: string): string {
  // 1. Supprimer les blocs de bruit récursivement
  let cleaned = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gim, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gim, '')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gim, '')
    .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gim, '')
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gim, '')
    .replace(/<nav\b[^>]*>[\s\S]*?<\/nav>/gim, '')
    .replace(/<header\b[^>]*>[\s\S]*?<\/header>/gim, '')
    .replace(/<footer\b[^>]*>[\s\S]*?<\/footer>/gim, '')
    .replace(/<aside\b[^>]*>[\s\S]*?<\/aside>/gim, '')
    .replace(/<form\b[^>]*>[\s\S]*?<\/form>/gim, '')
    .replace(/<button\b[^>]*>[\s\S]*?<\/button>/gim, '')
    .replace(/<select\b[^>]*>[\s\S]*?<\/select>/gim, '')
    .replace(/<!--[\s\S]*?-->/g, '');

  // 2. Essayer d'extraire le main ou article en priorité
  const mainMatch =
    cleaned.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i) ||
    cleaned.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i);

  if (mainMatch && mainMatch[1].length > 300) {
    cleaned = mainMatch[1];
  }

  // 3. Convertir les balises en sauts de ligne + décoder les entités
  let text = cleaned
    .replace(/<br\s*\/?>/gim, '\n')
    .replace(/<\/(p|div|h[1-6]|li|tr|section)>/gim, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&hellip;/g, '…')
    .replace(/&laquo;/g, '«')
    .replace(/&raquo;/g, '»');

  // 4. Découper en lignes propres
  const lines = text
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter((l) => l.length > 0);

  // 5. Dédupliquer les lignes consécutives identiques
  const deduped: string[] = [];
  for (const line of lines) {
    if (deduped.length === 0 || deduped[deduped.length - 1] !== line) {
      deduped.push(line);
    }
  }

  // 6. Retirer les lignes trop courtes (bruit : "Menu", "FR", "EN", "OK")
  const filtered = deduped.filter((l) => l.length > 4);

  // 7. Dédupliquer les lignes qui reviennent plus de 3 fois (vrai bruit de nav)
  const counts = new Map<string, number>();
  for (const l of filtered) counts.set(l, (counts.get(l) || 0) + 1);
  const final = filtered.filter((l) => (counts.get(l) || 0) <= 3);

  return final.join('\n');
}

// Détecte si le contenu est réellement différent (ignore les changements de date/pub)
export function isSignificantChange(oldText: string, newText: string): boolean {
  const oldLines = new Set(oldText.split('\n').map((l) => l.trim()).filter(Boolean));
  const newLines = new Set(newText.split('\n').map((l) => l.trim()).filter(Boolean));
  let added = 0;
  let removed = 0;
  for (const l of newLines) if (!oldLines.has(l)) added++;
  for (const l of oldLines) if (!newLines.has(l)) removed++;

  // Si moins de 3 lignes changent, on regarde si un chiffre a changé (prix, date)
  let hasNumber = false;
  for (const l of newLines) if (!oldLines.has(l) && /\d/.test(l)) hasNumber = true;
  for (const l of oldLines) if (!newLines.has(l) && /\d/.test(l)) hasNumber = true;
  
  return added + removed >= 3 || hasNumber;
}

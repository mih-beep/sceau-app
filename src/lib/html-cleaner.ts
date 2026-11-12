import { parse } from 'node-html-parser';

export const CLEANER_VERSION = 2;

export type LineDiff = {
  removed: string[];
  added: string[];
};

export function cleanHtmlToText(html: string): string {
  const root = parse(html);
  
  // Suppression des scripts, styles, nav, footer, etc.
  root.querySelectorAll('script, style, noscript, iframe, svg, nav, header, footer, aside, form, button, select, .cookie-banner').forEach(el => el.remove());

  // Priorité au contenu principal
  const main = root.querySelector('main') || root.querySelector('article') || root;
  let text = main.textContent;

  // Nettoyage des lignes
  const lines = text.split('\n')
    .map(l => l.replace(/\s+/g, ' ').trim())
    .filter(l => l.length > 4 && !/^(menu|accueil|recherche|s'abonner|se connecter|fr|en)$/i.test(l));

  // Déduplication
  const deduped: string[] = [];
  for (const line of lines) {
    if (deduped.length === 0 || deduped[deduped.length - 1] !== line) {
      deduped.push(line);
    }
  }
  return deduped.join('\n');
}

// Calcule le diff ligne par ligne
export function significantDiff(oldText: string, newText: string): LineDiff {
  const oldLines = new Set(oldText.split('\n').filter(Boolean));
  const newLines = new Set(newText.split('\n').filter(Boolean));

  const removed: string[] = [];
  const added: string[] = [];

  for (const l of oldLines) if (!newLines.has(l)) removed.push(l);
  for (const l of newLines) if (!oldLines.has(l)) added.push(l);

  return { removed, added };
}

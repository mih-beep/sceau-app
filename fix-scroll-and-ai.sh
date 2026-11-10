#!/usr/bin/env bash
set -e
GREEN='\0;32m'; NC='\033[0m'
say() { echo -e "${GREEN}▶ $1${NC}"; }

# ==========================================================
# 1. CORRECTION DU SCROLL (PROFIL)
# ==========================================================
say "1/3 → Correction du scroll sur le Profil (Mobile)"

python3 - << 'PYEOF'
import sys
p = 'src/app/profil/page.tsx'
s = open(p, encoding='utf-8').read()

# On ajoute pb-32 (padding-bottom: 8rem) pour laisser de la place à la barre de navigation mobile
old_class = '<div className="p-6 max-w-2xl md:max-w-5xl mx-auto font-serif relative w-full">'
new_class = '<div className="p-6 pb-32 md:pb-6 max-w-2xl md:max-w-5xl mx-auto font-serif relative w-full">'

if old_class in s:
    s = s.replace(old_class, new_class)
    open(p, 'w', encoding='utf-8').write(s)
    print('  ✓ Padding ajouté sur la page profil')
else:
    print('  ⚠️ Pattern introuvable pour le profil')
PYEOF

# ==========================================================
# 2. CRÉATION DU MODULE IA (Gratuit avec Groq)
# ==========================================================
say "2/3 → Création du module IA (Résumé intelligent)"

cat > src/lib/ai.ts << 'EOF'
// Module d'Intelligence Artificielle pour SCEAU Archive.
// Utilise l'API gratuite de Groq (modèle Llama 3) si la clé est fournie.
// Si aucune clé n'est configurée, il renvoie un message générique.

export async function summarizeChanges(diffDetails: any[]): Promise<string | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null; // Pas de clé, l'IA est désactivée

  // On extrait uniquement les changements (ajoutés/supprimés) pour ne pas surcharger l'IA
  const changes = diffDetails
    .filter(d => d.type === 'added' || d.type === 'removed')
    .map(d => `${d.type === 'added' ? '[AJOUTÉ]' : '[SUPPRIMÉ]'} ${d.text}`)
    .join('\n')
    .slice(0, 4000); // On limite pour respecter le contexte

  if (!changes.trim()) return null;

  const prompt = `Tu es un assistant de veille B2B. Voici les modifications détectées sur un site web concurrent. 
Résume les changements en français, en 1 phrase courte, claire et professionnelle. 
Concentre-toi sur l'impact business (ex: "Le prix a augmenté", "Nouvelle fonctionnalité ajoutée"). 
Ne dis pas "Il y a des ajouts et des suppressions". Dis ce qui a CONCRÈTEMENT changé.

Voici les modifications :
${changes}

Résumé :`;

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama3-8b-8192', // Modèle gratuit ultra-rapide
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 100,
        temperature: 0.3
      })
    });

    if (!res.ok) return null;
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch (e) {
    console.warn('AI summarize error:', e);
    return null;
  }
}
EOF
print('  ✓ Module IA créé (src/lib/ai.ts)')

# ==========================================================
# 3. INTÉGRATION DE L'IA DANS LE CRON JOB ET L'UI
# ==========================================================
say "3/3 → Intégration de l'IA dans SCEAU Archive"

# A. Mise à jour du Cron Job pour inclure le résumé IA
python3 - << 'PYEOF'
import sys
p = 'src/app/api/cron/archive-scan/route.ts'
s = open(p, encoding='utf-8').read()

# Import de l'IA
if "import { summarizeChanges }" not in s:
    s = s.replace(
        "import { Resend } from 'resend';",
        "import { Resend } from 'resend';\nimport { summarizeChanges } from '@/lib/ai';"
    )

# Appel de l'IA après le calcul du diff
old_block = """          if (archive.webhook_url) {
            try {
              await fetch(archive.webhook_url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  content: `🚨 **SCEAU Archive** a détecté ${diffResult.changesCount} modifications sur : ${archive.url}\\nLien du diff : https://sceau-app.vercel.app/archive`,
                  text: `🚨 SCEAU Archive : ${diffResult.changesCount} modifications sur ${archive.url}`
                })
              });
            } catch (e) {
              console.warn('Webhook failed for', archive.url, e);
            }
          }"""

new_block = """          // Génération du résumé IA
          let aiSummary = null;
          try {
            aiSummary = await summarizeChanges(diffResult.details);
          } catch (e) {
            console.warn('AI summary failed:', e);
          }
          if (aiSummary) {
            diffResult.ai_summary = aiSummary; // On l'ajoute au JSON
          }

          if (archive.webhook_url) {
            try {
              const messageText = aiSummary 
                ? `🚨 **SCEAU Archive** : ${aiSummary}\\nLien : ${archive.url}`
                : `🚨 **SCEAU Archive** a détecté ${diffResult.changesCount} modifications sur : ${archive.url}`;
                
              await fetch(archive.webhook_url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: messageText, text: messageText })
              });
            } catch (e) {
              console.warn('Webhook failed for', archive.url, e);
            }
          }"""

if old_block in s:
    s = s.replace(old_block, new_block)
    open(p, 'w', encoding='utf-8').write(s)
    print('  ✓ Cron Job enrichi avec l\'IA')
else:
    print('  ⚠️ Bloc webhook introuvable dans le cron.')
PYEOF

# B. Mise à jour de l'UI pour afficher le résumé IA
python3 - << 'PYEOF'
import sys
p = 'src/app/archive/page.tsx'
s = open(p, encoding='utf-8').read()

# Affichage du résumé IA au-dessus du Diff dans la modale
old_modal = """            <div className="p-4 overflow-y-auto font-mono text-xs bg-gray-50">
              {selectedDiff.details?.map((line: any, i: number) => ("""

new_modal = """            <div className="p-4 overflow-y-auto font-mono text-xs bg-gray-50">
              {selectedDiff.ai_summary && (
                <div className="mb-4 bg-[#F0F6FC] border border-[#C9D8E8] p-3 rounded-lg font-sans">
                  <p className="text-[0.65rem] font-bold text-[#2D6A9E] uppercase tracking-wider mb-1">Résumé par l'Intelligence Artificielle</p>
                  <p className="text-sm text-gray-800 italic">"{selectedDiff.ai_summary}"</p>
                </div>
              )}
              {selectedDiff.details?.map((line: any, i: number) => ("""

if old_modal in s:
    s = s.replace(old_modal, new_modal)
    open(p, 'w', encoding='utf-8').write(s)
    print('  ✓ Modale Archive affiche le résumé IA')
else:
    print('  ⚠️ Modale introuvable dans Archive.')
PYEOF

say "Nettoyage du cache et build..."
rm -rf .next
npm run build

echo ""
echo -e "${GREEN}✅ Le profil défile, et l'IA est prête (il ne manque plus que ta clé gratuite) !${NC}"

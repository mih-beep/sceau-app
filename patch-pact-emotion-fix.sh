#!/usr/bin/env bash
set -e
GREEN='\0;32m'; NC='\033[0m'
say() { echo -e "${GREEN}▶ $1${NC}"; }

# ==========================================================
# 1. API Pacts Create (Sécurité pour ne pas doubler)
# ==========================================================
say "1/4 → Vérification API Pacts Create"

python3 - << 'PYEOF'
import sys
p = 'src/app/api/pacts/create/route.ts'
try:
    s = open(p, encoding='utf-8').read()
except FileNotFoundError:
    sys.exit('  ✗ Fichier introuvable')

if "const theme = data.get('theme')" not in s:
    s = s.replace(
        "const isHosted = data.get('isHosted') !== 'false';",
        "const isHosted = data.get('isHosted') !== 'false';\n    const theme = data.get('theme') || 'serieux';"
    )
    s = s.replace(
        "`INSERT INTO pacts (title, description, creator_id, group_id, required_signatures, hash, media_urls, is_hosted, category) \n         VALUES ($1, $2, $3, $4, $5, decode($6, 'base64'), $7, $8, 'Art') RETURNING id`,",
        "`INSERT INTO pacts (title, description, creator_id, group_id, required_signatures, hash, media_urls, is_hosted, category, theme) \n         VALUES ($1, $2, $3, $4, $5, decode($6, 'base64'), $7, $8, 'Art', $9) RETURNING id`,"
    )
    s = s.replace(
        "[title, description, creatorId, groupId, requiredSignatures, hash, JSON.stringify(mediaUrls), mediaUrls.length > 0]",
        "[title, description, creatorId, groupId, requiredSignatures, hash, JSON.stringify(mediaUrls), mediaUrls.length > 0, theme]"
    )
    open(p, 'w', encoding='utf-8').write(s)
    print("  ✓ API Create mise à jour")
else:
    print("  ✓ API Create déjà à jour")
PYEOF

# ==========================================================
# 2. UI Atelier (Sécurité pour ne pas doubler)
# ==========================================================
say "2/4 → Vérification Atelier (Sélecteur d'émotions)"

python3 - << 'PYEOF'
import sys
p = 'src/app/seal/page.tsx'
try:
    s = open(p, encoding='utf-8').read()
except FileNotFoundError:
    sys.exit('  ✗ Fichier introuvable')

# State du thème
if "const [pactTheme, setPactTheme] = useState" not in s:
    s = s.replace(
        "const [requiredSignatures, setRequiredSignatures] = useState(2);",
        "const [requiredSignatures, setRequiredSignatures] = useState(2);\n  const [pactTheme, setPactTheme] = useState('serieux');"
    )

# Ajout du sélecteur dans l'UI
if "L'émotion du Pacte" not in s:
    old_pact_options = """        {isPactMode && (
          <div>
            <label className="text-xs font-mono font-bold uppercase" style={{ color: 'var(--text-muted)' }}>Signatures requises</label>"""
    new_pact_options = """        {isPactMode && (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-mono font-bold uppercase block mb-2" style={{ color: 'var(--text-muted)' }}>L'émotion du Pacte</label>
              <div className="flex gap-2 flex-wrap">
                <button type="button" onClick={() => setPactTheme('serieux')} className={`p-2 rounded-xl border-2 text-2xl transition ${pactTheme === 'serieux' ? 'border-[#E76F51] bg-[#FDF4F0]' : 'border-[var(--border-color)] opacity-50'}`} title="Sérieux">🤝</button>
                <button type="button" onClick={() => setPactTheme('amour')} className={`p-2 rounded-xl border-2 text-2xl transition ${pactTheme === 'amour' ? 'border-pink-500 bg-pink-50' : 'border-[var(--border-color)] opacity-50'}`} title="Amour">❤️</button>
                <button type="button" onClick={() => setPactTheme('famille')} className={`p-2 rounded-xl border-2 text-2xl transition ${pactTheme === 'famille' ? 'border-green-500 bg-green-50' : 'border-[var(--border-color)] opacity-50'}`} title="Famille">🏡</button>
                <button type="button" onClick={() => setPactTheme('amitie')} className={`p-2 rounded-xl border-2 text-2xl transition ${pactTheme === 'amitie' ? 'border-blue-500 bg-blue-50' : 'border-[var(--border-color)] opacity-50'}`} title="Amitié">🍻</button>
              </div>
            </div>
            
            <div>
              <label className="text-xs font-mono font-bold uppercase" style={{ color: 'var(--text-muted)' }}>Signatures requises</label>"""
    if old_pact_options in s:
        s = s.replace(old_pact_options, new_pact_options)
        s = s.replace(
            """            <input type="number" min="2" value={requiredSignatures} onChange={e => setRequiredSignatures(parseInt(e.target.value) || 2)} className="w-full border-2 border-[var(--border-color)] p-2 rounded-lg text-center font-bold text-lg bg-transparent mt-1" style={{ color: 'var(--text-main)' }} />
          </div>
        )}""",
            """            <input type="number" min="2" value={requiredSignatures} onChange={e => setRequiredSignatures(parseInt(e.target.value) || 2)} className="w-full border-2 border-[var(--border-color)] p-2 rounded-lg text-center font-bold text-lg bg-transparent mt-1" style={{ color: 'var(--text-main)' }} />
          </div>
        </div>
        )}"""
        )

# Envoi du thème dans le FormData
if "formData.append('theme', pactTheme);" not in s:
    s = s.replace(
        "formData.append('required_signatures', requiredSignatures.toString());",
        "formData.append('required_signatures', requiredSignatures.toString());\n      formData.append('theme', pactTheme);"
    )

open(p, 'w', encoding='utf-8').write(s)
print("  ✓ Atelier mis à jour (Sélecteur d'émotions)")
PYEOF

# ==========================================================
# 3. PDF : Le Certificat s'adapte au thème
# ==========================================================
say "3/4 → PDF (Certificat adaptatif)"

python3 - << 'PYEOF'
import sys
p = 'src/lib/pdf.ts'
try:
    s = open(p, encoding='utf-8').read()
except FileNotFoundError:
    sys.exit('  ✗ Fichier introuvable')

if "theme: string = 'serieux'" not in s:
    s = s.replace(
        "qrCodeDataUrl: string,\n  pactId: string\n) {\n  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });\n\n  // Fond Parchemin",
        "qrCodeDataUrl: string,\n  pactId: string,\n  theme: string = 'serieux'\n) {\n  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });\n\n  // Couleurs selon le thème\n  const colors = {\n    serieux: { border: [233, 196, 106], bg: [253, 250, 245], title: [44, 24, 16], accent: [168, 134, 32] },\n    amour: { border: [244, 114, 182], bg: [253, 242, 248], title: [131, 24, 67], accent: [219, 39, 119] },\n    famille: { border: [134, 239, 172], bg: [240, 253, 244], title: [20, 83, 45], accent: [22, 163, 74] },\n    amitie: { border: [147, 197, 253], bg: [239, 246, 255], title: [30, 58, 138], accent: [37, 99, 235] },\n  };\n  const c = colors[theme as keyof typeof colors] || colors.serieux;\n\n  // Fond Parchemin"
    )
    s = s.replace(
        "doc.setFillColor(253, 250, 245);",
        "doc.setFillColor(c.bg[0], c.bg[1], c.bg[2]);"
    )
    s = s.replace(
        "doc.setDrawColor(233, 196, 106);",
        "doc.setDrawColor(c.border[0], c.border[1], c.border[2]);"
    )
    s = s.replace(
        "doc.setTextColor(168, 134, 32);",
        "doc.setTextColor(c.accent[0], c.accent[1], c.accent[2]);"
    )
    open(p, 'w', encoding='utf-8').write(s)
    print("  ✓ PDF adaptatif (Couleurs selon l'émotion)")
else:
    print("  ✓ PDF adaptatif déjà en place")
PYEOF

# ==========================================================
# 4. Message de célébration adaptatif
# ==========================================================
say "4/4 → Message de célébration adaptatif"

python3 - << 'PYEOF'
import sys
p = 'src/app/messages/page.tsx'
try:
    s = open(p, encoding='utf-8').read()
except FileNotFoundError:
    sys.exit('  ✗ Fichier introuvable')

if "Votre promesse d'amour" not in s:
    old_alert = """      if (data.isNowSealed) {
        fireConfetti();
        // On laisse un petit délai pour que les confettis tombent avant l'alerte
        setTimeout(() => alert("🤝 L'accord est scellé.\\nLa confiance est gravée dans le marbre numérique."), 500);
      }"""
    new_alert = """      if (data.isNowSealed) {
        fireConfetti();
        let message = "🤝 L'accord est scellé.\\nLa confiance est gravée dans le marbre numérique.";
        if (pact?.theme === 'amour') message = "❤️ Votre promesse d'amour est gravée pour l'éternité.";
        if (pact?.theme === 'famille') message = "🏡 Le pacte de famille est scellé. Les liens sont protégés.";
        if (pact?.theme === 'amitie') message = "🍻 Le pacte d'amitié est gravé. À la vôtre !";
        
        setTimeout(() => alert(message), 500);
      }"""
    if old_alert in s:
        s = s.replace(old_alert, new_alert)
    open(p, 'w', encoding='utf-8').write(s)
    print("  ✓ Messages adaptatifs ajoutés")
else:
    print("  ✓ Messages adaptatifs déjà en place")
PYEOF

echo ""
echo -e "${GREEN}✅ Patch émotionnel vérifié. Vérification du build...${NC}"
npm run build

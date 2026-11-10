#!/usr/bin/env bash
set -e
GREEN='\0;32m'; NC='\033[0m'
say() { echo -e "${GREEN}▶ $1${NC}"; }

# ==========================================================
# 1. MISE À JOUR DE L'API ARCHIVE (Webhook)
# ==========================================================
say "1/3 → Mise à jour de l'API Archive (Webhooks)"

python3 - << 'PYEOF'
import sys
p = 'src/app/api/archive/route.ts'
s = open(p, encoding='utf-8').read()

# On récupère le webhook_url dans le POST
s = s.replace(
    "const { pubkey, url, action } = await req.json();",
    "const { pubkey, url, action, webhook_url } = await req.json();"
)

# On l'insère dans la base de données
s = s.replace(
    """    await pool.query(`
      INSERT INTO web_archives (user_id, url, title, last_hash, last_content, last_status) 
      VALUES ($1, $2, $3, $4, $5, 'intact')
    `, [userId, url, title, newHash, cleanText]);""",
    """    await pool.query(`
      INSERT INTO web_archives (user_id, url, title, last_hash, last_content, last_status, webhook_url) 
      VALUES ($1, $2, $3, $4, $5, 'intact', $6)
    `, [userId, url, title, newHash, cleanText, webhook_url || null]);"""
)

# On renvoie aussi le webhook dans le GET
s = s.replace(
    "SELECT id, url, title, last_status, last_checked_at, created_at, diff_data",
    "SELECT id, url, title, last_status, last_checked_at, created_at, diff_data, webhook_url"
)

open(p, 'w', encoding='utf-8').write(s)
print('  ✓ API Archive mise à jour')
PYEOF

# ==========================================================
# 2. MISE À JOUR DU CRON JOB (Envoi Webhook)
# ==========================================================
say "2/3 → Mise à jour du Cron Job (Envoi des alertes)"

python3 - << 'PYEOF'
import sys
p = 'src/app/api/cron/archive-scan/route.ts'
s = open(p, encoding='utf-8').read()

# On récupère le webhook_url dans la requête du Cron
s = s.replace(
    "SELECT a.id, a.url, a.last_hash, a.last_content, u.email",
    "SELECT a.id, a.url, a.last_hash, a.last_content, a.webhook_url, u.email"
)

# On ajoute la logique d'envoi de Webhook juste après l'envoi d'email
old_email_block = """          if (resend && archive.email) {
            await resend.emails.send({
              from: 'SCEAU Archive <alerte@sceau-app.vercel.app>',
              to: archive.email,
              subject: `🚨 Modification détectée sur ${archive.url}`,
              html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                  <h2 style="color: #E76F51;">SCEAU Archive</h2>
                  <p>Une modification a été détectée sur la page que vous surveillez :</p>
                  <p><a href="${archive.url}" style="background: #eee; padding: 10px; display: block; border-radius: 8px; color: #333; text-decoration: none;">${archive.url}</a></p>
                  <p><strong>${diffResult.changesCount} changements</strong> ont été trouvés.</p>
                  <a href="https://sceau-app.vercel.app/archive" style="display: inline-block; background: #1A1513; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 20px;">Voir le Diff complet</a>
                </div>
              `
            });
          }"""

new_email_block = """          // Envoi de l'email
          if (resend && archive.email) {
            await resend.emails.send({
              from: 'SCEAU Archive <alerte@sceau-app.vercel.app>',
              to: archive.email,
              subject: `🚨 Modification détectée sur ${archive.url}`,
              html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                  <h2 style="color: #E76F51;">SCEAU Archive</h2>
                  <p>Une modification a été détectée sur la page que vous surveillez :</p>
                  <p><a href="${archive.url}" style="background: #eee; padding: 10px; display: block; border-radius: 8px; color: #333; text-decoration: none;">${archive.url}</a></p>
                  <p><strong>${diffResult.changesCount} changements</strong> ont été trouvés.</p>
                  <a href="https://sceau-app.vercel.app/archive" style="display: inline-block; background: #1A1513; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 20px;">Voir le Diff complet</a>
                </div>
              `
            }).catch(e => console.warn('Email alert failed:', e));
          }

          // Envoi du Webhook (Slack, Discord, Custom)
          if (archive.webhook_url) {
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

if old_email_block in s:
    s = s.replace(old_email_block, new_email_block)
    open(p, 'w', encoding='utf-8').write(s)
    print('  ✓ Cron Job avec Webhooks')
else:
    print('  ⚠️ Impossible de trouver le bloc email dans le cron.')
PYEOF

# ==========================================================
# 3. GÉNÉRATEUR DE RAPPORT PDF (Audit)
# ==========================================================
say "3/3 → Création du Rapport d'Audit PDF"

python3 - << 'PYEOF'
import sys
p = 'src/lib/pdf.ts'
s = open(p, encoding='utf-8').read()

pdf_function = """

export function generateArchiveReport(url: string, title: string, diffData: any, lastChecked: string) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  
  // Fond
  doc.setFillColor(249, 246, 240);
  doc.rect(0, 0, 210, 297, 'F');
  
  // Cadre
  doc.setDrawColor(231, 111, 81);
  doc.setLineWidth(1.5);
  doc.rect(10, 10, 190, 277);

  // En-tête
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.setTextColor(44, 24, 16);
  doc.text("RAPPORT D'AUDIT D'INTÉGRITÉ", 105, 30, { align: 'center' });
  
  doc.setFontSize(12);
  doc.setTextColor(122, 90, 58);
  doc.text("SCEAU Archive — Preuve de modification", 105, 40, { align: 'center' });

  // Infos
  doc.setFontSize(11);
  doc.setTextColor(44, 24, 16);
  doc.text(`Site surveillé : ${title || url}`, 20, 55);
  doc.text(`URL : ${url}`, 20, 63);
  doc.text(`Date du contrôle : ${new Date(lastChecked).toLocaleString('fr-FR')}`, 20, 71);

  // Ligne de séparation
  doc.setDrawColor(239, 224, 202);
  doc.line(20, 78, 190, 78);

  // Statut
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(219, 68, 55);
  doc.text(`STATUT : MODIFICATION DÉTECTÉE (${diffData?.changesCount || 0} changements)`, 20, 88);

  // Diff
  doc.setFont('courier', 'normal');
  doc.setFontSize(8);
  let y = 100;
  const details = diffData?.details || [];

  doc.text("DÉTAIL DES MODIFICATIONS :", 20, y);
  y += 8;

  for (const line of details) {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }

    if (line.type === 'added') {
      doc.setTextColor(63, 143, 92); // Vert
      const text = doc.splitTextToSize(`+ ${line.text}`, 160);
      doc.text(text, 20, y);
      y += text.length * 4;
    } else if (line.type === 'removed') {
      doc.setTextColor(219, 68, 55); // Rouge
      const text = doc.splitTextToSize(`- ${line.text}`, 160);
      doc.text(text, 20, y);
      y += text.length * 4;
    } else {
      doc.setTextColor(150, 150, 150); // Gris
      const text = doc.splitTextToSize(`  ${line.text}`, 160);
      doc.text(text, 20, y);
      y += text.length * 4;
    }
  }

  // Footer Preuve
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text("Document généré par SCEAU. Les empreintes SHA-256 ont été ancrées sur la blockchain.", 105, 285, { align: 'center' });

  doc.save(`Rapport-Audit-${new URL(url).hostname}.pdf`);
}
"""

if "export function generateArchiveReport" not in s:
    s += pdf_function
    open(p, 'w', encoding='utf-8').write(s)
    print('  ✓ Rapport PDF ajouté')
else:
    print('  ✓ Rapport PDF déjà présent')
PYEOF

# ==========================================================
# 4. MISE À JOUR DE L'INTERFACE (Webhook + Bouton PDF)
# ==========================================================
say "4/4 → Mise à jour de l'interface /archive"

python3 - << 'PYEOF'
import sys
p = 'src/app/archive/page.tsx'
s = open(p, encoding='utf-8').read()

# Import du générateur PDF
if "generateArchiveReport" not in s:
    s = s.replace(
        "import Link from 'next/link';",
        "import Link from 'next/link';\nimport { generateArchiveReport } from '@/lib/pdf';"
    )

# Ajout du state pour le Webhook
s = s.replace(
    "const [url, setUrl] = useState('');",
    "const [url, setUrl] = useState('');\n  const [webhookUrl, setWebhookUrl] = useState('');"
)

# Modification de la fonction handleAdd pour envoyer le webhook
s = s.replace(
    "body: JSON.stringify({ pubkey, url })",
    "body: JSON.stringify({ pubkey, url, webhook_url: webhookUrl })"
)

# Ajout du champ Webhook dans le formulaire
old_form = """        <div className="flex gap-2">
          <input 
            type="url" 
            placeholder="https://www.concurrent.com" 
            className="flex-1 border-2 border-[var(--border-color)] p-3 rounded-xl bg-transparent outline-none focus:border-[#4A90C2]"
            style={{color: 'var(--text-main)'}}
            value={url}
            onChange={e => setUrl(e.target.value)}
          />
          <button 
            onClick={handleAdd} 
            disabled={adding || (!isPro && archives.length >= limit)}
            className="bg-[#1A1513] text-white px-6 rounded-xl font-bold disabled:opacity-50 hover:bg-black transition"
          >
            {adding ? '...' : 'Sceller'}
          </button>
        </div>"""

new_form = """        <div className="flex flex-col sm:flex-row gap-2 mb-3">
          <input 
            type="url" 
            placeholder="https://www.concurrent.com" 
            className="flex-1 border-2 border-[var(--border-color)] p-3 rounded-xl bg-transparent outline-none focus:border-[#4A90C2]"
            style={{color: 'var(--text-main)'}}
            value={url}
            onChange={e => setUrl(e.target.value)}
          />
          <input 
            type="url" 
            placeholder="Webhook Slack/Discord (Optionnel)" 
            className="flex-1 border-2 border-[var(--border-color)] p-3 rounded-xl bg-transparent outline-none focus:border-[#4A90C2] text-sm"
            style={{color: 'var(--text-main)'}}
            value={webhookUrl}
            onChange={e => setWebhookUrl(e.target.value)}
          />
          <button 
            onClick={handleAdd} 
            disabled={adding || (!isPro && archives.length >= limit)}
            className="bg-[#1A1513] text-white px-6 py-3 rounded-xl font-bold disabled:opacity-50 hover:bg-black transition whitespace-nowrap"
          >
            {adding ? '...' : 'Sceller'}
          </button>
        </div>"""

if old_form in s:
    s = s.replace(old_form, new_form)

# Ajout du bouton PDF à côté de "Voir le Diff"
old_buttons = """                {a.diff_data && (
                  <button onClick={() => setSelectedDiff(a.diff_data)} className="bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-lg text-xs font-bold hover:bg-gray-50 transition shadow-sm">
                    Voir le Diff
                  </button>
                )}"""

new_buttons = """                {a.diff_data && (
                  <>
                    <button onClick={() => setSelectedDiff(a.diff_data)} className="bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-lg text-xs font-bold hover:bg-gray-50 transition shadow-sm">
                      Voir le Diff
                    </button>
                    <button onClick={() => generateArchiveReport(a.url, a.title, a.diff_data, a.last_checked_at)} className="bg-[#FDF4F0] border border-[#FCE0D6] text-[#C44A2E] px-4 py-2 rounded-lg text-xs font-bold hover:bg-[#FCE0D6] transition shadow-sm">
                      Rapport PDF
                    </button>
                  </>
                )}"""

if old_buttons in s:
    s = s.replace(old_buttons, new_buttons)

open(p, 'w', encoding='utf-8').write(s)
print('  ✓ Interface Archive mise à jour (Webhook + PDF)')
PYEOF

say "Nettoyage du cache et build..."
rm -rf .next
npm run build

echo ""
echo -e "${GREEN}✅ SCEAU Archive passe au niveau PRO (Webhooks + Rapports PDF) !${NC}"

#!/usr/bin/env bash
set -e
GREEN='\033[0;32m'; NC='\033[0m'
say() { echo -e "${GREEN}▶ $1${NC}"; }

# ==========================================================
# 1. LE CRON JOB (Scan Automatique 24h/24)
# ==========================================================
say "1/3 → Création du Cron Job (Vercel)"

mkdir -p "src/app/api/cron/archive-scan"
cat > "src/app/api/cron/archive-scan/route.ts" << 'EOF'
import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';
import { sha256 } from '@noble/hashes/sha256';
import { Resend } from 'resend';

export const runtime = 'nodejs';
export const maxDuration = 60;

function hashContent(content: string): string {
  return Buffer.from(sha256(new TextEncoder().encode(content))).toString('hex');
}

function generateDiff(oldText: string, newText: string) {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  const diff = [];
  const maxLines = Math.max(oldLines.length, newLines.length);
  let changesCount = 0;

  for (let i = 0; i < maxLines; i++) {
    const oldLine = oldLines[i] || '';
    const newLine = newLines[i] || '';
    if (oldLine !== newLine) {
      diff.push({ type: 'removed', text: oldLine.trim() });
      diff.push({ type: 'added', text: newLine.trim() });
      changesCount++;
    } else if (oldLine.trim() !== '') {
      diff.push({ type: 'unchanged', text: oldLine.trim() });
    }
  }
  return { changesCount, details: diff.slice(0, 100) };
}

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const archives = await pool.query(`
      SELECT a.id, a.url, a.last_hash, a.last_content, u.email 
      FROM web_archives a 
      JOIN users u ON a.user_id = u.id
    `);
    
    const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
    let scanned = 0;
    let modifiedCount = 0;

    for (const archive of archives.rows) {
      try {
        const res = await fetch(archive.url, { headers: { 'User-Agent': 'SCEAU-Archive-Bot/1.0' } });
        if (!res.ok) continue;
        
        const html = await res.text();
        const newText = html.replace(/<[^>]*>/g, '\n').replace(/\n\s*\n/g, '\n').trim();
        const newHash = hashContent(newText);

        if (archive.last_hash !== newHash) {
          const diffResult = generateDiff(archive.last_content || '', newText);
          
          await pool.query(
            "UPDATE web_archives SET last_status = 'modified', last_checked_at = NOW(), diff_data = $1, last_hash = $2, last_content = $3 WHERE id = $4",
            [JSON.stringify(diffResult), newHash, newText, archive.id]
          );

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
            });
          }
          modifiedCount++;
        } else {
          await pool.query(
            "UPDATE web_archives SET last_status = 'intact', last_checked_at = NOW() WHERE id = $1",
            [archive.id]
          );
        }
        scanned++;
      } catch (e) {
        console.error(`Erreur scan ${archive.url}:`, e);
      }
    }

    return NextResponse.json({ success: true, scanned, modifiedCount });
  } catch (e) {
    return NextResponse.json({ error: 'Cron Error' }, { status: 500 });
  }
}
EOF

cat > vercel.json << 'EOF'
{
  "crons": [
    {
      "path": "/api/cron/archive-scan",
      "schedule": "0 0 * * *"
    }
  ]
}
EOF
say "  ✓ Cron Job configuré pour tourner tous les jours à 00:00"

# ==========================================================
# 2. L'EXTENSION CHROME
# ==========================================================
say "2/3 → Création de l'Extension Chrome"

mkdir -p "public/downloads/chrome-extension"

cat > "public/downloads/chrome-extension/manifest.json" << 'EOF'
{
  "manifest_version": 3,
  "name": "SCEAU Archive - Sceller cette page",
  "version": "1.0",
  "description": "Scellez n'importe quelle page web sur la blockchain Bitcoin en 1 clic.",
  "action": {
    "default_popup": "popup.html",
    "default_title": "Sceller avec SCEAU"
  },
  "permissions": ["activeTab"]
}
EOF

cat > "public/downloads/chrome-extension/popup.html" << 'EOF'
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <style>
    body { width: 300px; padding: 16px; font-family: system-ui, sans-serif; text-align: center; background: #F9F6F0; margin: 0; }
    h2 { font-family: serif; color: #1A1513; margin-top: 0; font-size: 20px; }
    p { font-size: 12px; color: #666; line-height: 1.4; }
    input { width: 100%; box-sizing: border-box; padding: 8px; margin-bottom: 12px; border: 1px solid #ccc; border-radius: 6px; font-size: 12px; }
    button { width: 100%; background: #E76F51; color: white; border: none; padding: 10px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 14px; }
    button:hover { background: #C75A22; }
    #status { margin-top: 12px; font-size: 12px; font-weight: bold; color: green; display: none; }
  </style>
</head>
<body>
  <h2>SCEAU Archive</h2>
  <p>Entrez votre clé publique (pubkey) pour lier cette action à votre compte.</p>
  <input type="text" id="pubkey" placeholder="Votre Pubkey (base64)" />
  <button id="sealBtn">Sceller cette page</button>
  <div id="status">✅ Page envoyée à SCEAU !</div>
  <script src="popup.js"></script>
</body>
</html>
EOF

cat > "public/downloads/chrome-extension/popup.js" << 'EOF'
document.addEventListener('DOMContentLoaded', () => {
  const pubkeyInput = document.getElementById('pubkey');
  const sealBtn = document.getElementById('sealBtn');
  const status = document.getElementById('status');

  chrome.storage.local.get(['sceau_pubkey'], (result) => {
    if (result.sceau_pubkey) pubkeyInput.value = result.sceau_pubkey;
  });

  sealBtn.addEventListener('click', async () => {
    const pubkey = pubkeyInput.value.trim();
    if (!pubkey) return alert("Veuillez entrer votre clé publique.");

    chrome.storage.local.set({ sceau_pubkey: pubkey });
    sealBtn.innerText = 'Envoi en cours...';

    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const url = tabs[0].url;
      
      try {
        const res = await fetch('https://sceau-app.vercel.app/api/archive', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pubkey, url })
        });
        
        if (res.ok) {
          sealBtn.style.display = 'none';
          status.style.display = 'block';
        } else {
          const d = await res.json();
          alert("Erreur : " + d.error);
          sealBtn.innerText = 'Sceller cette page';
        }
      } catch (e) {
        alert("Erreur réseau. Vérifiez votre connexion.");
        sealBtn.innerText = 'Sceller cette page';
      }
    });
  });
});
EOF

cd public/downloads
zip -q -r sceau-extension.zip chrome-extension
cd ../..
say "  ✓ Extension Chrome générée et zippée"

# ==========================================================
# 3. AJOUT DU BOUTON DE TÉLÉCHARGEMENT DANS L'UI
# ==========================================================
say "3/3 → Ajout du bouton Extension dans la page Archive"

python3 - << 'PYEOF'
p = 'src/app/archive/page.tsx'
s = open(p, encoding='utf-8').read()

old_ui = """        <div>
          <h1 className="text-3xl font-bold font-serif mb-2" style={{color: 'var(--text-main)'}}>SCEAU Archive</h1>
          <p className="text-sm text-[var(--text-muted)]">Surveillez l'intégrité des sites web. Détectez les modifications en un clic.</p>
        </div>"""

new_ui = """        <div>
          <h1 className="text-3xl font-bold font-serif mb-2" style={{color: 'var(--text-main)'}}>SCEAU Archive</h1>
          <p className="text-sm text-[var(--text-muted)]">Surveillez l'intégrité des sites web. Détectez les modifications en un clic.</p>
        </div>
        <a href="/downloads/sceau-extension.zip" download className="bg-white border-2 border-gray-200 text-gray-800 px-4 py-2 rounded-xl font-bold text-xs hover:border-[#E76F51] transition shadow-sm hidden md:block">
          Télécharger l'Extension Chrome
        </a>"""

if old_ui in s:
    s = s.replace(old_ui, new_ui)
    open(p, 'w', encoding='utf-8').write(s)
    print('  ✓ Bouton Extension ajouté à la page')
PYEOF

say "4/4 → Nettoyage et Build"
rm -rf .next
npm run build

echo ""
echo -e "${GREEN}✅ SCEAU Archive est 100% autonome !${NC}"

#!/usr/bin/env bash
set -e
GREEN='\033[0;32m'; NC='\033[0m'
say() { echo -e "${GREEN}▶ $1${NC}"; }

# ==========================================================
# 1. Le Moteur Backend (Signature et Ancrage)
# ==========================================================
say "1/3 → Moteur Backend (api/pacts/sign)"

mkdir -p "src/app/api/pacts/sign"
cat > "src/app/api/pacts/sign/route.ts" << 'EOF'
import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';
import { sha256 } from '@noble/hashes/sha256';
import { submitToOts } from '@/lib/ots';
import { apiError } from '@/lib/api-error';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req: Request) {
  const { pact_id, pubkey } = await req.json();
  
  try {
    const user = await pool.query("SELECT id, handle FROM users WHERE encode(pubkey, 'base64') = $1", [pubkey]);
    if (user.rows.length === 0) return NextResponse.json({ error: 'Inconnu' }, { status: 401 });
    const userId = user.rows[0].id;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Vérifier si le pacte existe et n'est pas déjà scellé
      const pactRes = await client.query(
        "SELECT title, description, required_signatures, status FROM pacts WHERE id = $1 FOR UPDATE",
        [pact_id]
      );
      if (pactRes.rows.length === 0) throw new Error('Pacte introuvable');
      const pact = pactRes.rows[0];
      if (pact.status === 'scelle') throw new Error('Ce pacte est déjà scellé');

      // 2. Ajouter la signature (si pas déjà fait)
      await client.query(
        "INSERT INTO pact_signatures (pact_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [pact_id, userId]
      );

      // 3. Récupérer toutes les signatures actuelles
      const sigsRes = await client.query(
        `SELECT u.handle, s.created_at FROM pact_signatures s 
         JOIN users u ON s.user_id = u.id
         WHERE s.pact_id = $1 ORDER BY s.created_at ASC`,
        [pact_id]
      );
      const signatures = sigsRes.rows;

      let isNowSealed = false;

      // 4. Si on a atteint le quota, on scelle cryptographiquement
      if (signatures.length >= pact.required_signatures) {
        // Construction d'un JSON canonique (l'ordre est crucial)
        const canonical = JSON.stringify({
          title: pact.title,
          description: pact.description || '',
          signers: signatures.map((s: any) => ({
            handle: s.handle,
            signed_at: new Date(s.created_at).toISOString()
          }))
        });

        // Hash du contrat
        const pactHash = sha256(new TextEncoder().encode(canonical));
        const hashBase64 = Buffer.from(pactHash).toString('base64');

        // Ancrage Bitcoin
        let otsProof: string | null = null;
        try {
          const ots = await submitToOts(new Uint8Array(pactHash));
          if (ots.ok && ots.proof) otsProof = ots.proof.toString('base64');
        } catch (e) { console.warn('[Pact OTS]', e); }

        // Mise à jour de la DB
        await client.query(
          `UPDATE pacts SET status = 'scelle', scelle_at = NOW(), hash = decode($1, 'base64'), ots_proof = $2 WHERE id = $3`,
          [hashBase64, otsProof, pact_id]
        );
        isNowSealed = true;
      }

      await client.query('COMMIT');
      return NextResponse.json({ 
        success: true, 
        current: signatures.length, 
        required: pact.required_signatures,
        isNowSealed 
      });

    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (e: any) {
    return apiError(e, e.message || 'Erreur lors de la signature');
  }
}
EOF

# ==========================================================
# 2. L'Interface du Pacte (Modal)
# ==========================================================
say "2/3 → Interface du Pacte (messages/page.tsx)"

python3 - << 'PYEOF'
import sys
p = 'src/app/messages/page.tsx'
try:
    s = open(p, encoding='utf-8').read()
except FileNotFoundError:
    sys.exit('  ✗ Fichier messages/page.tsx introuvable')

# On remplace l'intégralité du composant PactModal à la fin du fichier
start_idx = s.find("function PactModal(")
if start_idx == -1:
    sys.exit('  ✗ Impossible de trouver le composant PactModal')

new_pact_modal = r"""function PactModal({ pactId, onClose }: { pactId: string; onClose: () => void }) {
  const [pact, setPact] = useState<any>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  
  const loadPact = () => fetch(`/api/pacts/${pactId}`).then(r => r.json()).then(d => setPact(d));
  useEffect(() => { loadPact(); }, [pactId]);

  async function signPact() {
    const pubkey = localStorage.getItem('sceau_pubkey');
    if (!pubkey) return alert("Connecte-toi.");
    
    setIsSigning(true);
    const res = await fetch('/api/pacts/sign', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pact_id: pactId, pubkey }) });
    const data = await res.json();
    
    if (data.success) {
      if (data.isNowSealed) {
        alert("🎉 Le pacte est complet ! Il a été gravé sur Bitcoin pour l'éternité.");
      }
      loadPact();
    } else {
      alert(data.error);
    }
    setIsSigning(false);
  }

  async function downloadCertificate() {
    if (!pact) return;
    setIsDownloading(true);
    const verifyUrl = `${window.location.origin}/o/${pact.id}`;
    const qrDataUrl = await QRCode.toDataURL(verifyUrl, { width: 300, margin: 1 });
    generatePactCertificate(
      pact.title, pact.description, pact.creator, pact.signataires || [], 
      pact.hash_str || 'Hash en cours de calcul', qrDataUrl, pact.id
    );
    setIsDownloading(false);
  }

  if (!pact) return null;
  const myHandle = localStorage.getItem('sceau_handle');
  const hasSigned = pact.signataires?.includes(myHandle);
  const isSealed = pact.status === 'scelle';
  const progress = Math.min(100, ((pact.signataires?.length || 0) / pact.required_signatures) * 100);

  return (
    <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4 backdrop-blur-md">
      <div className={`bg-[#FDF8F0] w-full max-w-md rounded-3xl p-8 border-4 shadow-2xl relative max-h-[90vh] overflow-y-auto ${isSealed ? 'border-[#E9C46A]' : 'border-[#4A90C2]'}`}>
        
        {isSealed && (
          <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-[#E9C46A] text-[#2C1810] px-6 py-1 rounded-full text-xs font-bold tracking-widest shadow-md border-2 border-white">
            🔒 Contrat Scellé sur Bitcoin
          </div>
        )}

        <div className="text-center mb-6">
          <div className="text-5xl mb-3">{isSealed ? '🏆' : '🤝'}</div>
          <h2 className="text-3xl font-serif font-bold text-[#2C1810]">{pact.title}</h2>
          <p className="text-xs font-mono text-[#A88620] italic mt-2">Proposé par @{pact.creator}</p>
        </div>

        <div className="bg-white/50 border border-[#EFE0CA] rounded-xl p-4 mb-6">
          <p className="italic text-sm text-center text-gray-700">"{pact.description}"</p>
        </div>

        {/* Barre de progression */}
        <div className="mb-6">
          <div className="flex justify-between text-xs font-bold text-gray-500 mb-1">
            <span>Signatures</span>
            <span>{pact.signataires?.length || 0} / {pact.required_signatures}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
            <div className={`h-2 rounded-full ${isSealed ? 'bg-[#E9C46A]' : 'bg-[#4A90C2]'}`} style={{ width: `${progress}%` }}></div>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {(pact.signataires || []).map((s: string) => (
              <span key={s} className="bg-[#F5F9EE] text-[#5D7A3A] border border-[#A8C77E] px-3 py-1 rounded-lg text-sm font-bold shadow-sm">✅ @{s}</span>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2 mt-8">
          {isSealed ? (
            <>
              <div className="bg-[#F5F9EE] border border-[#A8C77E] p-3 rounded-xl text-center mb-2">
                <p className="text-xs text-[#5D7A3A] font-bold">Empreinte du contrat (SHA-256) :</p>
                <p className="text-[0.6rem] font-mono text-[#7A9B5A] break-all mt-1">{pact.hash_str}</p>
              </div>
              <button onClick={downloadCertificate} disabled={isDownloading} className="w-full bg-gradient-to-r from-[#E9C46A] to-[#F4A261] text-[#2C1810] py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition flex justify-center items-center gap-2">
                {isDownloading ? 'Génération...' : '📜 Télécharger le Certificat PDF'}
              </button>
            </>
          ) : (
            <button onClick={signPact} disabled={hasSigned || isSigning} className="w-full bg-[#4A90C2] text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:bg-[#2D6A9E] transition disabled:opacity-50">
              {isSigning ? 'Signature...' : hasSigned ? '✅ Vous avez signé' : '✍️ Contresigner le Pacte'}
            </button>
          )}
          <button onClick={onClose} className="w-full py-2 font-bold opacity-50 hover:opacity-100 transition text-[#2C1810]">Fermer</button>
        </div>
      </div>
    </div>
  );
}

export default function Messages() {
  return (
    <Suspense fallback={<div className="p-10 text-center font-mono">Chargement...</div>}>
      <MessagesInner />
    </Suspense>
  );
}
"""

s = s[:start_idx] + new_pact_modal
open(p, 'w', encoding='utf-8').write(s)
print('  ✓ Modal Pacte professionnel injecté.')
PYEOF

# ==========================================================
# 3. Mise à jour de l'API GET du Pacte
# ==========================================================
say "3/3 → Mise à jour de l'API GET (Récupérer le hash)"

cat > "src/app/api/pacts/[id]/route.ts" << 'EOF'
import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const pact = await pool.query(`
      SELECT p.id, p.title, p.description, p.required_signatures, p.status, p.created_at, 
             u.handle as creator, 
             encode(p.hash, 'base64') as hash_str
      FROM pacts p JOIN users u ON p.creator_id = u.id 
      WHERE p.id = $1
    `, [id]);
    
    if (pact.rows.length === 0) return NextResponse.json({ error: 'Introuvable' }, { status: 404 });

    const signatures = await pool.query(
      "SELECT u.handle FROM pact_signatures s JOIN users u ON s.user_id = u.id WHERE s.pact_id = $1 ORDER BY s.created_at ASC", 
      [id]
    );
    
    return NextResponse.json({ 
      ...pact.rows[0], 
      signataires: signatures.rows.map(r => r.handle) 
    });
  } catch (e) {
    return NextResponse.json({ error: 'Erreur' }, { status: 500 });
  }
}
EOF

echo ""
echo -e "${GREEN}✅ Pactes prêts pour le test. Vérification du build...${NC}"
npm run build

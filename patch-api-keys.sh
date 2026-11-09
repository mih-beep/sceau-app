#!/usr/bin/env bash
set -e
GREEN='\0;32m'; NC='\033[0m'
say() { echo -e "${GREEN}▶ $1${NC}"; }

# ==========================================================
# 1. API : Génération et listing des clés
# ==========================================================
say "1/3 → API /api/auth/api-keys (Génération et Lecture)"

mkdir -p "src/app/api/auth/api-keys"
cat > "src/app/api/auth/api-keys/route.ts" << 'EOF'
import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';
import crypto from 'crypto';

// GET : Lister les clés de l'utilisateur (masquées)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const pubkey = searchParams.get('pubkey');
  if (!pubkey) return NextResponse.json({ error: 'Clé manquante' }, { status: 400 });

  try {
    const user = await pool.query("SELECT id FROM users WHERE encode(pubkey, 'base64') = $1", [pubkey]);
    if (user.rows.length === 0) return NextResponse.json({ error: 'Inconnu' }, { status: 401 });

    const result = await pool.query(
      "SELECT id, name, created_at, last_used_at FROM api_keys WHERE user_id = $1 ORDER BY created_at DESC",
      [user.rows[0].id]
    );
    return NextResponse.json({ keys: result.rows });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Erreur' }, { status: 500 });
  }
}

// POST : Générer une nouvelle clé
export async function POST(req: Request) {
  const { pubkey, name } = await req.json();
  if (!pubkey || !name) return NextResponse.json({ error: 'Champs manquants' }, { status: 400 });

  try {
    const user = await pool.query("SELECT id FROM users WHERE encode(pubkey, 'base64') = $1", [pubkey]);
    if (user.rows.length === 0) return NextResponse.json({ error: 'Inconnu' }, { status: 401 });

    // Générer une clé aléatoire (sceau_live_ + 32 caractères hexadécimaux)
    const rawKey = `sceau_live_${crypto.randomBytes(16).toString('hex')}`;
    
    // On ne stocke que le hash SHA-256 de la clé en base de données
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

    await pool.query(
      "INSERT INTO api_keys (user_id, key_hash, name) VALUES ($1, $2, $3)",
      [user.rows[0].id, keyHash, name]
    );

    // On retourne la clé EN CLAIR une seule fois. Elle ne sera plus jamais visible.
    return NextResponse.json({ success: true, key: rawKey });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Erreur' }, { status: 500 });
  }
}
EOF

# ==========================================================
# 2. API : Route pour les plugins (WordPress / GitHub)
# ==========================================================
say "2/3 → API /api/v1/plugin/seal (Le point d'entrée des plugins)"

mkdir -p "src/app/api/v1/plugin/seal"
cat > "src/app/api/v1/plugin/seal/route.ts" << 'EOF'
import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';
import crypto from 'crypto';
import { sha256 } from '@noble/hashes/sha256';
import { submitToOts } from '@/lib/ots';

export const runtime = 'nodejs';
export const maxDuration = 30;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(req: Request) {
  try {
    const { apiKey, title, content, category } = await req.json();

    if (!apiKey || !title || !content) {
      return NextResponse.json({ error: 'Champs manquants (apiKey, title, content)' }, { status: 400, headers: CORS });
    }

    // 1. Vérifier la clé API
    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
    const keyQuery = await pool.query(
      "SELECT user_id FROM api_keys WHERE key_hash = $1",
      [keyHash]
    );

    if (keyQuery.rows.length === 0) {
      return NextResponse.json({ error: 'Clé API invalide' }, { status: 401, headers: CORS });
    }

    const userId = keyQuery.rows[0].user_id;

    // Mettre à jour la date de dernière utilisation
    await pool.query("UPDATE api_keys SET last_used_at = NOW() WHERE key_hash = $1", [keyHash]);

    // 2. Calculer le hash du contenu (texte)
    const textBuffer = Buffer.from(content, 'utf-8');
    const hashBytes = sha256(new Uint8Array(textBuffer));
    const hashB64 = Buffer.from(hashBytes).toString('base64');

    // 3. Ancrage OpenTimestamps (best effort)
    let otsProof: string | null = null;
    try {
      const ots = await submitToOts(new Uint8Array(hashBytes));
      if (ots.ok && ots.proof) {
        otsProof = ots.proof.toString('base64');
      }
    } catch (e) { console.warn('[Plugin OTS]', e); }

    // 4. Enregistrer le sceau
    const result = await pool.query(
      `INSERT INTO seals (
        hash, timestamp, author_id, title, description, is_public, visibility,
        is_hosted, file_path, file_size, is_flash, is_mystery, unlock_likes, is_ephemeral,
        ots_proof, ots_submitted_at, category
      ) VALUES (
        decode($1, 'base64'), NOW(), $2, $3, '', true, 'public',
        false, null, 0, false, false, 0, false,
        $4, $5, $6
      ) RETURNING id`,
      [hashB64, userId, title, otsProof, otsProof ? new Date() : null, category || 'Art']
    );

    return NextResponse.json({
      success: true,
      seal_id: result.rows[0].id,
      hash: hashB64,
      ots_secured: otsProof !== null
    }, { headers: CORS });

  } catch (e) {
    console.error('[plugin/seal]', e);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500, headers: CORS });
  }
}
EOF

# ==========================================================
# 3. UI : Ajout de la section "Clés API" dans les Paramètres
# ==========================================================
say "3/3 → UI Paramètres (Gestion des clés API)"

python3 - << 'PYEOF'
import sys
p = 'src/app/settings/page.tsx'
try:
    s = open(p, encoding='utf-8').read()
except FileNotFoundError:
    sys.exit('  ✗ Fichier settings/page.tsx introuvable')

# Ajout des states
old_states = "const [pubkey, setPubkey] = useState('');"
new_states = """const [pubkey, setPubkey] = useState('');
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [newKeyName, setNewKeyName] = useState('');
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [isGeneratingKey, setIsGeneratingKey] = useState(false);"""
if old_states in s:
    s = s.replace(old_states, new_states)

# Fonction de chargement et de génération
old_load = """  function logout() {
    localStorage.clear();
    router.push('/login');
  }"""
new_load = """  async function loadApiKeys() {
    if (!pubkey) return;
    const res = await fetch(`/api/auth/api-keys?pubkey=${encodeURIComponent(pubkey)}`);
    if (res.ok) {
      const d = await res.json();
      setApiKeys(d.keys || []);
    }
  }

  useEffect(() => {
    if (pubkey) loadApiKeys();
  }, [pubkey]);

  async function generateApiKey() {
    if (!newKeyName.trim()) return alert("Donne un nom à ta clé (ex: WordPress, GitHub)");
    setIsGeneratingKey(true);
    const res = await fetch('/api/auth/api-keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pubkey, name: newKeyName })
    });
    const data = await res.json();
    if (res.ok) {
      setGeneratedKey(data.key);
      setNewKeyName('');
      loadApiKeys();
    } else {
      alert('Erreur: ' + data.error);
    }
    setIsGeneratingKey(false);
  }

  function logout() {
    localStorage.clear();
    router.push('/login');
  }"""
if old_load in s:
    s = s.replace(old_load, new_load)

# Ajout de la section UI avant la Zone Sensible
old_ui = """        <div className="bg-[#FDF4F0] p-6 rounded-2xl border border-[#D64545]">
          <h2 className="text-lg font-bold mb-2 text-[#A02E2E]">⚠️ Zone sensible</h2>"""

new_ui = """        <div className="bg-[#F0F6FC] p-6 rounded-2xl border border-[#C9D8E8]">
          <h2 className="text-lg font-bold mb-2 text-[#2D6A9E]">🔌 Clés API (Développeurs & Plugins)</h2>
          <p className="text-xs text-[#2D6A9E] mb-4 italic">Générez une clé pour connecter SCEAU à votre site WordPress, GitHub ou une application externe.</p>

          {generatedKey && (
            <div className="bg-[#FFFCF7] border border-[#E9C46A] p-4 rounded-xl mb-4">
              <p className="text-xs font-bold text-[#A88620] mb-1">⚠️ Copiez cette clé maintenant, elle ne sera plus jamais affichée :</p>
              <div className="flex gap-2">
                <code className="flex-1 bg-[var(--bg-main)] p-2 rounded text-xs break-all border border-[var(--border-color)]">{generatedKey}</code>
                <button onClick={() => { navigator.clipboard.writeText(generatedKey); alert('Copié !'); }} className="bg-[#E9C46A] text-white px-3 rounded font-bold text-xs">Copier</button>
              </div>
              <button onClick={() => setGeneratedKey(null)} className="text-xs text-[#A88620] font-bold mt-2 underline">J'ai copié la clé, la fermer.</button>
            </div>
          )}

          <div className="flex gap-2 mb-4">
            <input 
              type="text" 
              placeholder="Nom (ex: Mon site WordPress)" 
              className="flex-1 border-2 border-[#C9D8E8] p-2 rounded-xl bg-white focus:border-[#4A90C2] outline-none text-sm" 
              value={newKeyName} 
              onChange={e => setNewKeyName(e.target.value)} 
            />
            <button 
              onClick={generateApiKey} 
              disabled={isGeneratingKey}
              className="bg-[#4A90C2] text-white px-4 py-2 rounded-xl font-bold text-sm shadow-md disabled:opacity-50"
            >
              {isGeneratingKey ? '...' : 'Générer'}
            </button>
          </div>

          {apiKeys.length > 0 && (
            <div className="space-y-2 mt-4 border-t border-[#C9D8E8] pt-4">
              <p className="text-xs font-bold text-[#2D6A9E] mb-2">Vos clés actives :</p>
              {apiKeys.map(k => (
                <div key={k.id} className="flex justify-between items-center bg-white p-2 rounded-lg border border-[#C9D8E8] text-xs">
                  <span className="font-bold">{k.name}</span>
                  <span className="text-[#8A7A72]">
                    {k.last_used_at ? `Utilisée le ${new Date(k.last_used_at).toLocaleDateString('fr-FR')}` : 'Jamais utilisée'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-[#FDF4F0] p-6 rounded-2xl border border-[#D64545]">
          <h2 className="text-lg font-bold mb-2 text-[#A02E2E]">⚠️ Zone sensible</h2>"""

if old_ui in s:
    s = s.replace(old_ui, new_ui)
else:
    print('  ⚠️ Impossible de trouver la Zone sensible pour insérer les Clés API.')

open(p, 'w', encoding='utf-8').write(s)
print('  ✓ UI Paramètres mise à jour avec les Clés API.')
PYEOF

echo ""
echo -e "${GREEN}✅ L'infrastructure des Clés API est prête.${NC}"

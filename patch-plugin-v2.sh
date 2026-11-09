#!/usr/bin/env bash
set -e
GREEN='\0;32m'; NC='\033[0m'
say() { echo -e "${GREEN}▶ $1${NC}"; }

# ==========================================================
# 1. Mise à jour de l'API Plugin (Audit et Sécurité)
# ==========================================================
say "1/4 → Mise à jour API Plugin (Audit)"

python3 - << 'PYEOF'
import sys
p = 'src/app/api/v1/plugin/seal/route.ts'
try:
    s = open(p, encoding='utf-8').read()
except FileNotFoundError:
    sys.exit('  ✗ Fichier introuvable')

# 1. Accepter author_meta
s = s.replace(
    "const { apiKey, title, content, category } = await req.json();",
    "const { apiKey, title, content, category, author_meta } = await req.json();"
)

# 2. Ajouter author_meta dans la description
s = s.replace(
    "description, is_public, visibility,",
    "description, is_public, visibility,"
)
# Modification de la requête SQL pour injecter author_meta dans la description
old_insert = """    const result = await pool.query(
      `INSERT INTO seals (
        hash, timestamp, author_id, title, description, is_public, visibility,
        is_hosted, file_path, file_size, is_flash, is_mystery, unlock_likes, is_ephemeral,
        ots_proof, ots_submitted_at, category
      ) VALUES (
        decode($1, 'base64'), NOW(), $2, $3, $4, true, 'public',
        false, null, 0, false, false, 0, false,
        $5, $6, $7
      ) RETURNING id`,
      [hashB64, userId, title, description, otsProof, otsProof ? new Date() : null, category || 'Art']
    );"""

new_insert = """    // On ajoute l'auteur WP dans la description pour l'audit
    const fullDescription = author_meta ? `Publié via SCEAU Plugin par : ${author_meta}` : '';

    const result = await pool.query(
      `INSERT INTO seals (
        hash, timestamp, author_id, title, description, is_public, visibility,
        is_hosted, file_path, file_size, is_flash, is_mystery, unlock_likes, is_ephemeral,
        ots_proof, ots_submitted_at, category
      ) VALUES (
        decode($1, 'base64'), NOW(), $2, $3, $4, true, 'public',
        false, null, 0, false, false, 0, false,
        $5, $6, $7
      ) RETURNING id`,
      [hashB64, userId, title, fullDescription, otsProof, otsProof ? new Date() : null, category || 'Art']
    );"""
if old_insert in s:
    s = s.replace(old_insert, new_insert)

open(p, 'w', encoding='utf-8').write(s)
print('  ✓ API Plugin mise à jour (author_meta)')
PYEOF

# ==========================================================
# 2. Mise à jour du fichier PHP WordPress
# ==========================================================
say "2/4 → Mise à jour du Plugin WordPress (Non-bloquant)"

cat > public/downloads/sceau-plugin.php << 'EOF'
<?php
/**
 * Plugin Name: SCEAU - Preuve d'Antériorité
 * Description: Scelle automatiquement vos articles sur la blockchain Bitcoin à chaque publication.
 * Version: 1.1
 * Author: SCEAU
 */

if (!defined('ABSPATH')) { exit; }

add_action('admin_menu', 'sceau_add_admin_menu');
function sceau_add_admin_menu() {
    add_options_page('SCEAU Réglages', 'SCEAU', 'manage_options', 'sceau', 'sceau_settings_page');
}

add_action('admin_init', 'sceau_register_settings');
function sceau_register_settings() {
    register_setting('sceau_settings_group', 'sceau_api_key');
}

function sceau_settings_page() {
    ?>
    <div class="wrap">
        <h2>Configuration de SCEAU</h2>
        <p>Entrez votre clé API générée sur <a href="https://sceau-app.vercel.app/settings" target="_blank">votre profil SCEAU</a>.</p>
        <form method="post" action="options.php">
            <?php settings_fields('sceau_settings_group'); ?>
            <?php do_settings_sections('sceau_settings_group'); ?>
            <table class="form-table">
                <tr valign="top">
                <th scope="row">Clé API SCEAU</th>
                <td>
                    <input type="password" name="sceau_api_key" value="<?php echo esc_attr(get_option('sceau_api_key')); ?>" style="width: 100%; max-width: 400px;" placeholder="sceau_live_..." />
                </td>
                </tr>
            </table>
            <?php submit_button(); ?>
        </form>
    </div>
    <?php
}

// Scellement à la publication
add_action('transition_post_status', 'sceau_seal_on_publish', 10, 3);
function sceau_seal_on_publish($new_status, $old_status, $post) {
    if ($new_status === 'publish' && $old_status !== 'publish' && $post->post_type === 'post') {
        
        $api_key = get_option('sceau_api_key');
        if (!$api_key) return;

        // Récupérer l'auteur WordPress pour l'audit
        $author = get_userdata($post->post_author);
        $author_name = $author ? $author->user_login : 'Inconnu';

        $title = $post->post_title;
        $content = strip_tags($post->post_content);

        // 'blocking' => false empêche WordPress de planter si SCEAU est lent/hs
        wp_remote_post('https://sceau-app.vercel.app/api/v1/plugin/seal', array(
            'method'    => 'POST',
            'timeout'   => 2, // Timeout très court
            'blocking'  => false, // On ne bloque pas WordPress
            'headers'   => array('Content-Type' => 'application/json'),
            'body'      => wp_json_encode(array(
                'apiKey'      => $api_key,
                'title'       => $title,
                'content'     => $content,
                'category'    => 'Écrit',
                'author_meta' => $author_name // On envoie l'employé
            ))
        ));

        // On met quand même à jour la métadonnée localement (optimiste)
        update_post_meta($post->ID, 'sceau_sealed', 'true');
    }
}

// Badge
add_filter('the_content', 'sceau_append_badge');
function sceau_append_badge($content) {
    if (is_single() && get_post_meta(get_the_ID(), 'sceau_sealed', true) === 'true') {
        $badge = '<div style="margin-top: 30px; padding: 15px; background: #F5F9EE; border: 1px solid #A8C77E; border-radius: 8px; text-align: center; font-family: sans-serif;">';
        $badge .= '<span style="color: #5D7A3A; font-weight: bold;">✅ Scellé par SCEAU</span><br>';
        $badge .= '<span style="font-size: 12px; color: #7A9B5A;">Ce contenu a été horodaté sur Bitcoin.</span>';
        $badge .= '</div>';
        return $content . $badge;
    }
    return $content;
}
EOF

cd public/downloads
zip -q -r sceau-wordpress.zip sceau-plugin.php
cd ../..
say "  ✓ Plugin WordPress v1.1 mis à jour."

# ==========================================================
# 3. Route DELETE pour révoquer les clés API (Cas 3)
# ==========================================================
say "3/4 → Ajout de la route DELETE (Révoquer clé)"

python3 - << 'PYEOF'
import sys
p = 'src/app/api/auth/api-keys/route.ts'
try:
    s = open(p, encoding='utf-8').read()
except FileNotFoundError:
    sys.exit('  ✗ Fichier introuvable')

# Ajouter la méthode DELETE à la fin du fichier
delete_method = """
// DELETE : Révoquer une clé
export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const pubkey = searchParams.get('pubkey');
  const id = searchParams.get('id');

  if (!pubkey || !id) return NextResponse.json({ error: 'Champs manquants' }, { status: 400 });

  try {
    const user = await pool.query("SELECT id FROM users WHERE encode(pubkey, 'base64') = $1", [pubkey]);
    if (user.rows.length === 0) return NextResponse.json({ error: 'Inconnu' }, { status: 401 });

    await pool.query("DELETE FROM api_keys WHERE id = $1 AND user_id = $2", [id, user.rows[0].id]);
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: 'Erreur' }, { status: 500 });
  }
}
"""
if "export async function DELETE" not in s:
    s += delete_method

open(p, 'w', encoding='utf-8').write(s)
print('  ✓ Route DELETE ajoutée')
PYEOF

# ==========================================================
# 4. UI Settings (Bouton Révoquer)
# ==========================================================
say "4/4 → Ajout du bouton Révoquer dans les Paramètres"

python3 - << 'PYEOF'
import sys
p = 'src/app/settings/page.tsx'
try:
    s = open(p, encoding='utf-8').read()
except FileNotFoundError:
    sys.exit('  ✗ Fichier introuvable')

# Fonction delete
old_load = """  function logout() {"""
new_load = """  async function revokeApiKey(id: string) {
    if (!confirm('Voulez-vous vraiment révoquer cette clé ? Les plugins qui l\\'utilisent cesseront de fonctionner.')) return;
    const res = await fetch(`/api/auth/api-keys?pubkey=${encodeURIComponent(pubkey)}&id=${id}`, { method: 'DELETE' });
    if (res.ok) loadApiKeys();
    else alert('Erreur lors de la révocation');
  }

  function logout() {"""
if old_load in s:
    s = s.replace(old_load, new_load)

# Bouton dans la liste
old_list = """                <div key={k.id} className="flex justify-between items-center bg-white p-2 rounded-lg border border-[#C9D8E8] text-xs">
                  <span className="font-bold">{k.name}</span>
                  <span className="text-[#8A7A72]">
                    {k.last_used_at ? `Utilisée le ${new Date(k.last_used_at).toLocaleDateString('fr-FR')}` : 'Jamais utilisée'}
                  </span>
                </div>"""

new_list = """                <div key={k.id} className="flex justify-between items-center bg-white p-2 rounded-lg border border-[#C9D8E8] text-xs">
                  <span className="font-bold">{k.name}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-[#8A7A72]">
                      {k.last_used_at ? `Utilisée le ${new Date(k.last_used_at).toLocaleDateString('fr-FR')}` : 'Jamais utilisée'}
                    </span>
                    <button onClick={() => revokeApiKey(k.id)} className="text-red-400 hover:text-red-600 font-bold" title="Révoquer">✕</button>
                  </div>
                </div>"""
if old_list in s:
    s = s.replace(old_list, new_list)

open(p, 'w', encoding='utf-8').write(s)
print('  ✓ Bouton Révoquer ajouté')
PYEOF

echo ""
echo -e "${GREEN}✅ Plugin et Sécurité prêts pour les Pros.${NC}"

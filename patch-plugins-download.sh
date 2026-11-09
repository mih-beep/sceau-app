#!/usr/bin/env bash
set -e
GREEN='\0;32m'; NC='\033[0m'
say() { echo -e "${GREEN}▶ $1${NC}"; }

# ==========================================================
# 1. Création du Plugin WordPress
# ==========================================================
say "1/3 → Création du fichier sceau-plugin.php"

mkdir -p public/downloads
cat > public/downloads/sceau-plugin.php << 'EOF'
<?php
/**
 * Plugin Name: SCEAU - Preuve d'Antériorité
 * Description: Scelle automatiquement vos articles sur la blockchain Bitcoin à chaque publication.
 * Version: 1.0
 * Author: SCEAU
 */

// Sécurité : Empêche l'accès direct au fichier
if (!defined('ABSPATH')) {
    exit;
}

// Ajouter la page de réglages dans le menu
add_action('admin_menu', 'sceau_add_admin_menu');
function sceau_add_admin_menu() {
    add_options_page(
        'SCEAU Réglages',
        'SCEAU',
        'manage_options',
        'sceau',
        'sceau_settings_page'
    );
}

// Enregistrer la clé API
add_action('admin_init', 'sceau_register_settings');
function sceau_register_settings() {
    register_setting('sceau_settings_group', 'sceau_api_key');
}

// Affichage de la page de réglages
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

// Fonction qui envoie le scellement à SCEAU à la publication
add_action('transition_post_status', 'sceau_seal_on_publish', 10, 3);
function sceau_seal_on_publish($new_status, $old_status, $post) {
    // On ne scelle que si l'article passe à "publié"
    if ($new_status === 'publish' && $old_status !== 'publish' && $post->post_type === 'post') {
        
        $api_key = get_option('sceau_api_key');
        if (!$api_key) return;

        $title = $post->post_title;
        $content = strip_tags($post->post_content);
        $category = 'Écrit'; // On pourrait récupérer la catégorie WP

        $response = wp_remote_post('https://sceau-app.vercel.app/api/v1/plugin/seal', array(
            'method'    => 'POST',
            'timeout'   => 15,
            'headers'   => array('Content-Type' => 'application/json'),
            'body'      => wp_json_encode(array(
                'apiKey'   => $api_key,
                'title'    => $title,
                'content'  => $content,
                'category' => $category
            ))
        ));

        if (is_wp_error($response)) {
            error_log('SCEAU Erreur : ' . $response->get_error_message());
        } else {
            $body = wp_remote_retrieve_body($response);
            $data = json_decode($body, true);
            if (isset($data['success']) && $data['success']) {
                // On ajoute un marqueur dans les métadonnées de l'article pour dire qu'il est scellé
                update_post_meta($post->ID, 'sceau_sealed', 'true');
                update_post_meta($post->ID, 'sceau_id', $data['seal_id']);
            }
        }
    }
}

// Ajoute le badge "Scellé par SCEAU" à la fin de l'article
add_filter('the_content', 'sceau_append_badge');
function sceau_append_badge($content) {
    if (is_single() && get_post_meta(get_the_ID(), 'sceau_sealed', true) === 'true') {
        $seal_id = get_post_meta(get_the_ID(), 'sceau_id', true);
        $badge = '<div style="margin-top: 30px; padding: 15px; background: #F5F9EE; border: 1px solid #A8C77E; border-radius: 8px; text-align: center; font-family: sans-serif;">';
        $badge .= '<span style="color: #5D7A3A; font-weight: bold;">✅ Scellé par SCEAU</span><br>';
        $badge .= '<span style="font-size: 12px; color: #7A9B5A;">Ce contenu a été horodaté et ancré sur Bitcoin.</span><br>';
        $badge .= '<a href="https://sceau-app.vercel.app/o/' . esc_attr($seal_id) . '" target="_blank" style="font-size: 12px; color: #E76F51; font-weight: bold; text-decoration: none;">Voir la preuve</a>';
        $badge .= '</div>';
        return $content . $badge;
    }
    return $content;
}
EOF

# Créer un ZIP pour faciliter l'installation
cd public/downloads
zip sceau-wordpress.zip sceau-plugin.php
cd ../..
say "  ✓ Plugin WordPress créé et zippé."

# ==========================================================
# 2. Création de la GitHub Action
# ==========================================================
say "2/3 → Création du fichier sceau-github-action.yml"

cat > public/downloads/sceau-github-action.yml << 'EOF'
name: "SCEAU - Ancrage de Preuve"
on:
  push:
    branches: [ "main", "master" ]

jobs:
  sceau_seal:
    runs-on: ubuntu-latest
    steps:
      - name: Envoi du commit à SCEAU
        run: |
          COMMIT_MSG=$(git log -1 --pretty=%B)
          COMMIT_SHA=$(git rev-parse --short HEAD)
          
          curl -X POST https://sceau-app.vercel.app/api/v1/plugin/seal \
            -H "Content-Type: application/json" \
            -d '{
              "apiKey": "'"${{ secrets.SCEAU_API_KEY }}"'",
              "title": "Code commit '"$COMMIT_SHA"'",
              "content": "'"$COMMIT_MSG"'",
              "category": "Code"
            }'
EOF
say "  ✓ GitHub Action créée."

# ==========================================================
# 3. Mise à jour de l'UI Paramètres
# ==========================================================
say "3/3 → Mise à jour UI Paramètres (Boutons de téléchargement)"

python3 - << 'PYEOF'
import sys
p = 'src/app/settings/page.tsx'
try:
    s = open(p, encoding='utf-8').read()
except FileNotFoundError:
    sys.exit('  ✗ Fichier settings/page.tsx introuvable')

# Ajout de la section "Télécharger les plugins" à la fin de la section API Keys
old_ui = """          {apiKeys.length > 0 && (
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
        </div>"""

new_ui = """          {apiKeys.length > 0 && (
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

          <div className="mt-6 pt-6 border-t border-[#C9D8E8]">
            <h3 className="text-sm font-bold text-[#2D6A9E] mb-3">📦 Télécharger les Plugins (SCEAU Pro)</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <a href="/downloads/sceau-wordpress.zip" download className="flex items-center justify-center gap-2 bg-[#2D6A9E] text-white py-2 rounded-lg font-bold text-sm shadow hover:bg-[#1E507A] transition">
                <span>🔌</span> Plugin WordPress
              </a>
              <a href="/downloads/sceau-github-action.yml" download className="flex items-center justify-center gap-2 bg-[#2C1810] text-white py-2 rounded-lg font-bold text-sm shadow hover:bg-black transition">
                <span>🐙</span> GitHub Action (YML)
              </a>
            </div>
            <p className="text-[0.65rem] text-[#2D6A9E] mt-2 italic text-center">Installez le plugin et collez-y votre clé API.</p>
          </div>
        </div>"""

if old_ui in s:
    s = s.replace(old_ui, new_ui)
else:
    print('  ⚠️ Impossible de trouver le bloc des clés API.')

open(p, 'w', encoding='utf-8').write(s)
print('  ✓ UI Paramètres mise à jour avec les liens de téléchargement.')
PYEOF

echo ""
echo -e "${GREEN}✅ Tout est prêt. Les plugins sont téléchargeables depuis SCEAU.${NC}"

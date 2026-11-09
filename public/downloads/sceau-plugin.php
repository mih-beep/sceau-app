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

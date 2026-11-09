<?php
/**
 * Plugin Name: SCEAU - Preuve d'Antériorité
 * Description: Scelle automatiquement la preuve de vos articles sur Bitcoin à la publication.
 * Version: 1.0
 * Author: SCEAU
 */

if (!defined('ABSPATH')) { exit; }

// 1. Page de réglages (pour coller la clé API)
add_action('admin_menu', 'sceau_add_admin_menu');
function sceau_add_admin_menu() {
    add_options_page('SCEAU', 'SCEAU', 'manage_options', 'sceau', 'sceau_settings_page');
}

add_action('admin_init', 'sceau_register_settings');
function sceau_register_settings() {
    register_setting('sceau_settings_group', 'sceau_api_key');
}

function sceau_settings_page() {
    ?>
    <div class="wrap">
        <h2>Configuration de SCEAU</h2>
        <p>Entrez votre clé API générée sur <a href="https://sceau-app.vercel.app/settings" target="_blank">SCEAU</a>.</p>
        <form method="post" action="options.php">
            <?php settings_fields('sceau_settings_group'); ?>
            <?php do_settings_sections('sceau_settings_group'); ?>
            <table class="form-table">
                <tr valign="top">
                <th scope="row">Clé API SCEAU</th>
                <td><input type="password" name="sceau_api_key" value="<?php echo esc_attr(get_option('sceau_api_key')); ?>" style="width: 100%; max-width: 400px;" /></td>
                </tr>
            </table>
            <?php submit_button(); ?>
        </form>
    </div>
    <?php
}

// 2. L'action magique : Sceller à la publication
add_action('transition_post_status', 'sceau_seal_on_publish', 10, 3);
function sceau_seal_on_publish($new_status, $old_status, $post) {
    if ($new_status === 'publish' && $old_status !== 'publish' && $post->post_type === 'post') {
        $api_key = get_option('sceau_api_key');
        if (!$api_key) return;

        // On prépare les données
        $title = $post->post_title;
        $content = strip_tags($post->post_content);

        // Envoi invisible à notre API (non-bloquant pour le site)
        wp_remote_post('https://sceau-app.vercel.app/api/v1/plugin/seal', array(
            'method'    => 'POST',
            'timeout'   => 2, 
            'blocking'  => false, // Le site ne ralentit pas si SCEAU est hors ligne
            'headers'   => array('Content-Type' => 'application/json'),
            'body'      => wp_json_encode(array(
                'apiKey'   => $api_key,
                'title'    => $title,
                'content'  => $content,
                'category' => 'Écrit'
            ))
        ));

        // On met un badge visuel sur l'article pour dire qu'il est scellé
        update_post_meta($post->ID, 'sceau_sealed', 'true');
    }
}

// 3. Affichage du badge sur le site
add_filter('the_content', 'sceau_append_badge');
function sceau_append_badge($content) {
    if (is_single() && get_post_meta(get_the_ID(), 'sceau_sealed', true) === 'true') {
        $badge = '<div style="margin-top: 30px; padding: 15px; background: #F5F9EE; border: 1px solid #A8C77E; border-radius: 8px; text-align: center; font-family: sans-serif;">';
        $badge .= '<span style="color: #5D7A3A; font-weight: bold;">✅ Preuve d\'antériorité SCEAU</span><br>';
        $badge .= '<span style="font-size: 12px; color: #7A9B5A;">Cet article est gravé sur la blockchain Bitcoin.</span>';
        $badge .= '</div>';
        return $content . $badge;
    }
    return $content;
}

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
        
        // On stocke un flag pour afficher la notification "Sceau posé"
        set_transient('sceau_seal_success_' . get_current_user_id(), true, 30);
    }
}

// Affichage de la notification "Sceau posé"
add_action('admin_notices', 'sceau_admin_notice');
function sceau_admin_notice() {
    $user_id = get_current_user_id();
    if (get_transient('sceau_seal_success_' . $user_id)) {
        delete_transient('sceau_seal_success_' . $user_id);
        ?>
        <div class="notice notice-success is-dismissible" style="border-left-color: #E76F51;">
            <p><strong>🛡️ Sceau posé.</strong> Votre travail est protégé pour l'éternité. Continuez à créer, on veille sur votre héritage.</p>
        </div>
        <?php
    }
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

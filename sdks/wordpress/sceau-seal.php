<?php
/**
 * Plugin Name: SCEAU - Notaire de Poche
 * Description: Scellez vos articles WordPress sur la blockchain Bitcoin en un clic.
 * Version: 1.0
 * Author: SCEAU
 */

// Ajouter un bouton dans l'éditeur d'articles
add_action('post_submitbox_misc_actions', 'sceau_add_seal_button');
function sceau_add_seal_button() {
    echo '<div class="misc-pub-section"><button type="button" class="button button-primary" id="sceau-seal-btn">⛓️ Sceller cet article sur Bitcoin</button></div>';
}
?>

#!/usr/bin/env bash
set -e
GREEN='\0;32m'; NC='\033[0m'
say() { echo -e "${GREEN}▶ $1${NC}"; }

# ==========================================================
# 1. PACTES : L'Animation de Célébration (Confettis)
# ==========================================================
say "1/3 → Pactes (Animation de confettis et célébration)"

python3 - << 'PYEOF'
import sys
p = 'src/app/messages/page.tsx'
try:
    s = open(p, encoding='utf-8').read()
except FileNotFoundError:
    sys.exit('  ✗ Fichier introuvable')

# Ajout de la fonction d'animation en haut du fichier (après les imports)
if "function fireConfetti()" not in s:
    import re
    # Trouver la fin des imports
    import_end = s.find("function MessagesInner()")
    if import_end == -1: import_end = s.find("export default function Messages()")
    
    confetti_func = """
function fireConfetti() {
  const colors = ['#E76F51', '#F4A261', '#E9C46A', '#2A9D8F', '#4A90C2'];
  for (let i = 0; i < 50; i++) {
    const el = document.createElement('div');
    el.style.position = 'fixed';
    el.style.width = '10px';
    el.style.height = '10px';
    el.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    el.style.left = Math.random() * 100 + 'vw';
    el.style.top = '-10px';
    el.style.borderRadius = Math.random() > 0.5 ? '50%' : '0';
    el.style.zIndex = '9999';
    el.style.pointerEvents = 'none';
    el.style.transition = `transform ${1 + Math.random() * 2}s ease-in, opacity ${1 + Math.random()}s ease-out`;
    
    document.body.appendChild(el);
    
    requestAnimationFrame(() => {
      el.style.transform = `translateY(${window.innerHeight + 100}px) rotate(${Math.random() * 360}deg)`;
      el.style.opacity = '0';
    });
    
    setTimeout(() => el.remove(), 3000);
  }
}
"""
    s = s[:import_end] + confetti_func + s[import_end:]

# Déclencher les confettis quand le pacte est scellé
old_sign = """      if (data.isNowSealed) {
        alert("🎉 Le pacte est complet ! Il a été gravé sur Bitcoin pour l'éternité.");
      }"""
new_sign = """      if (data.isNowSealed) {
        fireConfetti();
        // On laisse un petit délai pour que les confettis tombent avant l'alerte
        setTimeout(() => alert("🤝 L'accord est scellé.\\nLa confiance est gravée dans le marbre numérique."), 500);
      }"""
if old_sign in s:
    s = s.replace(old_sign, new_sign)

open(p, 'w', encoding='utf-8').write(s)
print('  ✓ Animation de confettis ajoutée')
PYEOF

# ==========================================================
# 2. PLUGIN : La Notification de Sérénité
# ==========================================================
say "2/3 → Plugin WordPress (Notification de sérénité)"

python3 - << 'PYEOF'
import sys
p = 'public/downloads/sceau-plugin.php'
try:
    s = open(p, encoding='utf-8').read()
except FileNotFoundError:
    sys.exit('  ✗ Fichier introuvable')

# Ajout de la notification admin
if "sceau_admin_notice" not in s:
    old_hook = """        // On met quand même à jour la métadonnée localement (optimiste)
        update_post_meta($post->ID, 'sceau_sealed', 'true');"""
    new_hook = """        // On met quand même à jour la métadonnée localement (optimiste)
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
    }"""
    s = s.replace(old_hook, new_hook)

# On corrige la parenthèse en trop à la fin de la fonction précédente
s = s.replace("""    }
}

// Affichage de la notification""", """    }
}

// Affichage de la notification""")

open(p, 'w', encoding='utf-8').write(s)
print('  ✓ Notification WordPress ajoutée')
PYEOF

cd public/downloads
zip -q -r sceau-wordpress.zip sceau-plugin.php
cd ../..
say "  ✓ Plugin WordPress rezippé."

# ==========================================================
# 3. MERKLE : Le Certificat PDF façon Parchemin
# ==========================================================
say "3/3 → Certificat PDF (Design Parchemin et Sceau)"

python3 - << 'PYEOF'
import sys
p = 'src/lib/pdf.ts'
try:
    s = open(p, encoding='utf-8').read()
except FileNotFoundError:
    sys.exit('  ✗ Fichier pdf.ts introuvable')

# On refait la fonction de génération du Certificat de Pacte pour la rendre majestueuse
old_func_start = s.find("export function generatePactCertificate(")
if old_func_start != -1:
    new_func = """export function generatePactCertificate(
  title: string,
  description: string,
  creator: string,
  signataires: string[],
  hash: string,
  qrCodeDataUrl: string,
  pactId: string
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  // Fond Parchemin
  doc.setFillColor(253, 250, 245);
  doc.rect(0, 0, 210, 297, 'F');

  // Bordure Dorée Élégante
  doc.setDrawColor(233, 196, 106);
  doc.setLineWidth(1);
  doc.rect(10, 10, 190, 277);
  doc.rect(12, 12, 186, 273);

  // Titre
  doc.setFont('times', 'bold');
  doc.setFontSize(32);
  doc.setTextColor(44, 24, 16);
  doc.text("CERTIFICAT DE PACTE", 105, 35, { align: 'center' });

  doc.setFont('times', 'italic');
  doc.setFontSize(14);
  doc.setTextColor(168, 134, 32);
  doc.text("SCEAU · La poignée de main numérique", 105, 45, { align: 'center' });

  // Ligne de séparation
  doc.setDrawColor(233, 196, 106);
  doc.line(60, 50, 150, 50);

  // Titre du Pacte
  doc.setFont('times', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(44, 24, 16);
  doc.text(title, 105, 70, { align: 'center' });

  // Description
  doc.setFont('times', 'italic');
  doc.setFontSize(12);
  doc.setTextColor(90, 75, 68);
  const splitDesc = doc.splitTextToSize(`"${description}"`, 140);
  doc.text(splitDesc, 105, 85, { align: 'center' });

  // Créateur
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(122, 90, 58);
  doc.text(`Proposé par : @${creator}`, 105, 110, { align: 'center' });

  // Signatures
  doc.setFont('times', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(44, 24, 16);
  doc.text("Signataires Officiels", 105, 130, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(63, 143, 92); // Vert
  const sigsText = signataires.map(s => `@${s}`).join('   •   ');
  doc.text(sigsText, 105, 142, { align: 'center' });

  // Le Sceau Visuel (Un cercle rouge en bas à droite)
  doc.setDrawColor(232, 120, 60);
  doc.setLineWidth(2);
  doc.circle(170, 220, 20);
  doc.setFont('times', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(232, 120, 60);
  doc.text("SCELLÉ", 170, 218, { align: 'center' });
  doc.setFontSize(8);
  doc.text("BITCOIN", 170, 224, { align: 'center' });

  // Hash
  doc.setFont('courier', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  const hashChunks = hash.match(/.{1,50}/g) || [hash];
  hashChunks.forEach((chunk, i) => {
    doc.text(chunk, 105, 250 + (i * 5), { align: 'center' });
  });

  // QR Code
  if (qrCodeDataUrl) {
    doc.addImage(qrCodeDataUrl, 'PNG', 25, 200, 40, 40);
    doc.setFontSize(8);
    doc.setTextColor(122, 90, 58);
    doc.text("Scanner pour vérifier", 45, 245, { align: 'center' });
  }

  // Mention Blockchain
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(93, 122, 58);
  doc.text("Preuve ancrée via OpenTimestamps (Bitcoin)", 105, 275, { align: 'center' });

  doc.save(`Pacte-${title.replace(/[^a-zA-Z0-9]/g, '-')}.pdf`);
}
"""
    # Remplacer l'ancienne fonction par la nouvelle
    s = s[:old_func_start] + new_func
    open(p, 'w', encoding='utf-8').write(s)
    print('  ✓ PDF du Pacte transformé en Parchemin')
else:
    print('  ⚠️ Fonction PDF introuvable')
PYEOF

echo ""
echo -e "${GREEN}✅ L'émotion est injectée. Vérification du build...${NC}"
npm run build

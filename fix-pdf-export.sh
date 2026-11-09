#!/usr/bin/env bash
set -e
GREEN='\0;32m'; NC='\033[0m'
say() { echo -e "${GREEN}▶ $1${NC}"; }

say "1/2 → Vérification et ajout de generateProjectCertificate"

python3 - << 'PYEOF'
import sys
p = 'src/lib/pdf.ts'
try:
    s = open(p, encoding='utf-8').read()
except FileNotFoundError:
    sys.exit('  ✗ Fichier introuvable')

if "export function generateProjectCertificate" in s:
    print("  ✓ La fonction existe déjà. Vérification OK.")
else:
    print("  ⚠️ Fonction manquante, ajout en cours...")
    pdf_function = """

export function generateProjectCertificate(title: string, author: string, merkleRoot: string, files: any[], date: string) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  
  // Fond
  doc.setFillColor(253, 248, 240);
  doc.rect(0, 0, 210, 297, 'F');
  
  // Cadre
  doc.setDrawColor(232, 120, 60);
  doc.setLineWidth(2);
  doc.rect(10, 10, 190, 277);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.setTextColor(44, 24, 16);
  doc.text("CERTIFICAT D'INTÉGRITÉ", 105, 30, { align: 'center' });
  
  doc.setFontSize(12);
  doc.setTextColor(122, 90, 58);
  doc.text("Dossier Miroir (Arbre de Merkle)", 105, 40, { align: 'center' });

  doc.setFontSize(14);
  doc.setTextColor(44, 24, 16);
  doc.text(`Projet : ${title}`, 20, 55);
  doc.text(`Créateur : @${author}`, 20, 63);
  doc.text(`Date de scellement : ${new Date(date).toLocaleString('fr-FR')}`, 20, 71);

  doc.setFont('courier', 'bold');
  doc.setFontSize(9);
  doc.text("EMPREINTE RACINE (MERKLE ROOT) :", 20, 85);
  
  const chunks = merkleRoot.match(/.{1,50}/g) || [merkleRoot];
  doc.setFont('courier', 'normal');
  chunks.forEach((chunk, i) => {
    doc.text(chunk, 20, 91 + i * 5);
  });

  // Liste des fichiers
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text("FICHIERS INCLUS :", 20, 115);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  let y = 122;
  files.slice(0, 30).forEach((f) => {
    if (y > 270) return; // Limite de page
    doc.text(`- ${f.file_name}`, 20, y);
    doc.text(`  Hash: ${f.file_hash.slice(0, 20)}...`, 25, y + 4);
    y += 10;
  });

  if (files.length > 30) {
    doc.text(`... et ${files.length - 30} autres fichiers.`, 20, y + 5);
  }

  doc.save(`Projet-${title.replace(/[^a-zA-Z0-9]/g, '-')}.pdf`);
}
"""
    s += pdf_function
    open(p, 'w', encoding='utf-8').write(s)
    print("  ✓ Fonction ajoutée avec succès.")
PYEOF

say "2/2 → Vérification du build"
npm run build

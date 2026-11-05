#!/bin/bash
OUTPUT="dossier_complet_pour_ia.txt"
echo "Génération du fichier de code..." > $OUTPUT
find src public *.json *.ts *.mjs *.css *.env* -type f ! -path "*/node_modules/*" ! -path "*/.next/*" ! -name "package-lock.json" | while read file; do
  echo -e "\n\n=========================================\nFICHIER : $file\n=========================================\n" >> $OUTPUT
  cat "$file" >> $OUTPUT
done
echo "✅ Fichier '$OUTPUT' généré avec succès !"

#!/usr/bin/env bash
find . -type f \
  -not -path './node_modules/*' \
  -not -path './.next/*' \
  -not -path './.git/*' \
  -not -path './.vercel/*' \
  -not -path './out/*' \
  -not -path './build/*' \
  -not -path './.turbo/*' \
  -not -name '.env' \
  -not -name '.env.*' \
  -not -name '*.env' \
  -not -name '*.env.*' \
  -not -name 'package-lock.json' \
  -not -name '*.log' \
  -not -name 'sceau_full.txt' \
  -not -name '*.zip' \
  -not -name '*.ico' \
  -not -name '*.png' \
  -not -name '*.jpg' \
  -not -name '*.svg' \
  | sort | while read -r f; do
    echo ""
    echo "========================================="
    echo "FICHIER : $f"
    echo "========================================="
    echo ""
    cat "$f"
  done > sceau_full_code.txt

echo "✅ Généré : sceau_full_code.txt"
wc -l sceau_full_code.txt

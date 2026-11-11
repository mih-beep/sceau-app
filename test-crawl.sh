#!/bin/bash

echo "=================================================="
echo "🕷️ TEST DE CRAWL (Exploration de liens)"
echo "=================================================="

read -p "🌐 Colle l'URL d'un site à explorer (ex: https://lemonde.fr) : " TARGET_URL

echo ""
echo "📡 Téléchargement de la page d'accueil..."
HTML=$(curl -s -L -A "SCEAU-Bot/1.0" "$TARGET_URL")

if [ -z "$HTML" ]; then
    echo "❌ Impossible de récupérer la page."
    exit 1
fi

echo "✅ Page récupérée. Taille : $(echo -n "$HTML" | wc -c) octets."
echo ""

# Extraction basique des liens (comme le fait ton code extractInternalLinks)
echo "🔍 Analyse des liens internes..."
LINKS=$(echo "$HTML" | grep -oE 'href="[^"]+"' | sed 's/href="//;s/"//' | grep -v "^#" | grep -v "mailto:" | grep -v "javascript:")

# Filtrage pour ne garder que les liens du même domaine (approximatif)
DOMAIN=$(echo "$TARGET_URL" | sed -E 's|https?://([^/]+).*|\1|')
INTERNAL_LINKS=$(echo "$LINKS" | grep "$DOMAIN" | sort -u)

TOTAL_LINKS=$(echo "$INTERNAL_LINKS" | grep -c .)

echo "--------------------------------------------------"
echo "📊 RÉSULTAT :"
echo "--------------------------------------------------"
echo "🔗 Liens internes uniques trouvés sur la page d'accueil : $TOTAL_LINKS"
echo ""

if [ "$TOTAL_LINKS" -gt 10 ]; then
    echo "🚨 ALERTE : Ton code actuel (MAX_PAGES = 10) ne surveille que 10 de ces $TOTAL_LINKS pages !"
    echo "👉 C'est exactement pour ça qu'on doit implémenter le Crawl Exhaustif."
else
    echo "✅ Le site a peu de liens, mais le crawl reste nécessaire pour explorer la profondeur."
fi

echo ""
echo "Voici les 10 premiers liens que ton code actuel rate :"
echo "$INTERNAL_LINKS" | head -n 10 | while read -r line; do
    echo "  ❌ $line"
done

echo ""
echo "=================================================="

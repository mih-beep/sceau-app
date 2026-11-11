#!/bin/bash

API_URL="https://sceau-app.vercel.app/api/oracle/ask"

echo "=================================================="
echo "🔍 TEST FINAL DE SCEAU ORACLE SUR VERCEL"
echo "=================================================="

read -p "🔑 Colle ta PUBKEY SCEAU (depuis la console navigateur) : " PUBKEY

if [ ${#PUBKEY} -lt 20 ]; then
    echo "❌ La clé semble trop courte."
    exit 1
fi

echo ""
echo "📡 Interrogation de : https://www.lemonde.fr"
echo "❓ Question : Quels sont les titres des articles à la une ?"
echo "⏳ Attente de la réponse... (max 30s)"
echo ""

# On lance la requête avec un timeout de 30 secondes (limite Vercel)
RESPONSE=$(curl -s --max-time 30 -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d "{\"pubkey\": \"$PUBKEY\", \"url\": \"https://www.lemonde.fr\", \"question\": \"Quels sont les titres des articles à la une ?\"}")

echo "📥 Réponse brute :"
echo "--------------------------------------------------"
echo "$RESPONSE"
echo "--------------------------------------------------"

if echo "$RESPONSE" | grep -q '"error"'; then
    echo ""
    echo "❌ L'API Vercel a renvoyé une erreur. Détails ci-dessus."
    echo "👉 Vérifie que GROQ_API_KEY est bien sur Vercel (avec la NOUVELLE clé)."
elif echo "$RESPONSE" | grep -q '"answer"'; then
    echo ""
    echo "✅ SUCCÈS TOTAL ! L'Oracle a répondu en production."
    echo "--------------------------------------------------"
    if command -v jq &> /dev/null; then
        echo "🤖 Réponse de l'IA :"
        echo "$RESPONSE" | jq -r '.answer'
        echo ""
        echo "🔒 Preuves utilisées :"
        echo "$RESPONSE" | jq -r '.sources[] | "• Date : \(.date) | Hash : \(.hash_short)"'
    else
        echo "👉 Installe 'jq' avec 'sudo apt install jq' pour un affichage plus joli."
    fi
else
    echo ""
    echo "⚠️ Réponse inattendue. Regarde le JSON ci-dessus."
fi

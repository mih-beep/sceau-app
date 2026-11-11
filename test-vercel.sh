#!/bin/bash

# L'URL de ton app déployée sur Vercel
API_URL="https://sceau-app.vercel.app/api/oracle/ask"

read -p "🔑 Colle ta PUBKEY SCEAU : " PUBKEY

if [ ${#PUBKEY} -lt 20 ]; then
    echo "❌ La clé semble trop courte."
    exit 1
fi

echo ""
echo "=================================================="
echo "🔍 TEST SCEAU ORACLE — SUR VERCEL"
echo "=================================================="
echo "🌐 URL : $API_URL"
echo ""

RESPONSE=$(curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d "{\"pubkey\": \"$PUBKEY\", \"url\": \"https://www.lemonde.fr\", \"question\": \"Quels sont les titres des articles à la une ?\"}")

echo "📥 Réponse brute reçue :"
echo "--------------------------------------------------"
echo "$RESPONSE"
echo "--------------------------------------------------"

if echo "$RESPONSE" | grep -q '"error"'; then
    echo ""
    echo "❌ L'API Vercel a renvoyé une erreur."
    echo "👉 C'est probablement la même erreur qu'en local : le problème vient de GROQ."
else
    echo ""
    echo "✅ L'Oracle Vercel fonctionne !"
fi

#!/bin/bash

# On demande la clé publique à l'utilisateur si elle n'est pas passée en argument
if [ -z "$1" ]; then
    read -p "🔑 Colle ta PUBKEY SCEAU (depuis la console navigateur) : " PUBKEY
else
    PUBKEY="$1"
fi

# Vérification basique
if [ ${#PUBKEY} -lt 20 ]; then
    echo "❌ La clé semble trop courte. Vérifie ton copier-coller."
    exit 1
fi

API_URL="http://localhost:3000/api/oracle/ask"
TARGET_URL="https://www.lemonde.fr" 
QUESTION="Quels sont les titres des articles à la une aujourd'hui ?"

echo "=================================================="
echo "🔍 TEST DE SCEAU ORACLE"
echo "=================================================="

echo "📡 Envoi de la requête à l'API..."
RESPONSE=$(curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d "{\"pubkey\": \"$PUBKEY\", \"url\": \"$TARGET_URL\", \"question\": \"$QUESTION\"}")

echo "📥 Réponse brute reçue :"
echo "$RESPONSE"
echo ""

if echo "$RESPONSE" | grep -q '"error"'; then
    echo "❌ ÉCHEC : L'API a renvoyé une erreur."
    echo "👉 Vérifie le terminal où 'npm run dev' tourne."
    echo "👉 Vérifie que GROQ_API_KEY est bien dans .env.local"
    echo "👉 Vérifie que ta PUBKEY existe dans ta base de données (onglet Profil)."
else
    echo "✅ SUCCÈS ! L'Oracle a répondu."
    if command -v jq &> /dev/null; then
        echo "--------------------------------------------------"
        echo "$RESPONSE" | jq -r '.answer'
        echo "--------------------------------------------------"
        echo "🔒 Preuves :"
        echo "$RESPONSE" | jq -r '.sources[] | "• Date : \(.date) | Hash : \(.hash_short)"'
    else
        echo "👉 (Installe 'jq' avec 'sudo apt install jq' pour un affichage plus joli)"
    fi
fi

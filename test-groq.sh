#!/bin/bash

read -p "🔑 Colle ta GROQ_API_KEY (commence par gsk_) : " GROQ_KEY

echo ""
echo "=================================================="
echo "🔍 TEST DIRECT DE L'API GROQ"
echo "=================================================="

RESPONSE=$(curl -s -X POST "https://api.groq.com/openai/v1/chat/completions" \
  -H "Authorization: Bearer $GROQ_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama-3.1-8b-instant",
    "messages": [{"role": "user", "content": "Dis bonjour en 1 mot."}],
    "max_tokens": 10
  }')

echo "$RESPONSE"
echo ""

if echo "$RESPONSE" | grep -q '"choices"'; then
    echo "✅ TA CLÉ GROQ EST VALIDE et le modèle fonctionne !"
elif echo "$RESPONSE" | grep -q '"invalid_api_key"'; then
    echo "❌ Clé API invalide. Régénère-la sur console.groq.com/keys"
elif echo "$RESPONSE" | grep -q '"model_not_found"'; then
    echo "❌ Le modèle 'llama-3.1-8b-instant' n'existe plus. Change de modèle."
else
    echo "⚠️ Erreur inconnue, regarde la réponse brute ci-dessus."
fi

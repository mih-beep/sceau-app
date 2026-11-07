# SCEAU Protocol — API Publique v1

L'API permet à n'importe quel site web de sceller un document sans authentification.

## Endpoint
`POST https://sceau-app.vercel.app/api/v1/public/seal`

## Paramètres (Form-Data)
- `file` (obligatoire) : Le fichier binaire à sceller.

## Réponse (JSON)
```json
{
  "success": true,
  "protocol": "SCEAU v1.0",
  "document": {
    "name": "mon-contrat.pdf",
    "hash_sha256": "4b227777d4dd1..."
  },
  "bitcoin_anchor": {
    "secured": true,
    "ots_proof_base64": "AE9wZW5UaW1lc3RhbXBz..."
  }
}

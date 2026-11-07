# SCEAU Protocol — API Publique v1

L'API permet à n'importe quel site web (WordPress, Python, PHP, React) de sceller un document sans authentification.

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
    "hash_sha256": "4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a"
  },
  "bitcoin_anchor": {
    "secured": true,
    "ots_proof_base64": "AE9wZW5UaW1lc3RhbXBzAABQcm9vZg..."
  }
}

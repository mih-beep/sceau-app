# 🏛️ SCEAU Protocol (v1.0)

Le protocole de preuve d'antériorité de SCEAU.
Permet d'ancrer l'empreinte cryptographique d'un fichier sur la blockchain Bitcoin.

## 🚀 Utilisation via l'API publique (Terminal)

Vous pouvez utiliser l'API REST gratuite pour sceller un document instantanément avec `curl` :

```bash
curl -X POST https://sceau-app.vercel.app/api/v1/public/seal \
  -F "file=@mon-document.pdf"

# SCEAU Protocol — Architecture Générale

## 1. Le Principe
SCEAU est un protocole de preuve d'antériorité. Il sépare strictement **la preuve** (le hash et son ancrage) de **l'objet** (le fichier).

## 2. Les 3 Composants
1. **Le Hash (SHA-256)** : Une empreinte unique du fichier. Si un seul pixel, caractère ou bit change, le hash change.
2. **L'Ancrage (OpenTimestamps)** : Le hash est envoyé à des serveurs "Calendar" qui l'agrègent et l'écrivent dans une transaction de la blockchain Bitcoin.
3. **La Preuve (.ots)** : Un fichier cryptographique téléchargeable qui prouve de manière mathématique que le hash existait au moment du bloc Bitcoin.

## 3. Le Rôle de l'Application
Le protocole est aveugle. Il ne sait pas si tu as scellé un roman, un contrat ou une photo. C'est l'application (l'interface utilisateur, la base de données) qui donne du contexte (le titre, l'auteur, le fichier). L'application utilise le protocole, mais le protocole ne dépend pas de l'application.

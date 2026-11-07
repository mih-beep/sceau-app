# SCEAU Protocol — Architecture Générale

## 1. Le Principe
SCEAU est un protocole de preuve d'antériorité. Il sépare strictement **la preuve** (le hash et son ancrage) de **l'objet** (le fichier).

## 2. Les 3 Composants
1. **Le Hash (SHA-256)** : Une empreinte unique du fichier. Si un seul bit change, le hash change.
2. **L'Ancrage (OpenTimestamps)** : Le hash est envoyé à des serveurs "Calendar" qui l'agrègent et l'écrivent dans la blockchain Bitcoin.
3. **La Preuve (.ots)** : Un fichier cryptographique téléchargeable qui prouve mathématiquement que le hash existait au moment du bloc Bitcoin.

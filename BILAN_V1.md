# 🏛️ SCEAU — Bilan de la Version 1 (V1)

## 🚀 Statut : Déployé et Fonctionnel
L'application SCEAU (V1) est officiellement en ligne. Le code est stable, les interfaces communiquent, et la plomberie de stockage est branchée.

## 🛠️ Stack Technique
- **Frontend & Backend** : Next.js 16 (App Router), React, TypeScript, Tailwind CSS.
- **Base de données** : PostgreSQL hébergé sur Neon.
- **Stockage de fichiers** : Compatible protocole S3 (Actuellement sur Supabase, prêt à migrer vers Cloudflare R2 ou AWS en 5 minutes via variables d'environnement).
- **Ancrage Cryptographique** : OpenTimestamps (Ancrage des hashs dans la blockchain Bitcoin).
- **Sécurité** : Hachage côté client avec `@noble/hashes` (le fichier original ne quitte jamais l'appareil sans consentement).

## 🧩 Fonctionnalités Implémentées
1. **L'Atelier** : Scellement de fichiers, textes, audios et photos.
2. **Sceau Flash** : Preuve locale sans hébergement (pour les secrets industriels ou idées fugaces).
3. **Sceau Mystère** : Fichier masqué sur le feed jusqu'à obtention d'un certain nombre de "J'aime".
4. **Sceau Éphémère** : Disparaît du feed public après 24h (mais la preuve reste).
5. **Le Feed Global** : Réactions multiples (Like, Wow, Inspirant), Tendances, et boutons de partage.
6. **Le Cercle** : Système d'amis complet et système de "Défis" de création.
7. **Messagerie** : Messages privés, groupes de discussion et Pactes multi-signatures.
8. **Le Coffre** : 4 compartiments (Public, Amis, Privé, Flash) avec possibilité de déplacer les œuvres.
9. **Le Portfolio** : Génération de PDF modulaire (filtrage par date, par compartiment, avec intégration des liens).
10. **La preuve** : Manifeste des 3 piliers (Droit d'auteur, Antériorité, Journal des accès).

## ⚖️ La Philosophie (Rappel)
SCEAU ne réinvente pas la loi. SCEAU lui donne des yeux.
- **La technique est prête** : Chaque hash est gravé via OpenTimestamps.
- **La loi fera sa part** : La reconnaissance juridique viendra avec l'adoption et les partenariats (eIDAS, avocats).
- **L'adoption fera le reste** : Comme le cadenas HTTPS, SCEAU deviendra un standard invisible.

## 🔜 Prochaines Étapes (V2)
- Monétisation (Stripe) : Activation des murs payants (quotas de stockage, portfolio sans filigrane).
- Extension navigateur (Le badge URNE).
- API publique pour les plateformes tierces.

*Généré avec fierté le 06/11/2026.*

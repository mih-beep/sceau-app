# SCEAU Protocol — Le Modèle de Stockage

Le protocole ne stocke que des hashes. Où est le fichier ? Il y a 3 façons de faire selon le besoin.

## Modèle A : Stockage par l'Application SCEAU (Centralisé)
L'utilisateur dépose le fichier sur SCEAU. L'application calcule le hash, l'ancre sur Bitcoin, et stocke le fichier sur un serveur cloud (S3/R2).
* Lien de vérification : L'application associe le hash (Bitcoin) au `file_path` (le serveur cloud) dans sa base de données.

## Modèle B : Stockage par l'API (Développeurs)
Un site externe utilise l'API SCEAU. Il envoie son fichier, reçoit le hash et la preuve `.ots`.
* Lien de vérification : C'est le site externe qui héberge le fichier sur son propre serveur.

## Modèle C : Le Web3 et IPFS (Décentralisé)
Le fichier est stocké sur le réseau IPFS. Sur IPFS, le nom du fichier EST son hash cryptographique.
* Lien de vérification : Le hash SCEAU (Bitcoin) et le hash IPFS du fichier sont associés.

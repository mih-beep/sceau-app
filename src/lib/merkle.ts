import { sha256 } from '@noble/hashes/sha256';

/**
 * Prend une liste de hashs (en Base64) et calcule le Hash Racine (Merkle Root).
 * Les hashs sont triés pour garantir que l'ordre des fichiers n'affecte pas le résultat.
 */
export function buildMerkleRoot(hashesB64: string[]): string {
  if (hashesB64.length === 0) return '';
  if (hashesB64.length === 1) return hashesB64[0];

  // On s'assure que tous les hashs sont décodés en Buffer pour la concaténation
  let currentLevel = hashesB64.map(h => Buffer.from(h, 'base64'));

  while (currentLevel.length > 1) {
    const nextLevel: Buffer[] = [];
    for (let i = 0; i < currentLevel.length; i += 2) {
      if (i + 1 < currentLevel.length) {
        // Hachage de la concaténation de deux hashs
        const combined = Buffer.concat([currentLevel[i], currentLevel[i + 1]]);
        const hash = sha256(new Uint8Array(combined));
        nextLevel.push(Buffer.from(hash));
      } else {
        // S'il reste un élément impair, on le passe au niveau supérieur tel quel
        nextLevel.push(currentLevel[i]);
      }
    }
    currentLevel = nextLevel;
  }

  return currentLevel[0].toString('base64');
}

// E2EE avec Diffie-Hellman (X25519) + AES-GCM 256
import { ed25519, x25519 } from '@noble/curves/ed25519';

function bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToBuffer(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// Convertit une clé publique Ed25519 (pour la signature) en clé X25519 (pour le chiffrement)
function edPubToX25519(edPubBase64: string): Uint8Array {
  const edPub = base64ToBuffer(edPubBase64);
  return ed25519.utils.toMontgomery(edPub);
}

// Convertit une clé privée Ed25519 en clé privée X25519
function edPrivToX25519(edPrivBase64: string): Uint8Array {
  const edPriv = base64ToBuffer(edPrivBase64);
  return ed25519.utils.toMontgomerySecret(edPriv);
}

// Dérive une clé AES-GCM à partir du secret partagé Diffie-Hellman
async function deriveAesKey(sharedSecret: Uint8Array): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw', sharedSecret, { name: 'HKDF' }, false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: new Uint8Array(0) },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// Calcule le secret partagé entre moi et le destinataire
async function getSharedKey(myEdPrivBase64: string, theirEdPubBase64: string): Promise<CryptoKey> {
  const myXPriv = edPrivToX25519(myEdPrivBase64);
  const theirXPub = edPubToX25519(theirEdPubBase64);
  const sharedSecret = x25519.getSharedSecret(myXPriv, theirXPub);
  return deriveAesKey(sharedSecret);
}

// CHIFFRER : Le message pour le destinataire
export async function encryptForRecipient(
  text: string,
  myEdPrivBase64: string,
  theirEdPubBase64: string
): Promise<{ ciphertext: string, iv: string }> {
  if (!text) return { ciphertext: '', iv: '' };
  
  const aesKey = await getSharedKey(myEdPrivBase64, theirEdPubBase64);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(text);
  
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, encoded);
  
  return {
    ciphertext: bufferToBase64(encrypted),
    iv: bufferToBase64(iv)
  };
}

// DÉCHIFFRER : Le message reçu
export async function decryptFromSender(
  ciphertextBase64: string,
  ivBase64: string,
  myEdPrivBase64: string,
  theirEdPubBase64: string
): Promise<string> {
  if (!ciphertextBase64 || !ivBase64) return ciphertextBase64;
  
  try {
    const aesKey = await getSharedKey(myEdPrivBase64, theirEdPubBase64);
    const iv = base64ToBuffer(ivBase64);
    const ciphertext = base64ToBuffer(ciphertextBase64);
    
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, aesKey, ciphertext);
    return new TextDecoder().decode(decrypted);
  } catch (e) {
    console.error('[E2EE] Impossible de déchiffrer');
    return '🔒 [Message chiffré - Clé incompatible]';
  }
}

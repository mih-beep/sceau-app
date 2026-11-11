// Module de chiffrement de bout en bout (E2EE) - AES-GCM 256 bits
// Utilise l'API Web Crypto native du navigateur.

const KEY_STORAGE_NAME = 'sceau_e2ee_key';

// Convertit un ArrayBuffer en Base64
function bufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Convertit du Base64 en ArrayBuffer
function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// Récupère ou génère la clé AES de l'utilisateur (stockée localement)
export async function getOrCreateKey(): Promise<CryptoKey> {
  const storedKey = localStorage.getItem(KEY_STORAGE_NAME);
  
  if (storedKey) {
    const rawKey = base64ToBuffer(storedKey);
    return await crypto.subtle.importKey(
      'raw', rawKey, { name: 'AES-GCM' }, true, ['encrypt', 'decrypt']
    );
  }

  // Génération d'une nouvelle clé AES-GCM 256 bits
  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']
  );
  
  const exported = await crypto.subtle.exportKey('raw', key);
  localStorage.setItem(KEY_STORAGE_NAME, bufferToBase64(exported));
  
  return key;
}

// Chiffre un texte. Retourne un objet avec le texte chiffré et l'IV (Initialization Vector)
export async function encryptText(text: string): Promise<{ ciphertext: string, iv: string }> {
  if (!text) return { ciphertext: '', iv: '' };
  
  const key = await getOrCreateKey();
  const iv = crypto.getRandomValues(new Uint8Array(12)); // IV de 12 octets pour GCM
  const encodedText = new TextEncoder().encode(text);
  
  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv }, key, encodedText
  );

  return {
    ciphertext: bufferToBase64(ciphertextBuffer),
    iv: bufferToBase64(iv.buffer)
  };
}

// Déchiffre un texte
export async function decryptText(ciphertext: string, ivBase64: string): Promise<string> {
  if (!ciphertext || !ivBase64) return ciphertext;
  
  try {
    const key = await getOrCreateKey();
    const iv = base64ToBuffer(ivBase64);
    const ciphertextBuffer = base64ToBuffer(ciphertext);

    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv }, key, ciphertextBuffer
    );

    return new TextDecoder().decode(decryptedBuffer);
  } catch (e) {
    console.error('[Crypto] Impossible de déchiffrer (mauvaise clé ou données corrompues)');
    return '🔒 [Message chiffré - Clé invalide sur cet appareil]';
  }
}

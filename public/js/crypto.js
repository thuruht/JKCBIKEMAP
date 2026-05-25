// Cryptographic operations for E2EE Direct Messages

export async function generateKeyPair() {
  const keyPair = await window.crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey", "deriveBits"]
  );

  const privateJwk = await window.crypto.subtle.exportKey("jwk", keyPair.privateKey);
  const publicJwk = await window.crypto.subtle.exportKey("jwk", keyPair.publicKey);

  localStorage.setItem('chat_private_key', JSON.stringify(privateJwk));
  
  return { privateJwk, publicJwk };
}

export async function getLocalPrivateKey() {
  const stored = localStorage.getItem('chat_private_key');
  if (!stored) return null;
  return await window.crypto.subtle.importKey(
    "jwk",
    JSON.parse(stored),
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey", "deriveBits"]
  );
}

export async function importPublicKey(jwkString) {
  if (!jwkString) return null;
  const jwk = typeof jwkString === 'string' ? JSON.parse(jwkString) : jwkString;
  return await window.crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDH", namedCurve: "P-256" },
    true,
    []
  );
}

export async function deriveSharedSecret(privateKey, publicKey) {
  return await window.crypto.subtle.deriveKey(
    { name: "ECDH", public: publicKey },
    privateKey,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}

export async function encryptMessage(text, sharedSecret) {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  
  const ciphertextBuffer = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    sharedSecret,
    data
  );
  
  // Convert buffer to base64
  const ciphertext = btoa(String.fromCharCode(...new Uint8Array(ciphertextBuffer)));
  const ivBase64 = btoa(String.fromCharCode(...iv));
  
  return { ciphertext, iv: ivBase64 };
}

export async function decryptMessage(ciphertextBase64, ivBase64, sharedSecret) {
  try {
    const ciphertext = new Uint8Array(atob(ciphertextBase64).split("").map(c => c.charCodeAt(0)));
    const iv = new Uint8Array(atob(ivBase64).split("").map(c => c.charCodeAt(0)));
    
    const decryptedBuffer = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv },
      sharedSecret,
      ciphertext
    );
    
    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuffer);
  } catch (err) {
    console.error("Decryption failed:", err);
    return "[Encrypted message - Decryption failed]";
  }
}

export function exportPrivateKey() {
  return localStorage.getItem('chat_private_key');
}

export function storePrivateKey(jwkString) {
  localStorage.setItem('chat_private_key', jwkString);
}

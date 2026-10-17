// Mirrors MESSAPP's src/lib/crypto.js (ECDH P-256 -> AES-GCM, PIN-wrapped key backup).
// Chimaera only reads keys; it never generates, wraps or uploads one.
const encoder = new TextEncoder();
const decoder = new TextDecoder();

const ECDH = { name: "ECDH", namedCurve: "P-256" } as const;
const LEGACY_PIN_KDF_ITERATIONS = 100000;
const PIN_KDF_ITERATIONS = 600000;

export interface AesEnvelope {
  iv: string;
  ciphertext: string;
}

export const toBase64 = (bytes: ArrayBuffer | Uint8Array) => {
  const data = new Uint8Array(bytes);
  let bin = "";
  for (let i = 0; i < data.length; i += 0x8000) {
    bin += String.fromCharCode(...data.subarray(i, i + 0x8000));
  }
  return btoa(bin);
};

export const fromBase64 = (base64: string) =>
  Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));

export const importPrivateKey = (jwk: JsonWebKey) =>
  crypto.subtle.importKey("jwk", { ...jwk, ext: true }, ECDH, true, [
    "deriveKey",
  ]);

export const deriveSharedKey = async (
  privateKey: CryptoKey,
  peerPublicJwk: JsonWebKey
) => {
  const peer = await crypto.subtle.importKey(
    "jwk",
    { ...peerPublicJwk, ext: true },
    ECDH,
    true,
    []
  );

  return crypto.subtle.deriveKey(
    { name: "ECDH", public: peer },
    privateKey,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
};

export const encryptText = async (
  key: CryptoKey,
  text: string
): Promise<AesEnvelope> => {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(text)
  );

  return { iv: toBase64(iv), ciphertext: toBase64(encrypted) };
};

/** Null when the key is wrong; GCM authenticates, so garbage never decodes. */
export const decryptText = async (
  key: CryptoKey,
  { iv, ciphertext }: AesEnvelope
): Promise<string | null> => {
  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromBase64(iv) },
      key,
      fromBase64(ciphertext)
    );
    return decoder.decode(decrypted);
  } catch {
    return null;
  }
};

/** Unwraps the private-key backup MESSAPP stores in profiles.encrypted_private_key. */
export const unwrapPrivateKey = async (
  pin: string,
  wrapped: string
): Promise<JsonWebKey> => {
  const { v, salt, iv, ciphertext } = JSON.parse(wrapped);

  const material = await crypto.subtle.importKey(
    "raw",
    encoder.encode(pin),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  const key = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: fromBase64(salt),
      iterations:
        Number(v) >= 3 ? PIN_KDF_ITERATIONS : LEGACY_PIN_KDF_ITERATIONS,
      hash: "SHA-256",
    },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );

  const json = await decryptText(key, { iv, ciphertext });
  if (!json) throw new Error("Incorrect PIN");

  return JSON.parse(json);
};

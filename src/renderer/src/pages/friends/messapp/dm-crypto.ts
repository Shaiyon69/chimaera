import {
  decryptText,
  deriveSharedKey,
  encryptText,
  importPrivateKey,
  type AesEnvelope,
} from "./crypto.js";

/** MESSAPP stamps each DM with both public keys, so old messages stay readable after a key change. */
export interface DmEnvelope extends AesEnvelope {
  spub?: JsonWebKey;
  tpub?: JsonWebKey;
}

export interface DmKeyring {
  privateKey: CryptoKey;
  publicJwk: JsonWebKey;
}

export const createKeyring = async (
  privateJwk: JsonWebKey
): Promise<DmKeyring> => ({
  privateKey: await importPrivateKey(privateJwk),
  publicJwk: {
    kty: privateJwk.kty,
    crv: privateJwk.crv,
    x: privateJwk.x,
    y: privateJwk.y,
    ext: true,
  },
});

export const encryptDm = async (
  keyring: DmKeyring,
  peerPublicJwk: JsonWebKey,
  text: string
) => {
  const shared = await deriveSharedKey(keyring.privateKey, peerPublicJwk);
  const envelope: DmEnvelope = {
    ...(await encryptText(shared, text)),
    spub: keyring.publicJwk,
    tpub: { ...peerPublicJwk, ext: true },
  };

  return JSON.stringify(envelope);
};

const parseEnvelope = (content: string): DmEnvelope | null => {
  if (!content.startsWith("{")) return null;

  try {
    const parsed = JSON.parse(content);
    return parsed?.iv && parsed?.ciphertext ? parsed : null;
  } catch {
    return null;
  }
};

/** Plain text, or null when no key we hold can open it (e.g. sealed with a lost legacy key). */
export const decryptDm = async (
  keyring: DmKeyring,
  content: string,
  sentByMe: boolean,
  peerPublicJwk: JsonWebKey | null
): Promise<string | null> => {
  const envelope = parseEnvelope(content);
  if (!envelope) return content;

  let counterpart = peerPublicJwk;
  if (envelope.spub && envelope.tpub) {
    counterpart = sentByMe ? envelope.tpub : envelope.spub;
  }
  if (!counterpart) return null;

  try {
    const shared = await deriveSharedKey(keyring.privateKey, counterpart);
    return await decryptText(shared, envelope);
  } catch {
    return null;
  }
};

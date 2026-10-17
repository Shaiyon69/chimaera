import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { fromBase64, toBase64, unwrapPrivateKey } from "./crypto.js";
import { createKeyring, decryptDm, encryptDm } from "./dm-crypto.js";

const newPair = async () => {
  const pair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey"]
  );

  return {
    privateJwk: await crypto.subtle.exportKey("jwk", pair.privateKey),
    publicJwk: await crypto.subtle.exportKey("jwk", pair.publicKey),
  };
};

// Same wrapping MESSAPP's encryptKeyWithPin produces (v:2 keeps the test fast).
const wrap = async (pin: string, json: string) => {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pin),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  );
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(json)
  );

  return JSON.stringify({
    v: 2,
    salt: toBase64(salt),
    iv: toBase64(iv),
    ciphertext: toBase64(ciphertext),
  });
};

describe("messapp dm crypto", () => {
  it("round-trips between two users in both directions", async () => {
    const alice = await newPair();
    const bob = await newPair();
    const aliceRing = await createKeyring(alice.privateJwk);
    const bobRing = await createKeyring(bob.privateJwk);

    const content = await encryptDm(aliceRing, bob.publicJwk, "hello bob");

    assert.equal(
      await decryptDm(bobRing, content, false, alice.publicJwk),
      "hello bob"
    );
    assert.equal(
      await decryptDm(aliceRing, content, true, bob.publicJwk),
      "hello bob"
    );
  });

  it("reads old messages from the embedded public keys alone", async () => {
    const alice = await newPair();
    const bob = await newPair();
    const content = await encryptDm(
      await createKeyring(alice.privateJwk),
      bob.publicJwk,
      "old"
    );

    assert.equal(
      await decryptDm(
        await createKeyring(bob.privateJwk),
        content,
        false,
        null
      ),
      "old"
    );
  });

  it("returns null for a key that cannot open the message", async () => {
    const alice = await newPair();
    const bob = await newPair();
    const eve = await newPair();
    const content = await encryptDm(
      await createKeyring(alice.privateJwk),
      bob.publicJwk,
      "secret"
    );

    assert.equal(
      await decryptDm(
        await createKeyring(eve.privateJwk),
        content,
        false,
        alice.publicJwk
      ),
      null
    );
  });

  it("passes plain text through untouched", async () => {
    const ring = await createKeyring((await newPair()).privateJwk);
    assert.equal(await decryptDm(ring, "just text", false, null), "just text");
  });

  it("unwraps the PIN backup and rejects a wrong PIN", async () => {
    const { privateJwk } = await newPair();
    const wrapped = await wrap("123456", JSON.stringify(privateJwk));

    assert.deepEqual(await unwrapPrivateKey("123456", wrapped), privateJwk);
    await assert.rejects(
      () => unwrapPrivateKey("000000", wrapped),
      /Incorrect PIN/
    );
  });

  it("base64 helpers round-trip", () => {
    const bytes = new Uint8Array([0, 1, 254, 255]);
    assert.deepEqual(fromBase64(toBase64(bytes)), bytes);
  });
});

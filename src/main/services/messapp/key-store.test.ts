import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import { createKeyStore, type KeyCipher } from "./key-store-core.js";

const reversing: KeyCipher = {
  available: () => true,
  encrypt: (text) => Buffer.from([...text].reverse().join("")),
  decrypt: (data) => [...data.toString()].reverse().join(""),
};

const tempFile = () =>
  path.join(fs.mkdtempSync(path.join(os.tmpdir(), "keys-")), "keys.json");

describe("messapp key store", () => {
  it("round-trips per user and never writes plaintext", () => {
    const file = tempFile();
    const store = createKeyStore(file, reversing);

    assert.equal(store.save("u1", "private-jwk"), true);
    store.save("u2", "other");

    assert.equal(store.load("u1"), "private-jwk");
    assert.equal(store.load("u2"), "other");
    assert.equal(fs.readFileSync(file, "utf-8").includes("private-jwk"), false);
  });

  it("clear removes only that user", () => {
    const store = createKeyStore(tempFile(), reversing);
    store.save("u1", "a");
    store.save("u2", "b");
    store.clear("u1");

    assert.equal(store.load("u1"), null);
    assert.equal(store.load("u2"), "b");
  });

  it("refuses to persist when the OS cannot encrypt", () => {
    const file = tempFile();
    const store = createKeyStore(file, {
      ...reversing,
      available: () => false,
    });

    assert.equal(store.save("u1", "secret"), false);
    assert.equal(fs.existsSync(file), false);
  });

  it("returns null for a corrupt blob", () => {
    const file = tempFile();
    fs.writeFileSync(file, JSON.stringify({ u1: "not-base64!!" }));
    const store = createKeyStore(file, {
      ...reversing,
      decrypt: () => {
        throw new Error("bad");
      },
    });

    assert.equal(store.load("u1"), null);
  });
});

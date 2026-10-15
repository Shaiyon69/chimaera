import assert from "node:assert/strict";
import test from "node:test";
import { checkSignature } from "./update-signature-core.js";

const PIN = ["AABBCC"];
const sig = (Status: number, Thumbprint?: string) =>
  JSON.stringify({
    Status,
    SignerCertificate: Thumbprint ? { Thumbprint } : null,
  });

test("accepts a valid signature from a pinned certificate", () => {
  assert.equal(checkSignature(sig(0, "AABBCC"), PIN), null);
});

test("accepts an untrusted-root signature from a pinned certificate, ignoring case", () => {
  assert.equal(checkSignature(sig(1, "aabbcc"), PIN), null);
});

test("rejects a different signer even when Windows trusts it", () => {
  assert.match(
    checkSignature(sig(0, "DDEEFF"), PIN) ?? "",
    /unexpected certificate/
  );
});

test("rejects tampered, unsigned and untrusted statuses", () => {
  for (const status of [2, 3, 4, 5, 6]) {
    assert.match(checkSignature(sig(status, "AABBCC"), PIN) ?? "", /status/i);
  }
});

test("rejects a missing signer and malformed output", () => {
  assert.notEqual(checkSignature(sig(0), PIN), null);
  assert.notEqual(checkSignature("not json", PIN), null);
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { Game } from "@types";
import { dedupeLibrary } from "./dedupe-library.js";

const game = (overrides: Partial<Game>): Game =>
  ({
    title: "Hades",
    shop: "custom",
    objectId: "x",
    playTimeInMilliseconds: 0,
    lastTimePlayed: null,
    executablePath: null,
    ...overrides,
  }) as Game;

describe("dedupeLibrary", () => {
  it("keeps the steam copy over a custom one", () => {
    const out = dedupeLibrary([
      ["custom:a", game({ title: "Hades", executablePath: "C:/h.exe" })],
      ["steam:1", game({ title: "HADES", shop: "steam" })],
    ]);

    assert.deepEqual(
      out.map(([key]) => key),
      ["steam:1"]
    );
  });

  it("prefers more playtime when shops match", () => {
    const out = dedupeLibrary([
      ["custom:a", game({ playTimeInMilliseconds: 5 })],
      ["custom:b", game({ playTimeInMilliseconds: 50 })],
    ]);

    assert.deepEqual(
      out.map(([key]) => key),
      ["custom:b"]
    );
  });

  it("never merges launchbox titles", () => {
    const out = dedupeLibrary([
      ["launchbox:a", game({ shop: "launchbox" })],
      ["launchbox:b", game({ shop: "launchbox" })],
    ]);

    assert.equal(out.length, 2);
  });
});

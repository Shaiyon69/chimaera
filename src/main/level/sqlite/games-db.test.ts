import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { GamesStore, type StoredGame } from "./games-db.js";

type G = StoredGame & { extra?: string; lastTimePlayed?: string | Date | null };

const tempStore = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "games-db-"));
  const store = new GamesStore<G>(() => path.join(dir, "chimaera.sqlite"));
  return {
    store,
    done: () => {
      store.close();
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
};

const game = (objectId: string, over: Partial<G> = {}): G => ({
  shop: "steam",
  objectId,
  title: `Game ${objectId}`,
  playTimeInMilliseconds: 0,
  isDeleted: false,
  ...over,
});

test("put/get round-trips like LevelDB JSON (dates come back as strings)", async () => {
  const { store, done } = tempStore();
  try {
    const played = new Date("2026-10-01T10:00:00Z");
    await store.put(
      "steam:1",
      game("1", { lastTimePlayed: played, extra: "x" })
    );
    const got = await store.get("steam:1");
    assert.equal(got?.extra, "x");
    assert.equal(got?.lastTimePlayed, played.toISOString());
    assert.equal(await store.get("steam:missing"), undefined);
    assert.deepEqual(
      (await store.getMany(["steam:1", "nope"])).map((g) => g?.objectId),
      ["1", undefined]
    );
    await store.put("steam:1", game("1", { title: "Renamed" }));
    assert.equal((await store.get("steam:1"))?.title, "Renamed");
    await store.del("steam:1");
    assert.equal(await store.get("steam:1"), undefined);
  } finally {
    done();
  }
});

test("iterator, values and keys list every game, sync or awaited", async () => {
  const { store, done } = tempStore();
  try {
    await store.put("steam:2", game("2"));
    await store.put("steam:1", game("1"));
    assert.deepEqual(await store.keys().all(), ["steam:1", "steam:2"]);
    assert.deepEqual(
      (await store.values().all()).map((g) => g.objectId),
      ["1", "2"]
    );
    const seen: string[] = [];
    for await (const [key, value] of store.iterator()) {
      seen.push(`${key}=${value.objectId}`);
    }
    assert.deepEqual(seen, ["steam:1=1", "steam:2=2"]);
    await store.clear();
    assert.deepEqual(await store.keys().all(), []);
  } finally {
    done();
  }
});

test("batch is all or nothing", async () => {
  const { store, done } = tempStore();
  try {
    await store.put("steam:1", game("1"));
    await store.batch([
      { type: "put", key: "steam:2", value: game("2") },
      { type: "del", key: "steam:1" },
    ]);
    assert.deepEqual(await store.keys().all(), ["steam:2"]);
    await assert.rejects(
      store.batch([
        { type: "put", key: "steam:3", value: game("3") },
        // A NULL shop violates NOT NULL and aborts the whole batch.
        {
          type: "put",
          key: "steam:4",
          value: { ...game("4"), shop: null as never },
        },
      ])
    );
    assert.deepEqual(await store.keys().all(), ["steam:2"]);
  } finally {
    done();
  }
});

test("migration copies the old store once and keeps newer rows", async () => {
  const { store, done } = tempStore();
  try {
    await store.put("steam:1", game("1", { title: "Already here" }));
    const source = async function* (): AsyncIterable<[string, G]> {
      yield ["steam:1", game("1", { title: "Old" })];
      yield ["steam:2", game("2", { playTimeInMilliseconds: 5000 })];
    };
    assert.equal(await store.migrateFrom(source()), 2);
    assert.equal((await store.get("steam:1"))?.title, "Already here");
    assert.equal((await store.get("steam:2"))?.playTimeInMilliseconds, 5000);
    assert.equal(await store.migrateFrom(source()), 0);
  } finally {
    done();
  }
});

test("playtime summary and sessions", async () => {
  const { store, done } = tempStore();
  try {
    await store.put(
      "steam:1",
      game("1", { playTimeInMilliseconds: 3_600_000 })
    );
    await store.put("steam:2", game("2", { playTimeInMilliseconds: 60_000 }));
    await store.put("steam:3", game("3"));
    await store.put(
      "steam:4",
      game("4", { playTimeInMilliseconds: 9_000_000, isDeleted: true })
    );
    const summary = store.getPlaytimeSummary(1);
    assert.equal(summary.totalPlayTimeInMilliseconds, 3_660_000);
    assert.equal(summary.gameCount, 3);
    assert.equal(summary.playedGameCount, 2);
    assert.deepEqual(
      summary.mostPlayed.map((g) => g.objectId),
      ["1"]
    );

    store.addPlaySession({
      gameKey: "steam:1",
      startedAt: 1000,
      endedAt: 61_000,
      durationMs: 60_000,
    });
    store.addPlaySession({
      gameKey: "steam:1",
      startedAt: 100_000,
      endedAt: 100_000,
      durationMs: 0,
    });
    store.addPlaySession({
      gameKey: "steam:1",
      startedAt: 200_000,
      endedAt: 230_000,
      durationMs: 30_000,
    });
    assert.deepEqual(
      store.getPlaySessions("steam:1").map((s) => s.durationMs),
      [30_000, 60_000]
    );
  } finally {
    done();
  }
});

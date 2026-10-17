// ts-node only sees ambient types it is pointed at; tests run this file directly.
// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../../services/node-sqlite.d.ts" />
import { DatabaseSync } from "node:sqlite";

/**
 * The library in SQLite: one row per game (the full record as JSON, plus columns for
 * queries) and a play-session history. Exposes the methods callers used on the old
 * LevelDB `games` sublevel, so they keep working unchanged.
 */

export interface StoredGame {
  shop: string;
  objectId: string;
  title?: string;
  playTimeInMilliseconds?: number;
  lastTimePlayed?: Date | string | null;
  addedToLibraryAt?: Date | string | null;
  isDeleted?: boolean;
  favorite?: boolean;
}

export type GameBatchOp<T> =
  | { type: "put"; key: string; value: T }
  | { type: "del"; key: string };

export interface PlaySession {
  gameKey: string;
  startedAt: number;
  endedAt: number;
  durationMs: number;
}

const SCHEMA_VERSION = 1;

const time = (d: Date | string | null | undefined) => {
  if (!d) return null;
  const t = new Date(d).getTime();
  return Number.isNaN(t) ? null : t;
};

/** A LevelDB-style async iterable that also has `.all()`. */
const listing = <V>(load: () => V[]) => ({
  all: async () => load(),
  async *[Symbol.asyncIterator]() {
    yield* load();
  },
});

export class GamesStore<T extends StoredGame> {
  private db: DatabaseSync | null = null;

  constructor(private readonly file: () => string) {}

  private open() {
    if (this.db) return this.db;
    const db = new DatabaseSync(this.file());
    db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);
      CREATE TABLE IF NOT EXISTS games (
        key TEXT PRIMARY KEY,
        shop TEXT NOT NULL,
        object_id TEXT NOT NULL,
        title TEXT,
        play_time_ms INTEGER NOT NULL DEFAULT 0,
        last_time_played INTEGER,
        added_at INTEGER,
        is_deleted INTEGER NOT NULL DEFAULT 0,
        favorite INTEGER NOT NULL DEFAULT 0,
        data TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS play_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        game_key TEXT NOT NULL,
        started_at INTEGER NOT NULL,
        ended_at INTEGER NOT NULL,
        duration_ms INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS play_sessions_game ON play_sessions (game_key, started_at);
    `);
    db.prepare(
      "INSERT OR IGNORE INTO meta (key, value) VALUES ('schema', ?)"
    ).run(String(SCHEMA_VERSION));
    this.db = db;
    return db;
  }

  close() {
    this.db?.close();
    this.db = null;
  }

  private write(db: DatabaseSync, key: string, value: T) {
    db.prepare(
      `INSERT INTO games (key, shop, object_id, title, play_time_ms, last_time_played,
         added_at, is_deleted, favorite, data)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET shop = excluded.shop, object_id = excluded.object_id,
         title = excluded.title, play_time_ms = excluded.play_time_ms,
         last_time_played = excluded.last_time_played, added_at = excluded.added_at,
         is_deleted = excluded.is_deleted, favorite = excluded.favorite, data = excluded.data`
    ).run(
      key,
      value.shop,
      value.objectId,
      value.title ?? null,
      Math.trunc(value.playTimeInMilliseconds ?? 0),
      time(value.lastTimePlayed),
      time(value.addedToLibraryAt),
      value.isDeleted ? 1 : 0,
      value.favorite ? 1 : 0,
      // Same round-trip as LevelDB's JSON encoding: Dates come back as strings.
      JSON.stringify(value)
    );
  }

  private transaction(run: (db: DatabaseSync) => void) {
    const db = this.open();
    db.exec("BEGIN");
    try {
      run(db);
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }

  async get(key: string): Promise<T | undefined> {
    const row = this.open()
      .prepare("SELECT data FROM games WHERE key = ?")
      .get(key) as { data: string } | undefined;
    return row ? (JSON.parse(row.data) as T) : undefined;
  }

  async getMany(keys: string[]): Promise<(T | undefined)[]> {
    const stmt = this.open().prepare("SELECT data FROM games WHERE key = ?");
    return keys.map((key) => {
      const row = stmt.get(key) as { data: string } | undefined;
      return row ? (JSON.parse(row.data) as T) : undefined;
    });
  }

  async put(key: string, value: T) {
    this.write(this.open(), key, value);
  }

  async del(key: string) {
    this.open().prepare("DELETE FROM games WHERE key = ?").run(key);
  }

  async clear() {
    this.open().exec("DELETE FROM games");
  }

  /** All writes, or none. */
  async batch(ops: GameBatchOp<T>[]) {
    this.transaction((db) => {
      for (const op of ops) {
        if (op.type === "put") this.write(db, op.key, op.value);
        else db.prepare("DELETE FROM games WHERE key = ?").run(op.key);
      }
    });
  }

  private rows() {
    return this.open()
      .prepare("SELECT key, data FROM games ORDER BY key")
      .all() as { key: string; data: string }[];
  }

  iterator() {
    return listing(() =>
      this.rows().map(
        ({ key, data }) => [key, JSON.parse(data) as T] as [string, T]
      )
    );
  }

  values() {
    return listing(() => this.rows().map(({ data }) => JSON.parse(data) as T));
  }

  keys() {
    return listing(() => this.rows().map(({ key }) => key));
  }

  getMeta(key: string): string | undefined {
    const row = this.open()
      .prepare("SELECT value FROM meta WHERE key = ?")
      .get(key) as { value: string } | undefined;
    return row?.value;
  }

  setMeta(key: string, value: string) {
    this.open()
      .prepare(
        "INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
      )
      .run(key, value);
  }

  addPlaySession(session: PlaySession) {
    if (session.durationMs <= 0) return;
    this.open()
      .prepare(
        "INSERT INTO play_sessions (game_key, started_at, ended_at, duration_ms) VALUES (?, ?, ?, ?)"
      )
      .run(
        session.gameKey,
        Math.trunc(session.startedAt),
        Math.trunc(session.endedAt),
        Math.trunc(session.durationMs)
      );
  }

  getPlaySessions(gameKey: string, limit = 200): PlaySession[] {
    return (
      this.open()
        .prepare(
          `SELECT game_key, started_at, ended_at, duration_ms FROM play_sessions
           WHERE game_key = ? ORDER BY started_at DESC LIMIT ?`
        )
        .all(gameKey, limit) as {
        game_key: string;
        started_at: number;
        ended_at: number;
        duration_ms: number;
      }[]
    ).map((r) => ({
      gameKey: r.game_key,
      startedAt: r.started_at,
      endedAt: r.ended_at,
      durationMs: r.duration_ms,
    }));
  }

  /** Library-wide totals; deleted games do not count. */
  getPlaytimeSummary(top = 5) {
    const db = this.open();
    const totals = db
      .prepare(
        `SELECT COALESCE(SUM(play_time_ms), 0) AS total, COUNT(*) AS games,
           SUM(CASE WHEN play_time_ms > 0 THEN 1 ELSE 0 END) AS played
         FROM games WHERE is_deleted = 0`
      )
      .get() as { total: number; games: number; played: number | null };
    const mostPlayed = db
      .prepare(
        `SELECT shop, object_id, title, play_time_ms FROM games
         WHERE is_deleted = 0 AND play_time_ms > 0
         ORDER BY play_time_ms DESC LIMIT ?`
      )
      .all(top) as {
      shop: string;
      object_id: string;
      title: string | null;
      play_time_ms: number;
    }[];
    return {
      totalPlayTimeInMilliseconds: totals.total,
      gameCount: totals.games,
      playedGameCount: totals.played ?? 0,
      mostPlayed: mostPlayed.map((g) => ({
        shop: g.shop,
        objectId: g.object_id,
        title: g.title,
        playTimeInMilliseconds: g.play_time_ms,
      })),
    };
  }

  /** One-time copy from the old store; later runs do nothing. */
  async migrateFrom(source: AsyncIterable<[string, T]>) {
    if (this.getMeta("migratedFromLevel")) return 0;
    const entries: [string, T][] = [];
    for await (const entry of source) entries.push(entry);
    this.transaction((db) => {
      for (const [key, value] of entries) {
        const exists = db.prepare("SELECT 1 FROM games WHERE key = ?").get(key);
        if (!exists) this.write(db, key, value);
      }
    });
    this.setMeta("migratedFromLevel", new Date().toISOString());
    return entries.length;
  }
}

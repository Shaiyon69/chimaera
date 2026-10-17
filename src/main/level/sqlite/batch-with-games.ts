import type { Game } from "@types";

import { db } from "../level";
import { gamesSublevel } from "../sublevels/games";
import type { GameBatchOp } from "./games-db";

type Target = { sublevel?: unknown; valueEncoding?: string };

/**
 * Like `db.batch()`, but writes aimed at `gamesSublevel` go to SQLite (in one
 * transaction) and the rest to LevelDB. Games are written first; the two stores are
 * not atomic together.
 */
export const batchWithGames = () => {
  const games: GameBatchOp<Game>[] = [];
  const level = db.batch();
  const isGames = (options?: Target) => options?.sublevel === gamesSublevel;

  const batch = {
    put(key: string, value: unknown, options?: Target) {
      if (isGames(options))
        games.push({ type: "put", key, value: value as Game });
      else level.put(key, value, options as never);
      return batch;
    },
    del(key: string, options?: Target) {
      if (isGames(options)) games.push({ type: "del", key });
      else level.del(key, options as never);
      return batch;
    },
    async write() {
      if (games.length) await gamesSublevel.batch(games);
      await level.write();
    },
  };
  return batch;
};

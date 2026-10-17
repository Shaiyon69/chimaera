import type { Game } from "@types";

import { db } from "../level";
import { levelKeys } from "../sublevels/keys";
import { gamesSublevel } from "../sublevels/games";

/** Copies the LevelDB library into SQLite once. The LevelDB copy stays as a fallback. */
export const migrateGamesToSqlite = () =>
  gamesSublevel.migrateFrom(
    db
      .sublevel<string, Game>(levelKeys.games, { valueEncoding: "json" })
      .iterator()
  );

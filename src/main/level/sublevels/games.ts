import path from "node:path";
import type { Game } from "@types";

import { levelDatabasePath } from "@main/constants";
import { GamesStore } from "../sqlite/games-db";

/** The library lives in SQLite (`chimaera.sqlite` next to the LevelDB folder). */
export const gamesSublevel = new GamesStore<Game>(() =>
  path.join(
    path.dirname(levelDatabasePath),
    `${path.basename(levelDatabasePath).replace("hydra-db", "chimaera")}.sqlite`
  )
);

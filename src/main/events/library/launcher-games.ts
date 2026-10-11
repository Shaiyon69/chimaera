import { registerEvent } from "../register-event";
import { gamesSublevel, levelKeys } from "@main/level";
import { createCustomGame } from "@main/helpers/create-custom-game";
import { fetchGameArtwork } from "@main/services/launcher-import/artwork";
import { detectLauncherGames } from "@main/services/launcher-import/detect";
import type { DetectedGame } from "@main/services/launcher-import/parsers";
import type { LauncherId } from "@types";

/** Stable id so a second import finds the existing record instead of duplicating it. */
const launcherObjectId = (game: Pick<DetectedGame, "launcher" | "id">) =>
  `${game.launcher}-${game.id}`.replace(/[^A-Za-z0-9_.-]/g, "_");

const isInLibrary = async (game: DetectedGame) => {
  const existing = await gamesSublevel
    .get(levelKeys.game("custom", launcherObjectId(game)))
    .catch(() => null);
  return !!existing && !existing.isDeleted;
};

const detectGames = async () => {
  const games = await detectLauncherGames();
  return Promise.all(
    games.map(async (game) => ({
      ...game,
      objectId: launcherObjectId(game),
      imported: await isInLibrary(game),
    }))
  );
};

/** Re-detects instead of trusting the renderer, so paths and URIs always come from this machine. */
const importGames = async (
  _event: Electron.IpcMainInvokeEvent,
  selection: { launcher: LauncherId; id: string }[]
) => {
  const wanted = new Set(selection.map((s) => `${s.launcher}:${s.id}`));
  const games = (await detectLauncherGames()).filter((g) =>
    wanted.has(`${g.launcher}:${g.id}`)
  );

  let imported = 0;
  for (const game of games) {
    if (await isInLibrary(game)) continue;
    const artwork = await fetchGameArtwork(game.title, game.exePath);
    await createCustomGame({
      objectId: launcherObjectId(game),
      title: game.title,
      executablePath: game.exePath,
      ...artwork,
      extra: {
        launcher: game.launcher,
        launcherGameId: game.id,
        externalLaunch: game.externalLaunch,
      },
    });
    imported++;
  }
  return { imported };
};

registerEvent("detectLauncherGames", detectGames);
registerEvent("importLauncherGames", importGames);

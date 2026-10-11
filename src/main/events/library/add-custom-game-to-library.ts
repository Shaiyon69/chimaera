import { registerEvent } from "../register-event";
import { gamesSublevel } from "@main/level";
import { createCustomGame } from "@main/helpers/create-custom-game";
import { randomUUID } from "node:crypto";

const addCustomGameToLibrary = async (
  _event: Electron.IpcMainInvokeEvent,
  title: string,
  executablePath: string,
  iconUrl?: string,
  logoImageUrl?: string,
  libraryHeroImageUrl?: string
) => {
  const existingGames = await gamesSublevel.iterator().all();
  const existingGame = existingGames.find(
    ([_key, game]) => game.executablePath === executablePath && !game.isDeleted
  );

  if (existingGame) {
    throw new Error(
      "A game with this executable path already exists in your library"
    );
  }

  return createCustomGame({
    objectId: randomUUID(),
    title,
    executablePath,
    iconUrl,
    logoImageUrl,
    libraryHeroImageUrl,
  });
};

registerEvent("addCustomGameToLibrary", addCustomGameToLibrary);

import { gamesSublevel, gamesShopAssetsSublevel, levelKeys } from "@main/level";
import type { Game, GameShop } from "@types";

interface CreateCustomGameInput {
  objectId: string;
  title: string;
  executablePath: string | null;
  iconUrl?: string;
  logoImageUrl?: string;
  libraryHeroImageUrl?: string;
  extra?: Partial<Game>;
}

export const createCustomGame = async ({
  objectId,
  title,
  executablePath,
  iconUrl,
  logoImageUrl,
  libraryHeroImageUrl,
  extra,
}: CreateCustomGameInput) => {
  const shop: GameShop = "custom";
  const gameKey = levelKeys.game(shop, objectId);

  await gamesShopAssetsSublevel.put(gameKey, {
    updatedAt: Date.now(),
    objectId,
    shop,
    title,
    iconUrl: iconUrl || null,
    libraryHeroImageUrl: libraryHeroImageUrl || "",
    libraryImageUrl: iconUrl || "",
    logoImageUrl: logoImageUrl || "",
    logoPosition: null,
    coverImageUrl: iconUrl || "",
    downloadSources: [],
  });

  const game = {
    title,
    iconUrl: iconUrl || null,
    logoImageUrl: logoImageUrl || null,
    libraryHeroImageUrl: libraryHeroImageUrl || null,
    objectId,
    shop,
    remoteId: null,
    isDeleted: false,
    playTimeInMilliseconds: 0,
    lastTimePlayed: null,
    addedToLibraryAt: new Date(),
    executablePath,
    executablePathUpdatedAt: new Date(),
    launchOptions: null,
    favorite: false,
    automaticCloudSync: false,
    hasManuallyUpdatedPlaytime: false,
    ...extra,
  };

  await gamesSublevel.put(gameKey, game);
  return game;
};

export interface SteamSearchItem {
  type?: string;
  id: number;
  name: string;
}

export interface GameArtwork {
  iconUrl?: string;
  logoImageUrl?: string;
  libraryHeroImageUrl?: string;
}

/** Lowercase letters and digits only, so "The Witcher® 3: Wild Hunt" equals "the witcher 3 wild hunt". */
export const normalizeTitle = (title: string) =>
  title
    .normalize("NFKD")
    .replace(/[™®©]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

/** Exact normalized title match only: a wrong cover is worse than the exe icon fallback. */
export const pickSteamMatch = (
  items: SteamSearchItem[],
  title: string
): SteamSearchItem | null => {
  const wanted = normalizeTitle(title);
  if (!wanted) return null;
  return (
    items.find(
      (i) => (i.type ?? "app") === "app" && normalizeTitle(i.name) === wanted
    ) ?? null
  );
};

const STEAM_ASSETS =
  "https://shared.steamstatic.com/store_item_assets/steam/apps";

export const steamArtwork = (appId: number): GameArtwork => ({
  iconUrl: `${STEAM_ASSETS}/${appId}/library_600x900_2x.jpg`,
  libraryHeroImageUrl: `${STEAM_ASSETS}/${appId}/library_hero.jpg`,
  logoImageUrl: `${STEAM_ASSETS}/${appId}/logo.png`,
});

/**
 * Local mode: the user's own data is answered from this PC instead of Hydra. Requests
 * are classified by path; public catalogue data still goes to Hydra, without a token.
 */

export const LOCAL_USER_ID = "local";

export type RequestKind =
  /** Answered from local data. */
  | { kind: "local"; route: LocalRoute; query: URLSearchParams }
  /** Public data: sent to Hydra, never authenticated. */
  | { kind: "public" }
  /** Pushes of the user's own game data: reported as done, never sent. */
  | { kind: "noop" }
  /** The user's data on Hydra (sync, social, cloud): never sent. */
  | { kind: "blocked" };

export type LocalRoute =
  | "me"
  | "patchProfile"
  | "profile"
  | "library"
  | "stats"
  | "friends"
  | "souvenirs"
  | "gameAchievements"
  | "listCollections"
  | "createCollection"
  | "renameCollection"
  | "deleteCollection";

const PRIVATE_PREFIXES = [
  "/profile",
  "/users",
  "/auth",
  "/cloud-gifts",
  "/friends",
  "/notifications",
  "/achievements",
];

const isUnder = (path: string, prefix: string) =>
  path === prefix || path.startsWith(`${prefix}/`);

export const classifyRequest = (method: string, url: string): RequestKind => {
  const [pathPart, queryPart = ""] = url.split("?");
  const path = pathPart.replace(/\/+$/, "") || "/";
  const query = new URLSearchParams(queryPart);
  const m = method.toLowerCase();
  const local = (route: LocalRoute): RequestKind => ({
    kind: "local",
    route,
    query,
  });

  if (path === "/profile/me" && m === "get") return local("me");
  if (path === "/profile" && m === "patch") return local("patchProfile");

  const user = /^\/users\/([^/]+)(\/.*)?$/.exec(path);
  if (user && m === "get" && decodeURIComponent(user[1]) === LOCAL_USER_ID) {
    const rest = user[2] ?? "";
    if (rest === "") return local("profile");
    if (rest === "/library") return local("library");
    if (rest === "/stats") return local("stats");
    if (rest === "/friends") return local("friends");
    if (rest === "/souvenirs") return local("souvenirs");
    if (rest === "/games/achievements") return local("gameAchievements");
  }

  if (path === "/profile/games/collections") {
    if (m === "get") return local("listCollections");
    if (m === "post") return local("createCollection");
  }
  const collection = /^\/profile\/games\/collections\/([^/]+)$/.exec(path);
  if (collection) {
    query.set("id", decodeURIComponent(collection[1]));
    if (m === "put" || m === "patch") return local("renameCollection");
    if (m === "delete") return local("deleteCollection");
  }

  // Callers push to Hydra first, then write locally: let the local write happen.
  if (
    m !== "get" &&
    (isUnder(path, "/profile/games") ||
      isUnder(path, "/profile/download-sources"))
  )
    return { kind: "noop" };

  if (PRIVATE_PREFIXES.some((p) => isUnder(path, p)))
    return { kind: "blocked" };
  // Reviews and votes are posted as the user.
  if (/^\/games\/[^/]+\/[^/]+\/reviews/.test(path) && m !== "get")
    return { kind: "blocked" };
  return { kind: "public" };
};

/** The fields of a local library game the profile pages need. */
export interface LocalGame {
  objectId: string;
  shop: string;
  title: string;
  iconUrl: string | null;
  libraryHeroImageUrl: string | null;
  logoImageUrl: string | null;
  libraryImageUrl?: string | null;
  coverImageUrl?: string | null;
  customIconUrl?: string | null;
  customLogoImageUrl?: string | null;
  customHeroImageUrl?: string | null;
  customCoverImageUrl?: string | null;
  playTimeInMilliseconds: number;
  lastTimePlayed: Date | string | null;
  achievementCount?: number;
  unlockedAchievementCount?: number;
  favorite?: boolean;
  isPinned?: boolean;
  pinnedDate?: Date | string | null;
  isHiddenFromOthers?: boolean;
  isDeleted: boolean;
}

export const toUserGame = (g: LocalGame) => ({
  objectId: g.objectId,
  shop: g.shop,
  title: g.title,
  playTimeInSeconds: Math.floor((g.playTimeInMilliseconds ?? 0) / 1000),
  lastTimePlayed: g.lastTimePlayed ? new Date(g.lastTimePlayed) : null,
  unlockedAchievementCount: g.unlockedAchievementCount ?? 0,
  achievementCount: g.achievementCount ?? 0,
  achievementsPointsEarnedSum: 0,
  hasManuallyUpdatedPlaytime: false,
  isFavorite: !!g.favorite,
  isHiddenFromOthers: !!g.isHiddenFromOthers,
  isPinned: !!g.isPinned,
  pinnedDate: g.pinnedDate ? new Date(g.pinnedDate) : null,
  customLibraryImageUrl: g.customCoverImageUrl ?? null,
  customLibraryHeroImageUrl: g.customHeroImageUrl ?? null,
  customLogoImageUrl: g.customLogoImageUrl ?? null,
  customIconUrl: g.customIconUrl ?? null,
  iconUrl: g.iconUrl,
  libraryHeroImageUrl: g.libraryHeroImageUrl,
  logoImageUrl: g.logoImageUrl,
  libraryImageUrl: g.libraryImageUrl ?? g.coverImageUrl ?? null,
  coverImageUrl: g.coverImageUrl ?? null,
  logoPosition: null,
  downloadSources: [],
});

const time = (d: Date | string | null | undefined) =>
  d ? new Date(d).getTime() : 0;

const visible = (games: LocalGame[], shops: string[]) =>
  games.filter(
    (g) => !g.isDeleted && (shops.length === 0 || shops.includes(g.shop))
  );

/** `/users/local/library`: shop filter, sort, take/skip, pinned games apart. */
export const buildLibrary = (games: LocalGame[], query: URLSearchParams) => {
  const list = visible(games, query.getAll("shop"));
  const sortBy = query.get("sortBy") ?? "recently_played";
  const sorters: Record<string, (a: LocalGame, b: LocalGame) => number> = {
    title_asc: (a, b) => a.title.localeCompare(b.title),
    title_desc: (a, b) => b.title.localeCompare(a.title),
    most_played: (a, b) => b.playTimeInMilliseconds - a.playTimeInMilliseconds,
    achievements: (a, b) =>
      (b.unlockedAchievementCount ?? 0) - (a.unlockedAchievementCount ?? 0),
    recently_played: (a, b) => time(b.lastTimePlayed) - time(a.lastTimePlayed),
  };
  const sorted = [...list].sort(sorters[sortBy] ?? sorters.recently_played);
  const take = Number(query.get("take") ?? sorted.length) || sorted.length;
  const skip = Number(query.get("skip") ?? 0) || 0;
  return {
    totalCount: sorted.length,
    library: sorted.slice(skip, skip + take).map(toUserGame),
    pinnedGames: sorted
      .filter((g) => g.isPinned)
      .sort((a, b) => time(b.pinnedDate) - time(a.pinnedDate))
      .map(toUserGame),
  };
};

/** `/users/local/stats`. Percentiles need other players, so they are 0. */
export const buildStats = (games: LocalGame[], query: URLSearchParams) => {
  const list = visible(games, query.getAll("shop"));
  const seconds = list.reduce(
    (sum, g) => sum + Math.floor((g.playTimeInMilliseconds ?? 0) / 1000),
    0
  );
  return {
    libraryCount: list.length,
    friendsCount: 0,
    totalPlayTimeInSeconds: { value: seconds, topPercentile: 0 },
    unlockedAchievementSum: list.reduce(
      (sum, g) => sum + (g.unlockedAchievementCount ?? 0),
      0
    ),
  };
};

/** Profile fields kept on this PC (seeded from the Hydra backup). */
export interface LocalProfile {
  displayName: string;
  bio: string;
  /** `local:` URLs or null. */
  profileImageUrl: string | null;
  backgroundImageUrl: string | null;
  /** Badges earned on Hydra, kept as a record. */
  badges: string[];
  /** The Hydra account this came from, if any. */
  hydraUserId: string | null;
}

export const DEFAULT_LOCAL_PROFILE: LocalProfile = {
  displayName: "Player",
  bio: "",
  profileImageUrl: null,
  backgroundImageUrl: null,
  badges: [],
  hydraUserId: null,
};

const EDITABLE: (keyof LocalProfile)[] = [
  "displayName",
  "bio",
  "profileImageUrl",
  "backgroundImageUrl",
];

/** Applies a `PATCH /profile` body; only the fields a local profile has. */
export const patchLocalProfile = (
  profile: LocalProfile,
  body: unknown
): LocalProfile => {
  const next = { ...profile };
  if (!body || typeof body !== "object") return next;
  for (const key of EDITABLE) {
    const v = (body as Record<string, unknown>)[key];
    if (v === undefined) continue;
    if (key === "displayName" || key === "bio") {
      if (typeof v === "string")
        next[key] = v.slice(0, key === "bio" ? 1000 : 64);
    } else if (
      (key === "profileImageUrl" || key === "backgroundImageUrl") &&
      (v === null || typeof v === "string")
    ) {
      next[key] = v;
    }
  }
  return next;
};

export const buildMe = (p: LocalProfile) => ({
  id: LOCAL_USER_ID,
  username: p.displayName,
  email: null,
  displayName: p.displayName,
  profileImageUrl: p.profileImageUrl,
  backgroundImageUrl: p.backgroundImageUrl,
  profileVisibility: "PRIVATE" as const,
  allowCloudGifts: false,
  souvenirsVisibility: "PRIVATE" as const,
  bio: p.bio,
  workwondersJwt: "",
  subscription: null,
  karma: 0,
  quirks: { backupsPerGameLimit: 0 },
});

export const buildProfile = (p: LocalProfile, games: LocalGame[]) => {
  const list = visible(games, []);
  return {
    ...buildMe(p),
    libraryGames: [],
    recentGames: [...list]
      .filter((g) => g.lastTimePlayed)
      .sort((a, b) => time(b.lastTimePlayed) - time(a.lastTimePlayed))
      .slice(0, 10)
      .map(toUserGame),
    friends: [],
    totalFriends: 0,
    relation: null,
    currentGame: null,
    // Hydra put profile achievement features behind a subscription; locally they are free.
    hasActiveSubscription: true,
    canReceiveCloudGift: false,
    badges: p.badges,
    hasCompletedWrapped2025: false,
  };
};

export interface LocalCollection {
  id: string;
  name: string;
}

/** `GET /profile/games/collections`: counts come from the games' collectionIds. */
export const buildCollections = (
  collections: LocalCollection[],
  games: { isDeleted: boolean; collectionIds?: string[] }[]
) =>
  collections.map((c) => ({
    ...c,
    gamesCount: games.filter(
      (g) => !g.isDeleted && g.collectionIds?.includes(c.id)
    ).length,
  }));

export const collectionName = (body: unknown) => {
  const name = (body as { name?: unknown } | null)?.name;
  if (typeof name !== "string" || !name.trim())
    throw new Error("collection/name-required");
  return name.trim().slice(0, 64);
};

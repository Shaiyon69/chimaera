import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_LOCAL_PROFILE,
  buildLibrary,
  buildProfile,
  buildStats,
  classifyRequest,
  patchLocalProfile,
  type LocalGame,
} from "./local-api-core.js";

const kind = (method: string, url: string) => {
  const r = classifyRequest(method, url);
  return r.kind === "local" ? `local:${r.route}` : r.kind;
};

test("own data is local, other users' and Hydra-only data is blocked", () => {
  assert.equal(kind("get", "/profile/me"), "local:me");
  assert.equal(kind("patch", "/profile"), "local:patchProfile");
  assert.equal(kind("get", "/users/local?shop=steam"), "local:profile");
  assert.equal(kind("get", "/users/local/library?take=12"), "local:library");
  assert.equal(kind("get", "/users/local/stats"), "local:stats");
  assert.equal(kind("get", "/users/local/souvenirs"), "local:souvenirs");
  assert.equal(
    kind("get", "/users/local/games/achievements?shop=steam&objectId=1"),
    "local:gameAchievements"
  );
  assert.equal(kind("get", "/users/abc123"), "blocked");
  assert.equal(kind("get", "/profile/friends"), "blocked");
  assert.equal(kind("post", "/auth/realtime"), "blocked");
  assert.equal(kind("post", "/games/steam/1/reviews"), "blocked");
});

test("public catalogue data passes through", () => {
  assert.equal(kind("get", "/catalogue/search"), "public");
  assert.equal(kind("get", "/games/steam/570/achievements"), "public");
  assert.equal(kind("get", "/games/steam/570/reviews?take=5"), "public");
  assert.equal(kind("get", "/badges?locale=en"), "public");
  assert.equal(kind("get", "/profiles-not-a-prefix"), "public");
});

const game = (over: Partial<LocalGame>): LocalGame => ({
  objectId: "1",
  shop: "steam",
  title: "A",
  iconUrl: null,
  libraryHeroImageUrl: null,
  logoImageUrl: null,
  playTimeInMilliseconds: 0,
  lastTimePlayed: null,
  isDeleted: false,
  ...over,
});

const games = [
  game({
    objectId: "1",
    title: "Bravo",
    playTimeInMilliseconds: 3_600_000,
    lastTimePlayed: "2026-01-02",
    unlockedAchievementCount: 3,
  }),
  game({
    objectId: "2",
    title: "Alpha",
    playTimeInMilliseconds: 60_000,
    lastTimePlayed: "2026-03-01",
    isPinned: true,
  }),
  game({
    objectId: "3",
    title: "Gone",
    isDeleted: true,
    playTimeInMilliseconds: 9e9,
  }),
  game({
    objectId: "4",
    shop: "launchbox",
    title: "Retro",
    playTimeInMilliseconds: 1000,
  }),
];

test("library sorts, pages, filters by shop and skips deleted games", () => {
  const q = (s: string) => new URLSearchParams(s);
  const titles = (s: string) =>
    buildLibrary(games, q(s)).library.map((g) => g.title);
  assert.deepEqual(titles("sortBy=title_asc"), ["Alpha", "Bravo", "Retro"]);
  assert.deepEqual(titles("sortBy=most_played&take=1"), ["Bravo"]);
  assert.deepEqual(titles("sortBy=most_played&take=1&skip=1"), ["Alpha"]);
  assert.deepEqual(titles("shop=launchbox"), ["Retro"]);
  assert.deepEqual(titles(""), ["Alpha", "Bravo", "Retro"]);
  const lib = buildLibrary(games, q(""));
  assert.equal(lib.totalCount, 3);
  assert.deepEqual(
    lib.pinnedGames.map((g) => g.title),
    ["Alpha"]
  );
  assert.equal(lib.library[1].playTimeInSeconds, 3600);
});

test("stats and recent games come from the local library", () => {
  const stats = buildStats(games, new URLSearchParams("shop=steam"));
  assert.equal(stats.libraryCount, 2);
  assert.equal(stats.totalPlayTimeInSeconds.value, 3660);
  assert.equal(stats.unlockedAchievementSum, 3);
  const profile = buildProfile(DEFAULT_LOCAL_PROFILE, games);
  assert.deepEqual(
    profile.recentGames.map((g) => g.title),
    ["Alpha", "Bravo"]
  );
  assert.equal(profile.id, "local");
});

test("profile patch keeps only local fields and clips text", () => {
  const next = patchLocalProfile(DEFAULT_LOCAL_PROFILE, {
    displayName: "x".repeat(100),
    bio: "hi",
    profileImageUrl: "local:C:/a.png",
    profileVisibility: "PUBLIC",
    badges: ["hack"],
  });
  assert.equal(next.displayName.length, 64);
  assert.equal(next.bio, "hi");
  assert.equal(next.profileImageUrl, "local:C:/a.png");
  assert.deepEqual(next.badges, []);
  assert.equal("profileVisibility" in next, false);
});

test("own game pushes are no-ops, collections are local", () => {
  assert.equal(kind("put", "/profile/games/steam/1/favorite"), "noop");
  assert.equal(kind("put", "/profile/games/achievements"), "noop");
  assert.equal(kind("post", "/profile/games/batch"), "noop");
  assert.equal(kind("delete", "/profile/download-sources?url=x"), "noop");
  assert.equal(kind("get", "/profile/games"), "blocked");
  assert.equal(
    kind("get", "/profile/games/collections"),
    "local:listCollections"
  );
  assert.equal(
    kind("post", "/profile/games/collections"),
    "local:createCollection"
  );
  const rename = classifyRequest("put", "/profile/games/collections/c%201");
  assert.equal(rename.kind === "local" && rename.query.get("id"), "c 1");
  assert.equal(
    kind("delete", "/profile/games/collections/c1"),
    "local:deleteCollection"
  );
});

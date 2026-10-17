import { randomUUID } from "node:crypto";
import type { GameShop } from "@types";
import { UserNotLoggedInError } from "@shared";
import {
  db,
  gamesArtworkSelectionSublevel,
  gamesShopAssetsSublevel,
  gamesSublevel,
} from "@main/level";
import { composeAssetsWithArtwork } from "@shared";
import { AchievementMemoryStore } from "../achievements/achievement-memory-store";
import {
  DEFAULT_LOCAL_PROFILE,
  buildLibrary,
  buildMe,
  buildProfile,
  buildCollections,
  buildStats,
  classifyRequest,
  collectionName,
  patchLocalProfile,
  type LocalCollection,
  type LocalGame,
  type LocalProfile,
} from "./local-api-core";

const LOCAL_PROFILE_KEY = "localProfile";
const LOCAL_COLLECTIONS_KEY = "localCollections";

/** Library games with their catalogue artwork, composed as the library page does. */
const loadGamesWithArtwork = async (): Promise<LocalGame[]> => {
  const entries = await gamesSublevel.iterator().all();
  const keys = entries.map(([key]) => key);
  const [assets, selections] = await Promise.all([
    gamesShopAssetsSublevel.getMany(keys),
    gamesArtworkSelectionSublevel.getMany(keys),
  ]);
  return entries.map(([, game], index) => {
    const composed = composeAssetsWithArtwork(
      assets[index] ?? null,
      selections[index]
    );
    // Only fill in what the catalogue has; keep the game's own art otherwise.
    const present = Object.fromEntries(
      Object.entries(composed ?? {}).filter(([, value]) => value != null)
    );
    return {
      ...game,
      ...present,
      title: composed?.title || game.title,
    } as LocalGame;
  });
};

/** Marker for "send this one to Hydra". */
export const PASS_THROUGH = Symbol("pass-through");

export const LocalApi = {
  /** Always on: Chimaera has no Hydra sign-in, so the user's data is local. */
  enabled: true as const,

  async getProfile(): Promise<LocalProfile> {
    const stored = await db
      .get<string, LocalProfile>(LOCAL_PROFILE_KEY, { valueEncoding: "json" })
      .catch(() => null);
    return { ...DEFAULT_LOCAL_PROFILE, ...stored };
  },

  async saveProfile(profile: LocalProfile) {
    await db.put<string, LocalProfile>(LOCAL_PROFILE_KEY, profile, {
      valueEncoding: "json",
    });
  },

  async getCollections(): Promise<LocalCollection[]> {
    return db
      .get<string, LocalCollection[]>(LOCAL_COLLECTIONS_KEY, {
        valueEncoding: "json",
      })
      .then((v) => v ?? [])
      .catch(() => []);
  },

  async saveCollections(collections: LocalCollection[]) {
    await db.put<string, LocalCollection[]>(
      LOCAL_COLLECTIONS_KEY,
      collections,
      { valueEncoding: "json" }
    );
  },

  /**
   * Answers a request locally, or returns PASS_THROUGH for public data. The user's
   * Hydra data is never requested: those calls fail as if signed out.
   */
  async handle(method: string, url: string, body?: unknown, params?: unknown) {
    const withParams =
      params && typeof params === "object"
        ? `${url}${url.includes("?") ? "&" : "?"}${new URLSearchParams(
            Object.entries(params as Record<string, unknown>).flatMap(
              ([k, v]) =>
                v == null
                  ? []
                  : Array.isArray(v)
                    ? v.map((item) => [k, String(item)])
                    : [[k, String(v)]]
            )
          ).toString()}`
        : url;
    const request = classifyRequest(method, withParams);
    if (request.kind === "public") return PASS_THROUGH;
    if (request.kind === "noop") return {};
    if (request.kind === "blocked") throw new UserNotLoggedInError();

    const { route, query } = request;
    if (route === "me") return buildMe(await this.getProfile());
    if (route === "patchProfile") {
      const next = patchLocalProfile(await this.getProfile(), body);
      await this.saveProfile(next);
      return buildMe(next);
    }
    if (route === "friends") return { totalFriends: 0, friends: [] };
    if (route === "souvenirs")
      return { items: [], total: 0, hasReachedLimit: true, hiddenReason: null };
    if (route === "gameAchievements") {
      const entry = AchievementMemoryStore.get(
        query.get("shop") as GameShop,
        query.get("objectId") ?? ""
      );
      const unlocked = new Map(
        (entry?.unlockedAchievements ?? []).map((u) => [
          u.name.toUpperCase(),
          u,
        ])
      );
      return (entry?.achievements ?? []).map((a) => {
        const u = unlocked.get((a.name ?? "").toUpperCase());
        return {
          ...a,
          unlocked: !!u,
          unlockTime: u?.unlockTime ?? null,
          imageUrl: null,
        };
      });
    }

    if (route === "createCollection") {
      const created = { id: randomUUID(), name: collectionName(body) };
      await this.saveCollections([...(await this.getCollections()), created]);
      return { ...created, gamesCount: 0 };
    }
    if (route === "renameCollection") {
      const id = query.get("id");
      const name = collectionName(body);
      await this.saveCollections(
        (await this.getCollections()).map((c) =>
          c.id === id ? { ...c, name } : c
        )
      );
      return { id, name };
    }
    if (route === "deleteCollection") {
      const id = query.get("id");
      await this.saveCollections(
        (await this.getCollections()).filter((c) => c.id !== id)
      );
      return {};
    }

    const games = await loadGamesWithArtwork();
    if (route === "listCollections")
      return buildCollections(await this.getCollections(), games);
    if (route === "library") return buildLibrary(games, query);
    if (route === "stats") return buildStats(games, query);
    return buildProfile(await this.getProfile(), games);
  },
};

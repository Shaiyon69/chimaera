import type { GameShop } from "@types";
import { levelKeys, unlockedAchievementsSublevel } from "@main/level";
import { achievementsLogger } from "../logger";
import { AchievementMemoryStore } from "./achievement-memory-store";

/** Seeds the memory store from disk, then writes every unlock change back. */
export const loadPersistedUnlockedAchievements = async () => {
  for await (const [key, unlocked] of unlockedAchievementsSublevel.iterator()) {
    const sep = key.indexOf(":");
    const shop = key.slice(0, sep) as GameShop;
    const objectId = key.slice(sep + 1);
    const current = AchievementMemoryStore.get(shop, objectId);
    AchievementMemoryStore.set(shop, objectId, {
      achievements: current?.achievements ?? [],
      ...current,
      unlockedAchievements: unlocked,
    });
  }

  AchievementMemoryStore.persistWith((shop, objectId, unlocked) => {
    unlockedAchievementsSublevel
      .put(levelKeys.game(shop, objectId), unlocked)
      .catch((error) =>
        achievementsLogger.error("Failed to persist unlocks", error)
      );
  });
};

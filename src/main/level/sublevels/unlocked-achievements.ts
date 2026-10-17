import type { UnlockedAchievement } from "@types";

import { db } from "../level";

/** Unlocks per game (`shop:objectId`), so they survive without Hydra. */
export const unlockedAchievementsSublevel = db.sublevel<
  string,
  UnlockedAchievement[]
>("unlockedAchievements", {
  valueEncoding: "json",
});

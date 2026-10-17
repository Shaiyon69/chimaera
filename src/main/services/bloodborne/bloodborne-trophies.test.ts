import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  launchEnvFromSettings,
  parseTrophyId,
  trophyAchievementName,
} from "./bloodborne-trophies-core.js";

describe("bloodborne trophies", () => {
  it("parses the runtime trophy line", () => {
    assert.equal(parseTrophyId("Runtime: trophy 12 unlocked"), 12);
    assert.equal(parseTrophyId("Runtime: loading"), null);
  });

  it("slugs names like the catalogue", () => {
    assert.equal(trophyAchievementName("Yharnam Sunrise"), "YHARNAM_SUNRISE");
  });

  it("maps launcher settings to run.bat env", () => {
    assert.deepEqual(
      launchEnvFromSettings({
        eboot: "C:\\G\\CUSA03173\\eboot.bin",
        fps: "60",
      }),
      { BB_GAME_DIR: "C:\\G\\CUSA03173", BB_FPS: "60" }
    );
    assert.deepEqual(launchEnvFromSettings({ fps: "weird" }), {});
  });
});

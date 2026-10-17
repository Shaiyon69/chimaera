import assert from "node:assert/strict";
import { describe, it } from "node:test";

// @ts-ignore The Node ESM test runner requires the source extension.
import * as categorySelectionModule from "./category-selection.ts";

const {
  getAvailableGameSettingsCategory,
  shouldInitializeGameSettingsCategory,
} = categorySelectionModule;

describe("game options category selection", () => {
  it("initializes when the modal opens", () => {
    assert.equal(
      shouldInitializeGameSettingsCategory(
        { visible: false, initialCategory: "general" },
        { visible: true, initialCategory: "general" }
      ),
      true
    );
  });

  it("initializes when the requested category changes while open", () => {
    assert.equal(
      shouldInitializeGameSettingsCategory(
        { visible: true, initialCategory: "general" },
        { visible: true, initialCategory: "assets" }
      ),
      true
    );
  });

  it("does not initialize again while the modal remains open", () => {
    assert.equal(
      shouldInitializeGameSettingsCategory(
        { visible: true, initialCategory: "general" },
        { visible: true, initialCategory: "general" }
      ),
      false
    );
  });

  it("preserves a manually selected category when availability changes", () => {
    assert.equal(
      getAvailableGameSettingsCategory("assets", {
        showDownloadSettings: true,
        showOptiscalerSettings: true,
      }),
      "assets"
    );
  });

  it("falls back when the selected category is unavailable", () => {
    assert.equal(
      getAvailableGameSettingsCategory("downloads", {
        showDownloadSettings: false,
        showOptiscalerSettings: true,
      }),
      "general"
    );
    assert.equal(
      getAvailableGameSettingsCategory("optiscaler", {
        showDownloadSettings: true,
        showOptiscalerSettings: false,
      }),
      "general"
    );
  });
});

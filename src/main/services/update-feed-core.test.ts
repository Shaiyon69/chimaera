import assert from "node:assert/strict";
import test from "node:test";
import { pickUpdateTag } from "./update-feed-core.js";

const release = (
  tag_name: string,
  assets: string[],
  flags: { draft?: boolean; prerelease?: boolean } = {}
) => ({
  tag_name,
  draft: false,
  prerelease: false,
  ...flags,
  assets: assets.map((name) => ({ name })),
});

test("skips a newer data-only release that has no manifest", () => {
  const releases = [
    release("bloodborne-port-abc", ["bloodborne-port.zip"]),
    release("v1.0.1", ["latest.yml", "setup.exe"]),
    release("v1.0.0", ["latest.yml"]),
  ];
  assert.equal(pickUpdateTag(releases, "latest.yml"), "v1.0.1");
});

test("skips drafts and prereleases even when they carry the manifest", () => {
  const releases = [
    release("v2.0.0", ["latest.yml"], { draft: true }),
    release("v1.1.0-beta.1", ["latest.yml"], { prerelease: true }),
    release("v1.0.0", ["latest.yml"]),
  ];
  assert.equal(pickUpdateTag(releases, "latest.yml"), "v1.0.0");
});

test("returns null when no release qualifies", () => {
  assert.equal(pickUpdateTag([], "latest.yml"), null);
  assert.equal(
    pickUpdateTag([release("v1.0.0", ["setup.exe"])], "latest.yml"),
    null
  );
});

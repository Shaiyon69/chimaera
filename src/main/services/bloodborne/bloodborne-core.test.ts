import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { isPortDir, pickPortRelease } from "./bloodborne-core.js";

test("isPortDir needs run.bat and out/bbport.exe", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bb-port-"));
  try {
    assert.equal(isPortDir(dir), false);
    fs.writeFileSync(path.join(dir, "run.bat"), "");
    assert.equal(isPortDir(dir), false);
    fs.mkdirSync(path.join(dir, "out"));
    fs.writeFileSync(path.join(dir, "out", "bbport.exe"), "");
    assert.equal(isPortDir(dir), true);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("pickPortRelease takes the release zip and its digest", () => {
  const sha = "a".repeat(64);
  const release = {
    tag_name: "v0.5.1",
    assets: [
      { name: "notes.txt", browser_download_url: "https://x/notes" },
      {
        name: "port_v0.5.1_release.zip",
        browser_download_url: "https://x/zip",
        digest: `sha256:${sha}`,
      },
    ],
  };
  assert.deepEqual(pickPortRelease(release), {
    tag: "v0.5.1",
    url: "https://x/zip",
    sha256: sha,
  });
  assert.equal(pickPortRelease({ ...release, assets: [] }), null);
  assert.equal(
    pickPortRelease({
      tag_name: "v1",
      assets: [{ name: "a_release.zip", browser_download_url: "u" }],
    }),
    null
  );
  assert.equal(pickPortRelease(null), null);
});

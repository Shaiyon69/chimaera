import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildLaunchEnv,
  DEFAULT_BB_SETTINGS,
  findGameDir,
  gameDirCandidates,
  isModFolder,
  isSafeModName,
  listMods,
  toModsConfig,
  parseCaps,
  readLauncherSettings,
  resolvePortDir,
  toLauncherSettingsJson,
  resolveGameDir,
} from "./bloodborne-core.js";

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "bb-"));

test("readLauncherSettings migrates legacy values and rejects junk", () => {
  const s = readLauncherSettings({
    res: "Default (1080p)",
    fullscreen: true,
    fps: "bogus",
    enabled_patches: ["a", 1],
  });
  assert.equal(s.res, DEFAULT_BB_SETTINGS.res);
  assert.equal(s.windowMode, "Fullscreen");
  assert.equal(s.fps, "uncap");
  assert.deepEqual(s.enabledPatches, ["a"]);
  assert.deepEqual(readLauncherSettings(null), DEFAULT_BB_SETTINGS);
});

test("buildLaunchEnv sets and removes vars", () => {
  const env = buildLaunchEnv(
    {
      ...DEFAULT_BB_SETTINGS,
      fps: "60",
      featOverlay: false,
      enabledPatches: ["b", "a"],
    },
    "C:\\g",
    { BB_HUD: "1", BB_UPSCALER: "fsr3" }
  );
  assert.equal(env.BB_GAME_DIR, "C:\\g");
  assert.equal(env.BB_FPS, "60");
  assert.equal(env.BB_OVERLAY, "0");
  assert.equal(env.BB_PATCHES, "a;b");
  assert.equal(env.BB_HUD, undefined);
  assert.equal(env.BB_UPSCALER, undefined);
  assert.equal(env.BB_FULLSCREEN, "0");
});

test("resolveGameDir accepts folder or eboot.bin, rejects others", () => {
  const dir = tmp();
  assert.equal(resolveGameDir(dir), null);
  fs.writeFileSync(path.join(dir, "eboot.bin"), "");
  assert.equal(resolveGameDir(dir), dir);
  assert.equal(resolveGameDir(`"${path.join(dir, "eboot.bin")}"`), dir);
  assert.equal(resolveGameDir(""), null);
});

test("findGameDir locates CUSA03173 beside the port and under search roots", () => {
  const root = tmp();
  const port = path.join(root, "port");
  fs.mkdirSync(port);
  const nested = path.join(root, "dl", "x", "CUSA03173");
  fs.mkdirSync(nested, { recursive: true });
  fs.writeFileSync(path.join(nested, "eboot.bin"), "");

  assert.equal(findGameDir(gameDirCandidates(port, [], [])), null);
  assert.equal(
    findGameDir(gameDirCandidates(port, [path.join(root, "dl")], [])),
    nested
  );
});

test("toLauncherSettingsJson round-trips through readLauncherSettings", () => {
  const s = {
    ...DEFAULT_BB_SETTINGS,
    eboot: "C:\\g",
    fps: "60",
    windowMode: "Borderless",
    enabledPatches: ["Skip Intro"],
  };
  assert.deepEqual(readLauncherSettings(toLauncherSettingsJson(s)), s);
});

test("parseCaps reads key=1/0 lines", () => {
  assert.deepEqual(parseCaps("fsr4=1\nfsr411=0\n"), {
    fsr4: true,
    fsr411: false,
  });
});

test("resolvePortDir prefers a port installed beside the game folder", () => {
  const root = tmp();
  const bundled = path.join(root, "bundled");
  const install = path.join(root, "install");
  const game = path.join(install, "CUSA03173");
  fs.mkdirSync(game, { recursive: true });

  assert.equal(resolvePortDir(bundled, game), bundled);
  assert.equal(resolvePortDir(bundled, null), bundled);

  fs.mkdirSync(path.join(install, "out"));
  fs.writeFileSync(path.join(install, "run.bat"), "");
  assert.equal(resolvePortDir(bundled, game), bundled);

  fs.writeFileSync(path.join(install, "out", "bbport.exe"), "");
  assert.equal(resolvePortDir(bundled, game), install);
});

const mkdirs = (root: string, ...dirs: string[]) =>
  dirs.forEach((d) => fs.mkdirSync(path.join(root, d), { recursive: true }));

test("isModFolder accepts the layouts mods.py accepts", () => {
  const root = tmp();
  mkdirs(
    root,
    "a/dvdroot_ps4/chr",
    "b/APP0/dvdroot_ps4",
    "c/chr",
    "d/Wrapper/chr",
    "e/other_stuff",
    "f"
  );
  fs.writeFileSync(path.join(root, "d", "readme.txt"), "x");
  const ok = (n: string) => isModFolder(path.join(root, n));
  assert.deepEqual(["a", "b", "c", "d"].map(ok), [true, true, true, true]);
  assert.deepEqual(["e", "f", "missing"].map(ok), [false, false, false]);
});

test("listMods keeps order, appends new folders, marks disabled", () => {
  const root = tmp();
  mkdirs(root, "Zed/chr", "Alpha/chr", "Mid/chr", "junk");
  assert.deepEqual(listMods(root, null), [
    { name: "Alpha", enabled: true },
    { name: "Mid", enabled: true },
    { name: "Zed", enabled: true },
  ]);
  const mods = listMods(root, {
    order: ["Zed", "Gone", "Alpha"],
    disabled: ["Alpha"],
  });
  assert.deepEqual(mods, [
    { name: "Zed", enabled: true },
    { name: "Alpha", enabled: false },
    { name: "Mid", enabled: true },
  ]);
  assert.deepEqual(toModsConfig(mods), {
    order: ["Zed", "Alpha", "Mid"],
    disabled: ["Alpha"],
  });
});

test("isSafeModName rejects path tricks", () => {
  assert.equal(isSafeModName("BBEnhanced"), true);
  for (const bad of ["", "..", ".", "a/b", "..\\x", "../x"])
    assert.equal(isSafeModName(bad), false, bad);
});

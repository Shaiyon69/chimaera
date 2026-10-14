import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  configureIni,
  iniGetSet,
  readConfig,
  writeConfigValue,
} from "./ini.js";
import { install, readMarker, uninstall } from "./install.js";
import { detectAnticheat, detectApi, gameRootFromExeDir } from "./detect.js";

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "chimaera-os-"));

const snapshot = (root: string): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const e of fs.readdirSync(root, {
    recursive: true,
    withFileTypes: true,
  })) {
    if (!e.isFile()) continue;
    const p = path.join(e.parentPath, e.name);
    out[path.relative(root, p)] = fs.readFileSync(p, "latin1");
  }
  return out;
};

const makePayload = (dir: string) => {
  fs.mkdirSync(path.join(dir, "D3D12_Optiscaler"), { recursive: true });
  fs.writeFileSync(path.join(dir, "OptiScaler.dll"), "dll");
  fs.writeFileSync(
    path.join(dir, "OptiScaler.ini"),
    "Fsr4Update=auto\nLogLevel=auto\n"
  );
  fs.writeFileSync(path.join(dir, "setup_windows.bat"), "skip");
  fs.writeFileSync(path.join(dir, "D3D12_Optiscaler", "x.dll"), "x");
};

test("iniGetSet reads, sets and appends", () => {
  const ini = path.join(tmp(), "a.ini");
  fs.writeFileSync(ini, "[A]\nK=auto\n");
  assert.equal(iniGetSet(ini, "K"), "auto");
  iniGetSet(ini, "K", "true");
  iniGetSet(ini, "New", "1");
  assert.equal(fs.readFileSync(ini, "utf-8"), "[A]\nK=true\nNew=1\n");
});

test("configureIni only changes keys still set to auto", () => {
  const ini = path.join(tmp(), "a.ini");
  fs.writeFileSync(
    ini,
    "Fsr4Update=false\nFsr4ForceEnableInt8=auto\nDx12Upscaler=auto\nLogToFile=auto\nLogLevel=1\n"
  );
  const done = configureIni(ini, "dx12", true);
  assert.deepEqual(
    done.map(([k]) => k),
    ["Fsr4ForceEnableInt8", "Dx12Upscaler", "LogToFile"]
  );
  assert.equal(iniGetSet(ini, "Fsr4Update"), "false");
  assert.equal(iniGetSet(ini, "LogLevel"), "1");
});

test("install then uninstall restores the game folder exactly", () => {
  const payload = tmp();
  makePayload(payload);
  const game = tmp();
  fs.writeFileSync(path.join(game, "game.exe"), "exe");
  fs.writeFileSync(path.join(game, "dxgi.dll"), "original");
  const before = snapshot(game);

  install({ payload, exeDir: game, proxy: "dxgi.dll", tag: "v1" });
  assert.equal(fs.readFileSync(path.join(game, "dxgi.dll"), "utf-8"), "dll");
  assert.ok(!fs.existsSync(path.join(game, "setup_windows.bat")));
  assert.deepEqual(readMarker(game)?.backed_up, ["dxgi.dll"]);

  install({ payload, exeDir: game, proxy: "winmm.dll", tag: "v2" }); // update
  assert.equal(
    fs.readFileSync(path.join(game, "dxgi.dll"), "utf-8"),
    "original"
  );

  uninstall(game);
  assert.deepEqual(snapshot(game), before);
});

test("failed install rolls back to the original files", () => {
  const payload = tmp();
  makePayload(payload);
  const game = tmp();
  fs.writeFileSync(path.join(game, "dxgi.dll"), "original");
  fs.writeFileSync(path.join(game, "game.exe"), "exe");
  const before = snapshot(game);

  assert.throws(() =>
    install({
      payload,
      exeDir: game,
      proxy: "dxgi.dll",
      tag: "v1",
      fsr4Dll: path.join(game, "missing.dll"),
    })
  );
  assert.deepEqual(snapshot(game), before);
});

test("detectApi and detectAnticheat", () => {
  const dir = tmp();
  const exe = path.join(dir, "g.exe");
  fs.writeFileSync(
    exe,
    Buffer.concat([Buffer.from("MZ..."), Buffer.from("D3D11.dll", "utf16le")])
  );
  assert.equal(detectApi(exe), "dx11");
  assert.equal(detectApi(null), "unknown");
  assert.equal(detectAnticheat(dir), null);
  fs.mkdirSync(path.join(dir, "EasyAntiCheat"));
  assert.equal(detectAnticheat(dir), "EasyAntiCheat");
});

test("gameRootFromExeDir climbs out of Unreal Binaries/Win64", () => {
  const sep = path.sep;
  const root = ["C:", "Games", "Foo"].join(sep);
  assert.equal(
    gameRootFromExeDir([root, "Foo", "Binaries", "Win64"].join(sep)),
    root
  );
  assert.equal(gameRootFromExeDir(root), root);
});

test("readConfig lists only fields whose key exists in the ini", () => {
  const ini = path.join(tmp(), "c.ini");
  fs.writeFileSync(ini, "[A]\nDx12Upscaler=auto\nSharpness=0.8\nOther=1\n");
  const fields = readConfig(ini);
  assert.deepEqual(
    fields.map((f) => [f.key, f.value]),
    [
      ["Dx12Upscaler", "auto"],
      ["Sharpness", "0.8"],
    ]
  );
});

test("writeConfigValue validates key and value", () => {
  const ini = path.join(tmp(), "w.ini");
  fs.writeFileSync(ini, "Dx12Upscaler=auto\nSharpness=0.8\nOther=1\n");
  writeConfigValue(ini, "Dx12Upscaler", "xess");
  writeConfigValue(ini, "Sharpness", "0.5");
  assert.equal(iniGetSet(ini, "Dx12Upscaler"), "xess");
  assert.equal(iniGetSet(ini, "Sharpness"), "0.5");
  assert.throws(() => writeConfigValue(ini, "Other", "2"));
  assert.throws(() => writeConfigValue(ini, "Dx12Upscaler", "bogus"));
  assert.throws(() => writeConfigValue(ini, "Sharpness", "5"));
  assert.throws(() => writeConfigValue(ini, "Sharpness", "1\nEvil=1"));
  assert.equal(iniGetSet(ini, "Other"), "1");
});

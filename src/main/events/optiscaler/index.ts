import path from "node:path";
import fs from "node:fs";
import { registerEvent } from "../register-event";
import { db, gamesSublevel, levelKeys } from "@main/level";
import type { GameShop, UserPreferences } from "@types";
import { fetchLatest } from "@main/services/optiscaler/release";
import {
  install,
  uninstall,
  readMarker,
  PROXIES,
} from "@main/services/optiscaler/install";
import { detectAnticheat, detectApi } from "@main/services/optiscaler/detect";
import { loadedState } from "@main/services/optiscaler/status";

const getContext = async (shop: GameShop, objectId: string) => {
  const game = await gamesSublevel.get(levelKeys.game(shop, objectId));
  if (!game?.executablePath) throw new Error("Game has no executable path");
  const exeDir = path.dirname(game.executablePath);
  return { exePath: game.executablePath, exeDir };
};

const getStatus = async (
  _event: Electron.IpcMainInvokeEvent,
  shop: GameShop,
  objectId: string
) => {
  const { exePath, exeDir } = await getContext(shop, objectId);
  const marker = readMarker(exeDir);
  return {
    installed: !!marker,
    version: marker?.version ?? null,
    proxy: marker?.proxy ?? null,
    loaded: marker ? loadedState(exeDir) : null,
    api: detectApi(exePath),
    anticheat: detectAnticheat(exeDir),
    proxies: PROXIES,
  };
};

const installOptiscaler = async (
  _event: Electron.IpcMainInvokeEvent,
  shop: GameShop,
  objectId: string,
  proxy: string
) => {
  if (!PROXIES.includes(proxy)) throw new Error(`Invalid proxy: ${proxy}`);
  const { exePath, exeDir } = await getContext(shop, objectId);
  const prefs = await db.get<string, UserPreferences | null>(
    levelKeys.userPreferences,
    { valueEncoding: "json" }
  );
  const fsr4 = prefs?.optiscalerFsr4DllPath;
  const { tag, payload } = await fetchLatest(!!prefs?.optiscalerNightly);
  install({
    payload,
    exeDir,
    proxy,
    tag,
    fsr4Dll: fsr4 && fs.existsSync(fsr4) ? fsr4 : null,
    api: detectApi(exePath),
  });
  return { version: tag };
};

const uninstallOptiscaler = async (
  _event: Electron.IpcMainInvokeEvent,
  shop: GameShop,
  objectId: string
) => {
  const { exeDir } = await getContext(shop, objectId);
  uninstall(exeDir);
};

registerEvent("getOptiscalerStatus", getStatus);
registerEvent("installOptiscaler", installOptiscaler);
registerEvent("uninstallOptiscaler", uninstallOptiscaler);

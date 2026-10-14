import path from "node:path";
import fs from "node:fs";
import { registerEvent } from "../register-event";
import { db, gamesSublevel, levelKeys } from "@main/level";
import type { GameShop, UserPreferences } from "@types";
import { fetchLatest, fetchLatestTag } from "@main/services/optiscaler/release";
import {
  install,
  uninstall,
  readMarker,
  PROXIES,
} from "@main/services/optiscaler/install";
import {
  detectAnticheat,
  detectApi,
  gameRootFromExeDir,
} from "@main/services/optiscaler/detect";
import { readConfig, writeConfigValue } from "@main/services/optiscaler/ini";
import { loadedState } from "@main/services/optiscaler/status";

const getContext = async (shop: GameShop, objectId: string) => {
  const game = await gamesSublevel.get(levelKeys.game(shop, objectId));
  if (!game?.executablePath) throw new Error("Game has no executable path");
  const exeDir = path.dirname(game.executablePath);
  return { exePath: game.executablePath, exeDir };
};

const getPrefs = () =>
  db.get<string, UserPreferences | null>(levelKeys.userPreferences, {
    valueEncoding: "json",
  });

/** Chosen FSR4 DLL if it still exists on disk. */
const resolveFsr4Dll = (prefs: UserPreferences | null): string | null => {
  const dll =
    prefs?.optiscalerFsr4Variant === "lossy"
      ? prefs.optiscalerFsr4LossyPath
      : (prefs?.optiscalerFsr4ExactPath ?? prefs?.optiscalerFsr4DllPath);
  return dll && fs.existsSync(dll) ? dll : null;
};

const getStatus = async (
  _event: Electron.IpcMainInvokeEvent,
  shop: GameShop,
  objectId: string,
  proxy?: string
) => {
  const { exePath, exeDir } = await getContext(shop, objectId);
  const prefs = await getPrefs();
  const marker = readMarker(exeDir);
  const latestTag = await fetchLatestTag(!!prefs?.optiscalerNightly);
  return {
    installed: !!marker,
    version: marker?.version ?? null,
    proxy: marker?.proxy ?? null,
    loaded: marker ? loadedState(exeDir) : null,
    api: detectApi(exePath),
    anticheat: detectAnticheat(gameRootFromExeDir(exeDir)),
    proxies: PROXIES,
    latestTag,
    updateAvailable: !!marker && !!latestTag && marker.version !== latestTag,
    fsr4Available: !!resolveFsr4Dll(prefs),
    // A foreign DLL under the chosen proxy name would be moved to backup.
    proxyConflict:
      !marker && proxy && fs.existsSync(path.join(exeDir, proxy))
        ? proxy
        : null,
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
  const prefs = await getPrefs();
  const { tag, payload } = await fetchLatest(!!prefs?.optiscalerNightly);
  install({
    payload,
    exeDir,
    proxy,
    tag,
    fsr4Dll: resolveFsr4Dll(prefs),
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

const iniPathFor = async (shop: GameShop, objectId: string) => {
  const { exeDir } = await getContext(shop, objectId);
  if (!readMarker(exeDir)) throw new Error("OptiScaler is not installed");
  return path.join(exeDir, "OptiScaler.ini");
};

registerEvent(
  "getOptiscalerConfig",
  async (_event, shop: GameShop, objectId: string) => {
    const iniPath = await iniPathFor(shop, objectId);
    return fs.existsSync(iniPath) ? readConfig(iniPath) : [];
  }
);

registerEvent(
  "setOptiscalerConfig",
  async (
    _event,
    shop: GameShop,
    objectId: string,
    key: string,
    value: string
  ) => {
    writeConfigValue(await iniPathFor(shop, objectId), key, value);
  }
);

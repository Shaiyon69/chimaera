import path from "node:path";
import fs from "node:fs";
import { registerEvent } from "../register-event";
import type { GameShop } from "@types";
import { fetchLatest, fetchLatestTag } from "@main/services/optiscaler/release";
import {
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
import {
  cachedFsr4Dll,
  ensureFsr4Dlls,
} from "@main/services/optiscaler/fsr4-dll";
import {
  detectGpu,
  getContext,
  getPrefs,
  installForGame,
  resolveFsr4Dll,
  resolveFsr4Gpu,
} from "@main/services/optiscaler/game-install";

const getStatus = async (
  _event: Electron.IpcMainInvokeEvent,
  shop: GameShop,
  objectId: string,
  proxy?: string
) => {
  const { exePath, exeDir } = await getContext(shop, objectId);
  const prefs = await getPrefs();
  const marker = readMarker(exeDir);
  const gpu = await resolveFsr4Gpu(prefs);
  // Warm the cache so the first install already has the DLLs.
  if (gpu !== "native") void ensureFsr4Dlls(gpu);
  void fetchLatest(!!prefs?.optiscalerNightly).catch(() => {});
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
    fsr4Available: gpu === "native" || !!resolveFsr4Dll(prefs, gpu),
    fsr4Gpu: gpu,
    fsr4Variant: prefs?.optiscalerFsr4Variant === "lossy" ? "lossy" : "exact",
    // A foreign DLL under the chosen proxy name would be moved to backup.
    proxyConflict:
      !marker && proxy && fs.existsSync(path.join(exeDir, proxy))
        ? proxy
        : null,
  };
};

const installOptiscaler = (
  _event: Electron.IpcMainInvokeEvent,
  shop: GameShop,
  objectId: string,
  proxy: string
) => installForGame(shop, objectId, proxy);

const uninstallOptiscaler = async (
  _event: Electron.IpcMainInvokeEvent,
  shop: GameShop,
  objectId: string
) => {
  const { exeDir } = await getContext(shop, objectId);
  uninstall(exeDir);
};

registerEvent("getOptiscalerGpu", async () => {
  const prefs = await getPrefs();
  const effective = await resolveFsr4Gpu(prefs);
  // Fetch now so settings can show the DLLs that install will use.
  if (effective !== "native") await ensureFsr4Dlls(effective);
  return {
    detected: await detectGpu(),
    effective,
    autoDlls: {
      exact: effective === "native" ? null : cachedFsr4Dll(effective, "exact"),
      lossy: effective === "native" ? null : cachedFsr4Dll(effective, "lossy"),
    },
  };
});
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

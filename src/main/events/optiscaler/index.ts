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
import {
  cachedFsr4Dll,
  ensureFsr4Dlls,
} from "@main/services/optiscaler/fsr4-dll";
import {
  classifyGpus,
  detectGpuNames,
  type Fsr4Gpu,
} from "@main/services/optiscaler/gpu";

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

const detectGpu = async () => classifyGpus(await detectGpuNames());

/** Manual override from settings, else the detected GPU. */
const resolveFsr4Gpu = async (
  prefs: UserPreferences | null
): Promise<Fsr4Gpu> => {
  const chosen = prefs?.optiscalerFsr4Gpu;
  return chosen && chosen !== "auto" ? chosen : detectGpu();
};

/** User-chosen FSR4 DLL if it still exists, else the auto-downloaded one. Native GPUs need none. */
const resolveFsr4Dll = (
  prefs: UserPreferences | null,
  gpu: Fsr4Gpu
): string | null => {
  if (gpu === "native") return null;
  const variant = prefs?.optiscalerFsr4Variant === "lossy" ? "lossy" : "exact";
  const chosen =
    variant === "lossy"
      ? prefs?.optiscalerFsr4LossyPath
      : (prefs?.optiscalerFsr4ExactPath ?? prefs?.optiscalerFsr4DllPath);
  return chosen && fs.existsSync(chosen) ? chosen : cachedFsr4Dll(gpu, variant);
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
  const gpu = await resolveFsr4Gpu(prefs);
  // Warm the cache so the first install already has the DLLs.
  if (gpu !== "native") void ensureFsr4Dlls(gpu);
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
  const gpu = await resolveFsr4Gpu(prefs);
  if (gpu !== "native") await ensureFsr4Dlls(gpu);
  const fsr4Dll = resolveFsr4Dll(prefs, gpu);
  install({
    payload,
    exeDir,
    proxy,
    tag,
    fsr4Dll,
    fsr4Mode: gpu === "native" ? "native" : fsr4Dll ? "dll" : null,
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

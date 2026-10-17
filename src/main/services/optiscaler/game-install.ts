import path from "node:path";
import fs from "node:fs";
import { isWindowsBatchFile } from "@main/helpers/windows-batch-command";
import { logger } from "@main/services/logger";
import { db, gamesSublevel, levelKeys } from "@main/level";
import type { GameShop, UserPreferences } from "@types";
import { fetchLatest } from "./release";
import { install, readMarker, PROXIES } from "./install";
import { detectApi, findMainExe } from "./detect";
import { cachedFsr4Dll, ensureFsr4Dlls } from "./fsr4-dll";
import { classifyGpus, detectGpuNames, type Fsr4Gpu } from "./gpu";

const SHIPPING_SUFFIX = "-win64-shipping.exe";

/**
 * Unreal games ship a root stub exe that starts `Binaries/Win64/*-Win64-Shipping.exe`;
 * the proxy DLL only loads when it sits next to the real process.
 */
const resolveInjectedExe = (exePath: string) => {
  if (exePath.toLowerCase().endsWith(SHIPPING_SUFFIX)) return exePath;
  const main = findMainExe(path.dirname(exePath));
  return main?.toLowerCase().endsWith(SHIPPING_SUFFIX) ? main : exePath;
};

export const getContext = async (shop: GameShop, objectId: string) => {
  const game = await gamesSublevel.get(levelKeys.game(shop, objectId));
  if (!game?.executablePath) throw new Error("Game has no executable path");
  // A .bat launcher isn't the injected process; target the tracked exe.
  const exePath = resolveInjectedExe(
    (isWindowsBatchFile(game.executablePath) &&
      game.trackingExecutablePaths?.find(Boolean)) ||
      game.executablePath
  );
  return { exePath, exeDir: path.dirname(exePath) };
};

export const getPrefs = () =>
  db.get<string, UserPreferences | null>(levelKeys.userPreferences, {
    valueEncoding: "json",
  });

export const detectGpu = async () => classifyGpus(await detectGpuNames());

/** Manual override from settings, else the detected GPU. */
export const resolveFsr4Gpu = async (
  prefs: UserPreferences | null
): Promise<Fsr4Gpu> => {
  const chosen = prefs?.optiscalerFsr4Gpu;
  return chosen && chosen !== "auto" ? chosen : detectGpu();
};

/** User-chosen FSR4 DLL if it still exists, else the auto-downloaded one. Native GPUs need none. */
export const resolveFsr4Dll = (
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

export const installForGame = async (
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

/** Startup task: fetch FSR4 DLLs, then bring every installed game up to the newest release. */
export const autoUpdateOptiscaler = async () => {
  if (process.platform !== "win32") return;

  const prefs = await getPrefs();
  const gpu = await resolveFsr4Gpu(prefs);
  if (gpu !== "native") await ensureFsr4Dlls(gpu).catch(() => null);

  const { tag } = await fetchLatest(!!prefs?.optiscalerNightly);

  for (const game of await gamesSublevel.values().all()) {
    if (!game.executablePath) continue;

    try {
      const { exeDir } = await getContext(game.shop, game.objectId);
      const marker = readMarker(exeDir);
      if (!marker || marker.version === tag) continue;

      await installForGame(game.shop, game.objectId, marker.proxy);
      logger.info(`OptiScaler updated to ${tag}: ${game.title}`);
    } catch (err) {
      // Files stay locked while the game runs; install rolls back, retry next launch.
      logger.warn(`OptiScaler auto-update skipped for ${game.title}`, err);
    }
  }
};

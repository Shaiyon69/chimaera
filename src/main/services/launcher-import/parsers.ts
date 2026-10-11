// Detection rules ported from Playnite's official library plugins (MIT, https://github.com/JosefNemec/PlayniteExtensions).
import { win32 as path } from "node:path";
import { parseArgsStringToArgv } from "string-argv";
import type { ExternalLaunch, LauncherId } from "@types";
import { BATTLENET_GAMES, ROCKSTAR_GAMES } from "./tables.js";
import type { RegEntry, UninstallProgram } from "./registry.js";

export interface DetectedGame {
  launcher: LauncherId;
  id: string;
  title: string;
  installDir: string;
  /** Candidate main exe; the caller verifies it and falls back to a folder scan. */
  exePath: string | null;
  externalLaunch: ExternalLaunch | null;
}

type DirExists = (dir: string) => boolean;

const uri = (value: string): ExternalLaunch => ({ kind: "uri", uri: value });
const exe = (file: string, args: string[] = []): ExternalLaunch => ({
  kind: "exe",
  path: file,
  args,
});

export interface EpicManifest {
  AppName: string;
  DisplayName?: string;
  InstallLocation?: string;
  LaunchExecutable?: string;
  CatalogNamespace?: string;
  CatalogItemId?: string;
  AppCategories?: string[];
  CompatibleApps?: string[];
  TechnicalType?: string;
}

export interface EpicInstalledApp {
  AppName: string;
  InstallLocation?: string;
}

export const parseEpic = (
  manifests: EpicManifest[],
  installedApps: EpicInstalledApp[],
  dirExists: DirExists
): DetectedGame[] => {
  const games = new Map<string, DetectedGame>();

  for (const m of manifests) {
    const categories = m.AppCategories ?? [];
    const isDlc =
      categories.includes("addons") &&
      !categories.includes("addons/launchable");
    const isEnginePlugin =
      categories.some((c) => c === "plugins" || c === "plugins/engine") ||
      m.CompatibleApps?.some((a) => a.startsWith("UE_")) ||
      m.TechnicalType?.includes("plugins/engine");
    if (!m.AppName || isDlc || isEnginePlugin) continue;

    // Manifests can hold a stale location after a game is moved; LauncherInstalled.dat is then right.
    const app = installedApps.find(
      (a) => a.AppName.toLowerCase() === m.AppName.toLowerCase()
    );
    let dir = m.InstallLocation;
    if (!dir || !dirExists(dir)) dir = app?.InstallLocation;
    if (!dir || !dirExists(dir)) continue;

    const game: DetectedGame = {
      launcher: "epic",
      id: m.AppName,
      title: m.DisplayName ?? path.basename(dir),
      installDir: dir,
      exePath: m.LaunchExecutable ? path.join(dir, m.LaunchExecutable) : null,
      externalLaunch:
        m.CatalogNamespace && m.CatalogItemId
          ? uri(
              `com.epicgames.launcher://apps/${m.CatalogNamespace}%3A${m.CatalogItemId}%3A${m.AppName}?action=launch&silent=true`
            )
          : null,
    };

    // Several manifests can exist for one game; the one matching LauncherInstalled.dat wins.
    const existing = games.get(game.id);
    if (!existing || app?.InstallLocation?.toLowerCase() === dir.toLowerCase())
      games.set(game.id, game);
  }
  return [...games.values()];
};

export interface GogInfo {
  gameId?: string;
  rootGameId?: string;
  playTasks?: {
    isPrimary?: boolean;
    type?: string;
    path?: string;
    arguments?: string;
  }[];
}

/** GOG installs register as `<id>_is1` with publisher GOG.com. */
export const parseGogPrograms = (
  programs: UninstallProgram[],
  dirExists: DirExists
) =>
  programs.flatMap((p) => {
    const id = /^(\d+)_is1/.exec(p.keyName)?.[1];
    if (
      !id ||
      p.publisher !== "GOG.com" ||
      p.keyName.startsWith("GOGPACK") ||
      !dirExists(p.installLocation)
    )
      return [];
    return [{ id, title: p.displayName, installDir: p.installLocation }];
  });

/** A game without a primary play task, or whose root game differs, is DLC. */
export const parseGogInfo = (
  entry: { id: string; title: string; installDir: string },
  info: GogInfo | null
): DetectedGame | null => {
  const task = info?.playTasks?.find(
    (t) => t.isPrimary && t.path && (!t.type || t.type === "FileTask")
  );
  if (!task?.path) return null;
  if (info?.rootGameId && info.rootGameId !== entry.id) return null;
  const file = path.join(entry.installDir, task.path);
  return {
    launcher: "gog",
    id: entry.id,
    title: entry.title,
    installDir: entry.installDir,
    exePath: file,
    externalLaunch: exe(file, parseArgsStringToArgv(task.arguments ?? "")),
  };
};

export const parseUbisoft = (
  installs: RegEntry[],
  programs: UninstallProgram[],
  dirExists: DirExists
): DetectedGame[] =>
  installs.flatMap((e) => {
    const dir = e.values.InstallDir?.replace(/\//g, "\\").replace(/\\$/, "");
    if (!dir || !dirExists(dir)) return [];
    const title =
      programs.find((p) => p.keyName === `Uplay Install ${e.name}`)
        ?.displayName ?? path.basename(dir);
    return [
      {
        launcher: "ubisoft" as const,
        id: e.name,
        title,
        installDir: dir,
        exePath: null,
        externalLaunch: uri(`uplay://launch/${e.name}`),
      },
    ];
  });

export interface AmazonRow {
  Id: string;
  ProductTitle: string;
  InstallDirectory: string;
}

export const parseAmazon = (
  rows: AmazonRow[],
  /** `Main.Command` from the game's fuel.json, relative to its folder. */
  fuelCommand: (installDir: string) => string | null,
  dirExists: DirExists
): DetectedGame[] =>
  rows
    .filter((r) => r.Id && dirExists(r.InstallDirectory))
    .map((r) => {
      const command = fuelCommand(r.InstallDirectory);
      return {
        launcher: "amazon" as const,
        id: r.Id,
        title: r.ProductTitle,
        installDir: r.InstallDirectory,
        exePath: command ? path.join(r.InstallDirectory, command) : null,
        externalLaunch: uri(`amazon-games://play/${r.Id}`),
      };
    });

export interface HumbleConfig {
  GameCollection4?: {
    machineName: string;
    gameName: string;
    status: string;
    filePath?: string;
    downloadFilePath?: string;
    executablePath: string;
  }[];
}

export const parseHumble = (
  config: HumbleConfig,
  dirExists: DirExists
): DetectedGame[] =>
  (config.GameCollection4 ?? []).flatMap((g) => {
    if (g.status !== "downloaded" && g.status !== "installed") return [];
    // Older Humble App versions stored games under downloadFilePath\machineName.
    const file = g.filePath
      ? path.join(g.filePath, g.executablePath)
      : path.join(g.downloadFilePath ?? "", g.machineName, g.executablePath);
    const dir = path.dirname(file);
    if (!dirExists(dir)) return [];
    return [
      {
        launcher: "humble" as const,
        id: g.machineName,
        title: g.gameName,
        installDir: dir,
        exePath: file,
        externalLaunch: exe(file),
      },
    ];
  });

export const parseBattleNet = (
  programs: UninstallProgram[],
  dirExists: DirExists,
  fileExists: (file: string) => boolean,
  clientExe: string | null
): DetectedGame[] => {
  const games = new Map<string, DetectedGame>();
  const add = (g: DetectedGame) => {
    if (!games.has(g.id)) games.set(g.id, g);
  };

  for (const p of programs) {
    if (!p.installLocation || !dirExists(p.installLocation)) continue;
    const uid = /Battle\.net.*--uid=(.*?)\s/.exec(p.uninstallString)?.[1];

    if (uid) {
      if (/(Test|Beta)$/.test(p.displayName)) continue;
      const product = BATTLENET_GAMES.find(
        (g) =>
          g.type === "default" &&
          uid.toLowerCase().startsWith(g.internalId.toLowerCase())
      );
      if (!product) continue;
      add({
        launcher: "battlenet",
        id: product.productId,
        title: product.name,
        installDir: p.installLocation,
        exePath: null,
        externalLaunch: clientExe
          ? exe(clientExe, [`--exec=launch ${product.productId}`])
          : null,
      });
    } else if (p.publisher === "Blizzard Entertainment") {
      for (const product of BATTLENET_GAMES.filter(
        (g) => g.type === "classic" && g.internalId === p.displayName
      )) {
        const file = path.join(p.installLocation, product.executable ?? "");
        if (!product.executable || !fileExists(file)) continue;
        add({
          launcher: "battlenet",
          id: product.productId,
          title: product.name,
          installDir: p.installLocation,
          exePath: file,
          externalLaunch: exe(file),
        });
      }
    }
  }
  return [...games.values()];
};

export const parseRockstar = (
  programs: UninstallProgram[],
  dirExists: DirExists,
  clientExe: string | null
): DetectedGame[] =>
  programs.flatMap((p) => {
    const titleId = /(?:Launcher|uninstall)\.exe.+uninstall=(.+)$/i.exec(
      p.uninstallString
    )?.[1];
    const product = ROCKSTAR_GAMES.find((g) => g.titleId === titleId);
    if (!product || !p.installLocation || !dirExists(p.installLocation))
      return [];
    return [
      {
        launcher: "rockstar" as const,
        id: product.titleId,
        title: product.name,
        installDir: p.installLocation,
        exePath: path.join(p.installLocation, product.executable),
        externalLaunch: clientExe
          ? exe(clientExe, ["-launchTitleInFolder", p.installLocation])
          : null,
      },
    ];
  });

export interface AppxPackage {
  Name: string;
  PackageFamilyName: string;
  InstallLocation: string;
}

/** Store packages are games only when they ship a MicrosoftGame.config (offline stand-in for Playnite's online check). */
export const parseXbox = (
  pkg: AppxPackage,
  manifestXml: string,
  gameConfigXml: string | null
): DetectedGame | null => {
  if (gameConfigXml === null) return null;
  const app = /<Application\b[^>]*>/i.exec(manifestXml)?.[0];
  const appId = /\bId="([^"]+)"/i.exec(app ?? "")?.[1];
  if (!appId) return null;
  const executable = /\bExecutable="([^"]+)"/i.exec(app ?? "")?.[1];
  const name = /DefaultDisplayName="([^"]+)"/i.exec(gameConfigXml)?.[1];
  return {
    launcher: "xbox",
    id: pkg.PackageFamilyName,
    // ms-resource: values need the app's resource files; fall back to the package name.
    title: name && !name.startsWith("ms-resource:") ? name : pkg.Name,
    installDir: pkg.InstallLocation,
    exePath: executable ? path.join(pkg.InstallLocation, executable) : null,
    externalLaunch: exe("explorer.exe", [
      `shell:AppsFolder\\${pkg.PackageFamilyName}!${appId}`,
    ]),
  };
};

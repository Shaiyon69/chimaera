import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { logger } from "../logger";
import { findMainExe } from "../optiscaler/detect";
import {
  parseAmazon,
  parseBattleNet,
  parseEpic,
  parseGogInfo,
  parseGogPrograms,
  parseHumble,
  parseRockstar,
  parseUbisoft,
  parseXbox,
  type DetectedGame,
  type AmazonRow,
  type AppxPackage,
  type EpicInstalledApp,
  type EpicManifest,
  type GogInfo,
  type HumbleConfig,
} from "./parsers";
import {
  listUninstallPrograms,
  queryKey,
  type UninstallProgram,
} from "./registry";

const dirExists = (dir: string) => {
  try {
    return fs.statSync(dir).isDirectory();
  } catch {
    return false;
  }
};
const fileExists = (file: string) => {
  try {
    return fs.statSync(file).isFile();
  } catch {
    return false;
  }
};

const readJson = <T>(file: string): T | null => {
  try {
    // Epic and Humble write a UTF-8 BOM that JSON.parse rejects.
    return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
  } catch {
    return null;
  }
};

const programData = () => process.env.ProgramData ?? "C:\\ProgramData";

const detectEpic = async (): Promise<DetectedGame[]> => {
  const manifestDir = path.join(
    programData(),
    "Epic",
    "EpicGamesLauncher",
    "Data",
    "Manifests"
  );
  if (!dirExists(manifestDir)) return [];
  const manifests = fs
    .readdirSync(manifestDir)
    .filter((f) => f.endsWith(".item"))
    .map((f) => readJson<EpicManifest>(path.join(manifestDir, f)))
    // Epic sometimes leaves empty or hand-broken manifests behind.
    .filter((m): m is EpicManifest => !!m);
  const installed =
    readJson<{ InstallationList?: EpicInstalledApp[] }>(
      path.join(
        programData(),
        "Epic",
        "UnrealEngineLauncher",
        "LauncherInstalled.dat"
      )
    )?.InstallationList ?? [];
  return parseEpic(manifests, installed, dirExists);
};

const detectGog = async (
  programs: UninstallProgram[]
): Promise<DetectedGame[]> =>
  parseGogPrograms(programs, dirExists).flatMap((entry) => {
    const info = readJson<GogInfo>(
      path.join(entry.installDir, `goggame-${entry.id}.info`)
    );
    const game = parseGogInfo(entry, info);
    return game ? [game] : [];
  });

const detectUbisoft = async (
  programs: UninstallProgram[]
): Promise<DetectedGame[]> => {
  const key = String.raw`SOFTWARE\ubisoft\Launcher\Installs`;
  // Playnite checks the 32-bit view first, then 64-bit.
  let installs = (await queryKey(key, 32)).filter((e) => e.values.InstallDir);
  if (!installs.length)
    installs = (await queryKey(key, 64)).filter((e) => e.values.InstallDir);
  return parseUbisoft(installs, programs, dirExists);
};

const detectAmazon = async (): Promise<DetectedGame[]> => {
  const db = path.join(
    process.env.LOCALAPPDATA ?? "",
    "Amazon Games",
    "Data",
    "Games",
    "Sql",
    "GameInstallInfo.sqlite"
  );
  if (!fileExists(db)) return [];
  const { DatabaseSync } = await import("node:sqlite");
  const conn = new DatabaseSync(db, { readOnly: true });
  try {
    const rows = conn
      .prepare(
        "SELECT Id, ProductTitle, InstallDirectory FROM DbSet WHERE Installed = 1"
      )
      .all() as unknown as AmazonRow[];
    return parseAmazon(
      rows,
      (dir) =>
        readJson<{ Main?: { Command?: string } }>(path.join(dir, "fuel.json"))
          ?.Main?.Command ?? null,
      dirExists
    );
  } finally {
    conn.close();
  }
};

const detectHumble = async (): Promise<DetectedGame[]> => {
  const config = readJson<HumbleConfig>(
    path.join(process.env.APPDATA ?? "", "Humble App", "config.json")
  );
  return config ? parseHumble(config, dirExists) : [];
};

const detectBattleNet = async (
  programs: UninstallProgram[]
): Promise<DetectedGame[]> => {
  const client = programs.find((p) =>
    p.uninstallString.includes("--uid=battle.net")
  );
  const clientExe = client
    ? path.join(client.installLocation, "Battle.net.exe")
    : null;
  return parseBattleNet(
    programs,
    dirExists,
    fileExists,
    clientExe && fileExists(clientExe) ? clientExe : null
  );
};

const detectRockstar = async (
  programs: UninstallProgram[]
): Promise<DetectedGame[]> => {
  const client = programs.find(
    (p) => p.displayName === "Rockstar Games Launcher"
  );
  const clientExe = client
    ? path.join(client.installLocation, "Launcher.exe")
    : null;
  return parseRockstar(
    programs,
    dirExists,
    clientExe && fileExists(clientExe) ? clientExe : null
  );
};

const runPowerShell = (script: string): Promise<string> =>
  new Promise((resolve, reject) =>
    execFile(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", script],
      { maxBuffer: 32 * 1024 * 1024, windowsHide: true, timeout: 30000 },
      (error, stdout) => (error ? reject(error) : resolve(String(stdout)))
    )
  );

const detectXbox = async (): Promise<DetectedGame[]> => {
  const out = await runPowerShell(
    "Get-AppxPackage | Where-Object { $_.SignatureKind -eq 'Store' -and -not $_.IsFramework } | Select-Object Name,PackageFamilyName,InstallLocation | ConvertTo-Json -Compress"
  );
  if (!out.trim()) return [];
  const parsed = JSON.parse(out) as AppxPackage | AppxPackage[];
  const read = (file: string) => {
    try {
      return fs.readFileSync(file, "utf8");
    } catch {
      return null;
    }
  };
  return (Array.isArray(parsed) ? parsed : [parsed]).flatMap((pkg) => {
    if (!pkg.InstallLocation) return [];
    const config = read(path.join(pkg.InstallLocation, "MicrosoftGame.config"));
    const manifest = read(path.join(pkg.InstallLocation, "AppxManifest.xml"));
    const game = manifest ? parseXbox(pkg, manifest, config) : null;
    return game ? [game] : [];
  });
};

/** Keeps a verified exe, else scans the install folder for the most likely one. */
const resolveExe = (game: DetectedGame): DetectedGame => {
  // WindowsApps is unreadable, so Store exes cannot be verified.
  if (game.launcher === "xbox" && game.exePath) return game;
  if (game.exePath && fileExists(game.exePath)) return game;
  return { ...game, exePath: findMainExe(game.installDir) };
};

const DETECTORS: [
  string,
  (programs: UninstallProgram[]) => Promise<DetectedGame[]>,
][] = [
  ["epic", detectEpic],
  ["gog", detectGog],
  ["ubisoft", detectUbisoft],
  ["amazon", detectAmazon],
  ["humble", detectHumble],
  ["battlenet", detectBattleNet],
  ["rockstar", detectRockstar],
  ["xbox", detectXbox],
];

/** Installed games from every supported launcher. A launcher that fails to read is logged and skipped. */
export const detectLauncherGames = async (): Promise<DetectedGame[]> => {
  if (process.platform !== "win32") return [];
  const programs = await listUninstallPrograms();
  const results = await Promise.allSettled(
    DETECTORS.map(([, detect]) => detect(programs))
  );
  return results.flatMap((result, i) => {
    if (result.status === "fulfilled") return result.value.map(resolveExe);
    logger.error(`Launcher import: ${DETECTORS[i][0]} detection failed`, {
      error: result.reason,
    });
    return [];
  });
};

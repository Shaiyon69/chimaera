import { app } from "electron";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as WebReadableStream } from "node:stream/web";
import { logger } from "../logger";
import { SevenZip } from "../7zip";
import { WindowManager } from "../window-manager";
import { isPortDir, pickPortRelease } from "./bloodborne-core";

// Follows the upstream port's latest GitHub release; the zip is verified against the
// sha256 digest GitHub publishes for the asset.
const LATEST_RELEASE =
  "https://api.github.com/repos/Mrsuss60/bloodborne_pc_windows_port/releases/latest";
const VERSION_FILE = ".port-version";

/** The NSIS installer writes this when "Include Bloodborne port" is ticked. */
const INSTALL_REQUESTED_MARKER = "bloodborne-install-requested";

export const downloadedPortDir = () =>
  path.join(app.getPath("userData"), "bloodborne-port");

/** The port's launcher keeps saves, settings, keybinds and mods inside its own folder. */
const USER_DATA = ["user", "mods", "bbport.ini", "bblauncher_settings.json"];

/** Copies the user's files from one port-shaped folder over a fresh port. */
const carryUserData = async (
  from: string,
  to: string,
  names: string[] = USER_DATA
) => {
  for (const name of names) {
    const source = path.join(from, name);
    if (!fs.existsSync(source)) continue;
    await fs.promises.rm(path.join(to, name), { recursive: true, force: true });
    await fs.promises.cp(source, path.join(to, name), { recursive: true });
  }
};

/** Chimaera's own launcher used <userData>/bloodborne; move it into the port once. */
const migrateLegacyData = async (port: string) => {
  const legacy = path.join(app.getPath("userData"), "bloodborne");
  if (!fs.existsSync(legacy)) return;
  // Only saves and mods: the old bbport.ini forced FSR 3 and disabled effects, which crash the port.
  await carryUserData(legacy, port, ["user", "mods"]);
  // launcher_settings.json only held the game folder the port launcher also asks for.
  try {
    const { eboot } = JSON.parse(
      fs.readFileSync(path.join(legacy, "launcher_settings.json"), "utf-8")
    );
    const settings = path.join(port, "bblauncher_settings.json");
    if (typeof eboot === "string" && !fs.existsSync(settings))
      fs.writeFileSync(settings, JSON.stringify({ eboot }, null, 2));
  } catch {
    // no old setup to import
  }
  await fs.promises.rename(legacy, `${legacy}.migrated`);
};

let installing: Promise<void> | null = null;

const sendProgress = (phase: "downloading" | "extracting", percent: number) =>
  WindowManager.sendToAppWindows("on-bloodborne-port-progress", {
    phase,
    percent,
  });

const fetchLatestRelease = async () => {
  const response = await fetch(LATEST_RELEASE, {
    headers: { Accept: "application/vnd.github+json" },
  });
  if (!response.ok) {
    throw new Error(`Port release lookup failed: HTTP ${response.status}`);
  }
  const release = pickPortRelease(await response.json());
  if (!release) throw new Error("Latest port release has no verifiable zip");
  return release;
};

const install = async () => {
  const release = await fetchLatestRelease();
  const root = app.getPath("userData");
  const zipPath = path.join(root, "bloodborne-port.zip.part");
  const extractDir = path.join(root, "bloodborne-port.tmp");

  try {
    const response = await fetch(release.url);
    if (!response.ok || !response.body) {
      throw new Error(`Port download failed: HTTP ${response.status}`);
    }

    const total = Number(response.headers.get("content-length")) || 0;
    const hash = createHash("sha256");
    let received = 0;
    let lastPercent = -1;

    await pipeline(
      Readable.fromWeb(response.body as WebReadableStream),
      new Transform({
        transform(chunk: Buffer, _encoding, callback) {
          hash.update(chunk);
          received += chunk.length;
          const percent = total ? Math.floor((received / total) * 100) : 0;
          if (percent !== lastPercent) {
            lastPercent = percent;
            sendProgress("downloading", percent);
          }
          callback(null, chunk);
        },
      }),
      fs.createWriteStream(zipPath)
    );

    if (hash.digest("hex") !== release.sha256) {
      throw new Error("Port download is corrupted (checksum mismatch)");
    }

    sendProgress("extracting", 0);
    await fs.promises.rm(extractDir, { recursive: true, force: true });
    await SevenZip.extractFile(
      { filePath: zipPath, outputPath: extractDir },
      ({ percent }) => sendProgress("extracting", Math.floor(percent))
    );

    // The release zip wraps everything in one folder.
    const inner = fs
      .readdirSync(extractDir, { withFileTypes: true })
      .filter((e) => e.isDirectory());
    const portRoot =
      !isPortDir(extractDir) && inner.length === 1
        ? path.join(extractDir, inner[0].name)
        : extractDir;

    if (!isPortDir(portRoot)) {
      throw new Error("Port archive is missing run.bat or out/bbport.exe");
    }

    // Swap in last so a failed attempt never leaves a half-installed port. Windows refuses
    // the first rename while the game runs, which aborts the update and leaves it untouched.
    const dir = downloadedPortDir();
    const old = `${dir}.old`;
    await fs.promises.rm(old, { recursive: true, force: true });
    if (fs.existsSync(dir)) await fs.promises.rename(dir, old);
    try {
      await fs.promises.rename(portRoot, dir);
    } catch (error) {
      if (fs.existsSync(old)) await fs.promises.rename(old, dir);
      throw error;
    }
    await fs.promises.writeFile(path.join(dir, VERSION_FILE), release.tag);
    if (fs.existsSync(old)) await carryUserData(old, dir);
    await migrateLegacyData(dir);
    await fs.promises.rm(old, { recursive: true, force: true });
  } finally {
    await fs.promises.rm(zipPath, { force: true });
    await fs.promises.rm(extractDir, { recursive: true, force: true });
  }
};

export const downloadBloodbornePort = () => {
  installing ??= install().finally(() => {
    installing = null;
  });
  return installing;
};

const installedTag = () => {
  try {
    return fs.readFileSync(
      path.join(downloadedPortDir(), VERSION_FILE),
      "utf-8"
    );
  } catch {
    return null; // no version file: a build from before tracking
  }
};

/** Installs when the installer box was ticked and keeps an installed port on the latest release. Offline keeps what is there. */
export const syncBloodbornePort = async () => {
  const marker = path.join(app.getPath("userData"), INSTALL_REQUESTED_MARKER);
  const requested = fs.existsSync(marker);
  fs.rmSync(marker, { force: true });

  const installed = isPortDir(downloadedPortDir());
  if (!installed && !requested) return;

  try {
    if (installed && installedTag() === (await fetchLatestRelease()).tag)
      return;
    await downloadBloodbornePort();
  } catch (error) {
    logger.error("Bloodborne port sync failed", error);
  }
};

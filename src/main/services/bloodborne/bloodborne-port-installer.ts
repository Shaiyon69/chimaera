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
import { isPortDir } from "./bloodborne-core";

// Produced by `yarn stage:bloodborne` (prints the sha256). Upload the zip to this
// release, then paste the hash. Empty hash = not published, downloads refuse to run.
const PORT_ASSET =
  "https://github.com/Shaiyon69/chimaera/releases/download/bloodborne-port-fc026c3/bloodborne-port.zip";
const PORT_SHA256 =
  "cc47ebc3391cf08dddcb85a602c253aa188d34e1e058ae3178027cbcf71e4520";

/** The NSIS installer writes this when "Include Bloodborne port" is ticked. */
const INSTALL_REQUESTED_MARKER = "bloodborne-install-requested";

export const downloadedPortDir = () =>
  path.join(app.getPath("userData"), "bloodborne-port");

let installing: Promise<void> | null = null;

const sendProgress = (phase: "downloading" | "extracting", percent: number) =>
  WindowManager.sendToAppWindows("on-bloodborne-port-progress", {
    phase,
    percent,
  });

const install = async () => {
  if (!PORT_SHA256) {
    throw new Error("The Bloodborne port download has not been published yet");
  }

  const root = app.getPath("userData");
  const zipPath = path.join(root, "bloodborne-port.zip.part");
  const extractDir = path.join(root, "bloodborne-port.tmp");

  try {
    const response = await fetch(PORT_ASSET);
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

    if (hash.digest("hex") !== PORT_SHA256) {
      throw new Error("Port download is corrupted (checksum mismatch)");
    }

    sendProgress("extracting", 0);
    await fs.promises.rm(extractDir, { recursive: true, force: true });
    await SevenZip.extractFile(
      { filePath: zipPath, outputPath: extractDir },
      ({ percent }) => sendProgress("extracting", Math.floor(percent))
    );

    if (!isPortDir(extractDir)) {
      throw new Error("Port archive is missing run.bat or out/bbport.exe");
    }

    // Swap in last so a failed attempt never leaves a half-installed port.
    await fs.promises.rm(downloadedPortDir(), { recursive: true, force: true });
    await fs.promises.rename(extractDir, downloadedPortDir());
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

/** Honours the installer checkbox once, in the background. */
export const installBloodbornePortIfRequested = async () => {
  const marker = path.join(app.getPath("userData"), INSTALL_REQUESTED_MARKER);
  if (!fs.existsSync(marker)) return;

  fs.rmSync(marker, { force: true });
  if (isPortDir(downloadedPortDir())) return;

  try {
    await downloadBloodbornePort();
  } catch (error) {
    logger.error("Bloodborne port install from installer failed", error);
  }
};

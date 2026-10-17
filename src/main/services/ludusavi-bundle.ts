import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import * as tar from "tar";
import YAML from "yaml";
import i18next, { t } from "i18next";
import type { GameShop, LudusaviBackupMapping } from "@types";
import { formatDate } from "@shared";
import { backupsPath, publicProfilePath } from "@main/constants";
import { addTrailingSlash, normalizePath } from "@main/helpers";
import { Ludusavi } from "./ludusavi";
import { logger } from "./logger";
import { SystemPath } from "./system-path";
import { Wine } from "./wine";

/** Ludusavi save snapshots as tar files, and putting them back (used by save backups). */

/** The user profile folder saves are relative to (inside the Wine prefix on Linux). */
export const getWindowsLikeUserProfilePath = (
  winePrefixPath?: string | null
) => {
  if (process.platform === "linux") {
    if (!winePrefixPath) throw new Error("Wine prefix path is required");
    const userProfile = Wine.getWindowsUserProfilePath(winePrefixPath);
    if (!userProfile) throw new Error("User profile not found in user.reg");
    return userProfile;
  }
  return normalizePath(SystemPath.getPath("home"));
};

export const getBackupLabel = (automatic: boolean) => {
  const date = formatDate(new Date(), i18next.language);
  return automatic
    ? t("automatic_backup_from", { ns: "game_details", date })
    : t("backup_from", { ns: "game_details", date });
};

/** Runs a Ludusavi backup of the game's saves and packs it into a temporary tar. */
export const bundleBackup = async (
  shop: GameShop,
  objectId: string,
  winePrefix: string | null
) => {
  const backupPath = path.join(backupsPath, `${shop}-${objectId}`);
  if (fs.existsSync(backupPath)) {
    await fs.promises
      .rm(backupPath, { recursive: true })
      .catch((error) =>
        logger.error("Failed to remove backup path", { backupPath, error })
      );
  }
  await Ludusavi.backupGame(shop, objectId, backupPath, winePrefix);
  const tarLocation = path.join(backupsPath, `${crypto.randomUUID()}.tar`);
  await tar.create({ gzip: false, file: tarLocation, cwd: backupPath }, ["."]);
  return tarLocation;
};

export const transformLudusaviBackupPathIntoWindowsPath = (
  backupPath: string,
  winePrefixPath?: string | null
) =>
  backupPath
    .replace(winePrefixPath ? addTrailingSlash(winePrefixPath) : "", "")
    .replace("drive_c", "C:");

export const addWinePrefixToWindowsPath = (
  windowsPath: string,
  winePrefixPath?: string | null
) =>
  winePrefixPath
    ? path.join(winePrefixPath, windowsPath.replace("C:", "drive_c"))
    : windowsPath;

/** Moves an extracted Ludusavi backup's files to where the game reads them. */
export const restoreLudusaviBackup = (
  backupPath: string,
  title: string,
  homeDir: string,
  winePrefixPath?: string | null,
  artifactWinePrefixPath?: string | null
) => {
  const gameBackupPath = path.join(backupPath, title);
  const manifest = YAML.parse(
    fs.readFileSync(path.join(gameBackupPath, "mapping.yaml"), "utf8")
  ) as { backups: LudusaviBackupMapping[]; drives: Record<string, string> };

  const userProfilePath = getWindowsLikeUserProfilePath(winePrefixPath);

  for (const backup of manifest.backups) {
    for (const key of Object.keys(backup.files)) {
      const sourcePathWithDrives = Object.entries(manifest.drives).reduce(
        (prev, [driveKey, driveValue]) => prev.replace(driveValue, driveKey),
        key
      );
      const sourcePath = path.join(gameBackupPath, sourcePathWithDrives);
      const destinationPath = transformLudusaviBackupPathIntoWindowsPath(
        key,
        artifactWinePrefixPath
      )
        .replace(
          homeDir,
          addWinePrefixToWindowsPath(userProfilePath, winePrefixPath)
        )
        .replace(
          publicProfilePath,
          addWinePrefixToWindowsPath(publicProfilePath, winePrefixPath)
        );

      logger.info(`Restoring ${sourcePath} to ${destinationPath}`);
      fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
      if (fs.existsSync(destinationPath)) fs.unlinkSync(destinationPath);
      fs.renameSync(sourcePath, destinationPath);
    }
  }
};

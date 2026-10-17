import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { shell } from "electron";
import type { GameShop } from "@types";
import { db, gamesSublevel, levelKeys } from "@main/level";
import {
  bundleBackup,
  getBackupLabel,
  getWindowsLikeUserProfilePath,
} from "./ludusavi-bundle";
import { SystemPath } from "./system-path";
import { Wine } from "./wine";

/** Replaces Hydra Cloud: Ludusavi snapshots as tar files in a folder the user picks. */

const DIR_KEY = "localSaveBackupsDir";

export interface LocalSaveBackup {
  /** File name of the tar inside the game's folder. */
  file: string;
  label: string;
  createdAt: string;
  sizeBytes: number;
  /** The profile folder the saves were taken from, rewritten on restore. */
  homeDir: string;
  winePrefixPath: string | null;
  hostname: string;
}

export const getSaveBackupsDir = async () =>
  db
    .get<string, string>(DIR_KEY, { valueEncoding: "json" })
    .then((v) => v || path.join(SystemPath.getPath("userData"), "save-backups"))
    .catch(() => path.join(SystemPath.getPath("userData"), "save-backups"));

export const setSaveBackupsDir = (dir: string) =>
  db.put<string, string>(DIR_KEY, dir, { valueEncoding: "json" });

const gameDir = async (shop: GameShop, objectId: string) =>
  path.join(
    await getSaveBackupsDir(),
    `${shop}-${objectId}`.replace(/[<>:"/\\|?*]+/g, "_")
  );

const sidecar = (tar: string) => tar.replace(/\.tar$/, ".json");

export const listLocalSaveBackups = async (
  shop: GameShop,
  objectId: string
): Promise<LocalSaveBackup[]> => {
  const dir = await gameDir(shop, objectId);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".tar"))
    .flatMap((file) => {
      try {
        const meta = JSON.parse(
          fs.readFileSync(sidecar(path.join(dir, file)), "utf-8")
        );
        return [{ ...meta, file }];
      } catch {
        return [];
      }
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
};

/** Writes a tar plus its metadata; `source` is moved into place. */
export const storeLocalSaveBackup = async (
  shop: GameShop,
  objectId: string,
  source: string,
  meta: Omit<LocalSaveBackup, "file" | "sizeBytes">
) => {
  const dir = await gameDir(shop, objectId);
  fs.mkdirSync(dir, { recursive: true });
  const file = `${meta.createdAt.replace(/[:.]/g, "-")}.tar`;
  const target = path.join(dir, file);
  await fs.promises.copyFile(source, target);
  const backup: LocalSaveBackup = {
    ...meta,
    file,
    sizeBytes: fs.statSync(target).size,
  };
  fs.writeFileSync(sidecar(target), JSON.stringify(backup, null, 2));
  return backup;
};

export const createLocalSaveBackup = async (
  shop: GameShop,
  objectId: string,
  label?: string
) => {
  const game = await gamesSublevel.get(levelKeys.game(shop, objectId));
  const winePrefixPath = Wine.getEffectivePrefixPath(
    game?.winePrefixPath,
    objectId
  );
  const tar = await bundleBackup(shop, objectId, winePrefixPath);
  try {
    return await storeLocalSaveBackup(shop, objectId, tar, {
      label: label || getBackupLabel(false),
      createdAt: new Date().toISOString(),
      homeDir: getWindowsLikeUserProfilePath(winePrefixPath),
      winePrefixPath,
      hostname: os.hostname(),
    });
  } finally {
    await fs.promises.rm(tar, { force: true });
  }
};

/** Absolute path of a listed backup; refuses names that leave the game's folder. */
export const localSaveBackupPath = async (
  shop: GameShop,
  objectId: string,
  file: string
) => {
  const dir = await gameDir(shop, objectId);
  const target = path.join(dir, file);
  if (path.dirname(target) !== dir || !file.endsWith(".tar")) {
    throw new Error("save-backup/invalid-file");
  }
  return target;
};

export const deleteLocalSaveBackup = async (
  shop: GameShop,
  objectId: string,
  file: string
) => {
  const target = await localSaveBackupPath(shop, objectId, file);
  await fs.promises.rm(target, { force: true });
  await fs.promises.rm(sidecar(target), { force: true });
};

export const openLocalSaveBackupsFolder = async (
  shop: GameShop,
  objectId: string
) => {
  const dir = await gameDir(shop, objectId);
  fs.mkdirSync(dir, { recursive: true });
  await shell.openPath(dir);
};

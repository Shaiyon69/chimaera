import fs from "node:fs";
import path from "node:path";
import * as tar from "tar";
import { dialog } from "electron";
import type { GameShop } from "@types";
import { backupsPath } from "@main/constants";
import { normalizePath } from "@main/helpers";
import { gamesSublevel, levelKeys } from "@main/level";
import { WindowManager, Wine } from "@main/services";
import {
  createLocalSaveBackup,
  deleteLocalSaveBackup,
  getSaveBackupsDir,
  listLocalSaveBackups,
  localSaveBackupPath,
  openLocalSaveBackupsFolder,
  setSaveBackupsDir,
} from "@main/services/local-save-backups";
import { restoreLudusaviBackup } from "@main/services/ludusavi-bundle";
import { registerEvent } from "../register-event";

type Event = Electron.IpcMainInvokeEvent;

registerEvent("listLocalSaveBackups", (_e: Event, shop: GameShop, id: string) =>
  listLocalSaveBackups(shop, id)
);
registerEvent(
  "createLocalSaveBackup",
  (_e: Event, shop: GameShop, id: string, label?: string) =>
    createLocalSaveBackup(shop, id, label)
);
registerEvent(
  "deleteLocalSaveBackup",
  (_e: Event, shop: GameShop, id: string, file: string) =>
    deleteLocalSaveBackup(shop, id, file)
);
registerEvent(
  "openLocalSaveBackupsFolder",
  (_e: Event, shop: GameShop, id: string) =>
    openLocalSaveBackupsFolder(shop, id)
);
registerEvent("getSaveBackupsDir", () => getSaveBackupsDir());
registerEvent("selectSaveBackupsDir", async () => {
  const result = await dialog.showOpenDialog(WindowManager.mainWindow!, {
    properties: ["openDirectory", "createDirectory"],
    defaultPath: await getSaveBackupsDir(),
  });
  const dir = result.filePaths[0];
  if (result.canceled || !dir) return null;
  await setSaveBackupsDir(dir);
  return dir;
});

/** Puts a local snapshot's files back where the game reads them. */
registerEvent(
  "restoreLocalSaveBackup",
  async (_e: Event, shop: GameShop, objectId: string, file: string) => {
    const tarPath = await localSaveBackupPath(shop, objectId, file);
    const backup = (await listLocalSaveBackups(shop, objectId)).find(
      (b) => b.file === file
    );
    if (!backup) throw new Error("save-backup/not-found");

    const game = await gamesSublevel.get(levelKeys.game(shop, objectId));
    const winePrefixPath = Wine.getEffectivePrefixPath(
      game?.winePrefixPath,
      objectId
    );
    const extractDir = path.join(backupsPath, `${shop}-${objectId}`);
    fs.rmSync(extractDir, { recursive: true, force: true });
    fs.mkdirSync(extractDir, { recursive: true });
    await tar.x({ file: tarPath, cwd: extractDir });
    restoreLudusaviBackup(
      extractDir,
      objectId,
      normalizePath(backup.homeDir),
      winePrefixPath,
      backup.winePrefixPath
    );
  }
);

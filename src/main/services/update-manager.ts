import updater, { UpdateInfo } from "electron-updater";
import axios from "axios";
import { logger, WindowManager } from "@main/services";
import { pickUpdateTag } from "./update-feed-core";
import { AppUpdaterEvent, UserPreferences } from "@types";
import { app } from "electron";
import { publishNotificationUpdateReadyToInstall } from "@main/services/notifications";
import { db, levelKeys } from "@main/level";

const { autoUpdater } = updater;
const sendEventsForDebug = false;

const REPO = "Shaiyon69/chimaera";
const MANIFESTS: Partial<Record<NodeJS.Platform, string>> = {
  darwin: "latest-mac.yml",
  linux: "latest-linux.yml",
};

export class UpdateManager {
  private static hasNotified = false;
  private static newVersion = "";

  private static mockValuesForDebug() {
    this.sendEvent({ type: "update-available", info: { version: "3.3.1" } });
    this.sendEvent({ type: "update-downloaded" });
  }

  private static sendEvent(event: AppUpdaterEvent) {
    WindowManager.mainWindow?.webContents.send("autoUpdaterEvent", event);
  }

  private static async isAutoInstallEnabled() {
    if (process.platform === "darwin") return false;
    if (process.platform === "win32") {
      return process.env.PORTABLE_EXECUTABLE_FILE == null;
    }

    if (process.platform === "linux") {
      const userPreferences = await db.get<string, UserPreferences | null>(
        levelKeys.userPreferences,
        {
          valueEncoding: "json",
        }
      );

      return userPreferences?.enableAutoInstall === true;
    }

    return false;
  }

  /** Pins the feed to the newest app release; on failure the GitHub provider feed stays in place. */
  private static async pointFeedAtAppRelease() {
    try {
      const { data } = await axios.get(
        `https://api.github.com/repos/${REPO}/releases?per_page=20`,
        {
          headers: { Accept: "application/vnd.github+json" },
          timeout: 15_000,
        }
      );
      const tag = pickUpdateTag(
        data,
        MANIFESTS[process.platform] ?? "latest.yml"
      );
      if (tag) {
        autoUpdater.setFeedURL({
          provider: "generic",
          url: `https://github.com/${REPO}/releases/download/${tag}`,
        });
      }
    } catch (err) {
      logger.error("Could not resolve the update feed", err);
    }
  }

  public static async checkForUpdates() {
    autoUpdater
      .removeAllListeners()
      .on("update-available", (info: UpdateInfo) => {
        this.sendEvent({ type: "update-available", info });
        this.newVersion = info.version;
      })
      .on("update-downloaded", () => {
        this.sendEvent({ type: "update-downloaded" });

        if (!this.hasNotified) {
          this.hasNotified = true;
          publishNotificationUpdateReadyToInstall(this.newVersion);
        }
      });

    const isAutoInstallAvailable = await this.isAutoInstallEnabled();

    if (app.isPackaged) {
      autoUpdater.autoDownload = isAutoInstallAvailable;
      await this.pointFeedAtAppRelease();
      autoUpdater.checkForUpdates().then((result) => {
        logger.log(`Check for updates result: ${result}`);
      });
    } else if (sendEventsForDebug) {
      this.mockValuesForDebug();
    }

    return isAutoInstallAvailable;
  }
}

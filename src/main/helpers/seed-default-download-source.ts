import { db, downloadSourcesSublevel } from "@main/level";
import { HydraApi } from "@main/services/hydra-api";
import { logger } from "@main/services";
import type { DownloadSource } from "@types";

const DEFAULT_SOURCE_URL = "https://wkeynhk.online/ankergames.json";
// One-time flag so a source the user later removes is not re-added.
const SEEDED_KEY = "defaultDownloadSourceSeeded";

export const seedDefaultDownloadSource = async () => {
  try {
    const seeded = await db
      .get<string, boolean>(SEEDED_KEY, { valueEncoding: "json" })
      .catch(() => false);
    if (seeded) return;

    const existing = await downloadSourcesSublevel.values().all();
    if (!existing.some((source) => source.url === DEFAULT_SOURCE_URL)) {
      const source = await HydraApi.post<DownloadSource>(
        "/download-sources",
        { url: DEFAULT_SOURCE_URL },
        { needsAuth: false }
      );
      await downloadSourcesSublevel.put(source.id, {
        ...source,
        isRemote: true,
        createdAt: new Date().toISOString(),
      });
    }

    await db.put(SEEDED_KEY, true, { valueEncoding: "json" });
  } catch (error) {
    // Not flagged on failure, so the next launch retries.
    logger.error("Failed to add default download source:", error);
  }
};

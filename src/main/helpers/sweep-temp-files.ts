import fs from "node:fs";
import path from "node:path";
import { app } from "electron";
import { logger } from "@main/services";

const MAX_AGE_MS = 24 * 60 * 60 * 1000;

// saveTempFile leaves files behind when the renderer never calls deleteTempFile.
export const sweepTempFiles = async () => {
  const tempDir = app.getPath("temp");

  try {
    const entries = await fs.promises.readdir(tempDir);

    await Promise.all(
      entries
        .filter((name) => name.startsWith("hydra-temp-"))
        .map(async (name) => {
          const filePath = path.join(tempDir, name);
          const stat = await fs.promises.stat(filePath);

          if (stat.isFile() && Date.now() - stat.mtimeMs > MAX_AGE_MS) {
            await fs.promises.rm(filePath, { force: true });
          }
        })
    );
  } catch (error) {
    logger.error("Failed to sweep temp files", error);
  }
};

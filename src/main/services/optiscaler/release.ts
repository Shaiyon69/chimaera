import { app } from "electron";
import axios from "axios";
import fs from "node:fs";
import path from "node:path";
import { SevenZip } from "../7zip";

const API = "https://api.github.com/repos/optiscaler/OptiScaler/releases";
const cacheDir = () =>
  path.join(app.getPath("userData"), "optiscaler", "cache");

export const findPayload = (root: string): string | null => {
  if (!fs.existsSync(root)) return null;
  const hit = fs
    .readdirSync(root, { recursive: true, withFileTypes: true })
    .find((e) => e.isFile() && e.name === "OptiScaler.dll");
  return hit ? hit.parentPath : null;
};

/** Release tag plus extracted payload folder. Downloads when not cached; falls back to the newest cached release offline. */
export const fetchLatest = async (
  nightly: boolean
): Promise<{ tag: string; payload: string }> => {
  const cache = cacheDir();
  try {
    const { data } = await axios.get(
      nightly ? `${API}?per_page=1` : `${API}/latest`,
      { headers: { Accept: "application/vnd.github+json" }, timeout: 30000 }
    );
    const rel = nightly ? data[0] : data;
    const tag: string = rel.tag_name;
    const dest = path.join(cache, `OptiScaler_${tag}`);
    const cached = findPayload(dest);
    if (cached) return { tag, payload: cached };

    const asset = rel.assets.find((a: { name: string }) =>
      a.name.toLowerCase().endsWith(".7z")
    );
    if (!asset) throw new Error(`No .7z asset in release ${tag}`);
    fs.mkdirSync(cache, { recursive: true });
    const archive = path.join(cache, asset.name);
    const res = await axios.get(asset.browser_download_url, {
      responseType: "arraybuffer",
      timeout: 60000,
    });
    fs.writeFileSync(archive, Buffer.from(res.data));
    fs.rmSync(dest, { recursive: true, force: true });
    await SevenZip.extractFile({ filePath: archive, outputPath: dest });
    fs.rmSync(archive, { force: true });
    const payload = findPayload(dest);
    if (!payload)
      throw new Error("OptiScaler.dll not found in extracted release");
    return { tag, payload };
  } catch (err) {
    const tags = fs.existsSync(cache)
      ? fs
          .readdirSync(cache)
          .filter((d) => d.startsWith("OptiScaler_"))
          .sort()
          .reverse()
      : [];
    for (const d of tags) {
      const payload = findPayload(path.join(cache, d));
      if (payload) return { tag: d.slice("OptiScaler_".length), payload };
    }
    throw err;
  }
};

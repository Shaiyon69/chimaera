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

const latestTagCache = new Map<boolean, { tag: string; at: number }>();
const LATEST_TAG_TTL_MS = 60 * 60 * 1000;

/** Newest release tag without downloading; null when offline. Cached for an hour. */
export const fetchLatestTag = async (
  nightly: boolean
): Promise<string | null> => {
  const hit = latestTagCache.get(nightly);
  if (hit && Date.now() - hit.at < LATEST_TAG_TTL_MS) return hit.tag;
  try {
    const { data } = await axios.get(
      nightly ? `${API}?per_page=1` : `${API}/latest`,
      { headers: { Accept: "application/vnd.github+json" }, timeout: 10000 }
    );
    const tag: string = (nightly ? data[0] : data).tag_name;
    latestTagCache.set(nightly, { tag, at: Date.now() });
    return tag;
  } catch {
    return null;
  }
};

/** Release tag plus extracted payload folder. Downloads when not cached; falls back to the newest cached release offline. */
export const fetchLatest = (
  nightly: boolean
): Promise<{ tag: string; payload: string }> => {
  // Status refreshes fire on every proxy change; unauthenticated GitHub allows 60 calls/h.
  const fresh = resolved.get(nightly);
  if (
    fresh &&
    Date.now() - fresh.at < LATEST_TAG_TTL_MS &&
    findPayload(fresh.payload)
  )
    return Promise.resolve(fresh.result);

  // Status warm-up and install can overlap; share one download/extract.
  let p = inflight.get(nightly);
  if (!p) {
    p = downloadLatest(nightly)
      .then((result) => {
        resolved.set(nightly, {
          at: Date.now(),
          payload: result.payload,
          result,
        });
        return result;
      })
      .finally(() => inflight.delete(nightly));
    inflight.set(nightly, p);
  }
  return p;
};

const resolved = new Map<
  boolean,
  { at: number; payload: string; result: { tag: string; payload: string } }
>();

const inflight = new Map<boolean, Promise<{ tag: string; payload: string }>>();

const downloadLatest = async (
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
    const extracted = await SevenZip.extractFile({
      filePath: archive,
      outputPath: dest,
    });
    fs.rmSync(archive, { force: true });
    if (!extracted.success)
      throw new Error(`Failed to extract OptiScaler ${tag}`);
    const payload = findPayload(dest);
    if (!payload)
      throw new Error("OptiScaler.dll not found in extracted release");
    return { tag, payload };
  } catch (err) {
    const tags = fs.existsSync(cache)
      ? fs
          .readdirSync(cache)
          .filter((d) => d.startsWith("OptiScaler_"))
          .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
      : [];
    for (const d of tags) {
      const payload = findPayload(path.join(cache, d));
      if (payload) return { tag: d.slice("OptiScaler_".length), payload };
    }
    throw err;
  }
};

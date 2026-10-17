import fs from "node:fs";
import path from "node:path";
import { net } from "electron";
import { parseCachedImageUrl } from "@shared";
import { SystemPath } from "./system-path";
import { logger } from "./logger";
import {
  IMAGE_CACHE_EXTENSIONS,
  MIME_FOR_EXTENSION,
  extensionForContentType,
  filesToEvict,
  imageCacheKey,
  type CachedFileInfo,
} from "./image-cache-core";

/** Catalogue artwork on disk, so the library renders from cache and offline. */

const MAX_CACHE_BYTES = 1024 * 1024 * 1024;

const cacheDir = () =>
  path.join(SystemPath.getPath("userData"), "image-cache", "assets");

const inFlight = new Map<string, Promise<string | null>>();

const findCached = (key: string) => {
  for (const ext of IMAGE_CACHE_EXTENSIONS) {
    const file = path.join(cacheDir(), `${key}.${ext}`);
    if (fs.existsSync(file)) return file;
  }
  return null;
};

/** Downloads `url` into the cache; null when it is not a fetchable image. */
const download = async (url: string, key: string) => {
  const response = await net.fetch(url);
  if (!response.ok) return null;
  const ext = extensionForContentType(response.headers.get("content-type"));
  if (!ext) return null;
  const bytes = Buffer.from(await response.arrayBuffer());
  fs.mkdirSync(cacheDir(), { recursive: true });
  const file = path.join(cacheDir(), `${key}.${ext}`);
  const temp = `${file}.${process.pid}.tmp`;
  await fs.promises.writeFile(temp, bytes);
  await fs.promises.rename(temp, file);
  return file;
};

const serveFile = async (file: string) => {
  // Touch for the size cap's least-recently-used order.
  const now = new Date();
  fs.promises.utimes(file, now, now).catch(() => {});
  const ext = path.extname(file).slice(1);
  return new Response(new Uint8Array(await fs.promises.readFile(file)), {
    headers: {
      "content-type": MIME_FOR_EXTENSION[ext] ?? "application/octet-stream",
      "cache-control": "public, max-age=31536000, immutable",
      // Animated covers are drawn to a canvas for their poster frame.
      "access-control-allow-origin": "*",
    },
  });
};

/** `protocol.handle("cached-image", …)`: serves from disk, fetching once on a miss. */
export const handleCachedImageRequest = async (request: Request) => {
  const url = parseCachedImageUrl(request.url);
  if (!url) return new Response(null, { status: 400 });

  const key = imageCacheKey(url);
  const cached = findCached(key);
  if (cached) return serveFile(cached);

  let pending = inFlight.get(key);
  if (!pending) {
    pending = download(url, key)
      .catch((error) => {
        logger.warn("Image cache: download failed", url, error);
        return null;
      })
      .finally(() => inFlight.delete(key));
    inFlight.set(key, pending);
  }
  const file = await pending;
  if (file) return serveFile(file);
  // Not an image (e.g. a video cover) or not reachable: pass straight through.
  return net.fetch(url).catch(() => new Response(null, { status: 404 }));
};

/** Startup sweep: keeps the cache under 1 GB, dropping the least recently used. */
export const pruneImageCache = async () => {
  const dir = cacheDir();
  if (!fs.existsSync(dir)) return;
  const names = await fs.promises.readdir(dir);
  const files: CachedFileInfo[] = [];
  for (const name of names) {
    const file = path.join(dir, name);
    const stat = await fs.promises.stat(file).catch(() => null);
    if (stat?.isFile()) {
      files.push({
        path: file,
        sizeBytes: stat.size,
        lastUsedMs: stat.mtimeMs,
      });
    }
  }
  for (const file of filesToEvict(files, MAX_CACHE_BYTES)) {
    await fs.promises.rm(file, { force: true });
  }
};

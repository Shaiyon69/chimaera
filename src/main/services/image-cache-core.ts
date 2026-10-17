import { createHash } from "node:crypto";

const EXTENSIONS: Record<string, string> = {
  "image/webp": "webp",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/gif": "gif",
  "image/avif": "avif",
  "image/svg+xml": "svg",
  "image/x-icon": "ico",
  "image/vnd.microsoft.icon": "ico",
};

export const IMAGE_CACHE_EXTENSIONS = [...new Set(Object.values(EXTENSIONS))];

export const imageCacheKey = (url: string) =>
  createHash("sha256").update(url).digest("hex");

/** File extension for an image content type; null for anything that is not an image. */
export const extensionForContentType = (contentType: string | null) =>
  EXTENSIONS[(contentType ?? "").split(";")[0].trim().toLowerCase()] ?? null;

export const MIME_FOR_EXTENSION: Record<string, string> = Object.fromEntries(
  Object.entries(EXTENSIONS).map(([mime, ext]) => [ext, mime])
);

export interface CachedFileInfo {
  path: string;
  sizeBytes: number;
  lastUsedMs: number;
}

/** Files to delete so the cache fits `maxBytes`, least recently used first. */
export const filesToEvict = (files: CachedFileInfo[], maxBytes: number) => {
  let total = files.reduce((sum, f) => sum + f.sizeBytes, 0);
  const evict: string[] = [];
  for (const file of [...files].sort((a, b) => a.lastUsedMs - b.lastUsedMs)) {
    if (total <= maxBytes) break;
    evict.push(file.path);
    total -= file.sizeBytes;
  }
  return evict;
};

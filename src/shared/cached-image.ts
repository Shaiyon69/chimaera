/** Scheme served by the main process from a disk cache of catalogue images. */
export const CACHED_IMAGE_SCHEME = "cached-image";

/**
 * Routes a remote catalogue image through the local disk cache, so it renders
 * offline once seen. Local, data and other non-http(s) URLs pass through.
 */
export const cachedImage = <T extends string | null | undefined>(url: T): T => {
  if (typeof url !== "string" || !/^https?:\/\//i.test(url)) return url;
  return `${CACHED_IMAGE_SCHEME}:${encodeURIComponent(url)}` as T;
};

/** The original URL of a `cached-image:` URL, or null if it is not one. */
export const parseCachedImageUrl = (url: string): string | null => {
  const prefix = `${CACHED_IMAGE_SCHEME}:`;
  if (!url.startsWith(prefix)) return null;
  try {
    const original = decodeURIComponent(url.slice(prefix.length));
    return /^https?:\/\//i.test(original) ? original : null;
  } catch {
    return null;
  }
};

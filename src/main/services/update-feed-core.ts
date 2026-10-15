type Release = {
  tag_name: string;
  draft: boolean;
  prerelease: boolean;
  assets: { name: string }[];
};

/**
 * Newest app release: published, stable and carrying the update manifest. electron-updater's
 * own GitHub provider takes whatever release is "latest", so a data-only release (the
 * Bloodborne port) published later would otherwise break updates with "Cannot find latest.yml".
 */
export const pickUpdateTag = (
  releases: Release[],
  manifest: string
): string | null =>
  releases.find(
    (r) =>
      !r.draft && !r.prerelease && r.assets.some((a) => a.name === manifest)
  )?.tag_name ?? null;

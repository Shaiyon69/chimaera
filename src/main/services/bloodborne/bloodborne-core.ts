import fs from "node:fs";
import path from "node:path";

/** A port install: the launch script and the built executable. */
export const isPortDir = (dir: string): boolean =>
  fs.existsSync(path.join(dir, "run.bat")) &&
  fs.existsSync(path.join(dir, "out", "bbport.exe"));

export interface PortRelease {
  tag: string;
  url: string;
  sha256: string;
}

/** The release zip and its GitHub-provided sha256 from a releases/latest payload; null if either is missing. */
export const pickPortRelease = (release: unknown): PortRelease | null => {
  const r = (release && typeof release === "object" ? release : {}) as {
    tag_name?: unknown;
    assets?: {
      name?: unknown;
      browser_download_url?: unknown;
      digest?: unknown;
    }[];
  };
  const asset = Array.isArray(r.assets)
    ? r.assets.find(
        (a) => typeof a.name === "string" && a.name.endsWith("_release.zip")
      )
    : undefined;
  const sha256 =
    typeof asset?.digest === "string"
      ? /^sha256:([0-9a-f]{64})$/i.exec(asset.digest)?.[1]
      : undefined;
  if (
    typeof r.tag_name !== "string" ||
    typeof asset?.browser_download_url !== "string" ||
    !sha256
  )
    return null;
  return {
    tag: r.tag_name,
    url: asset.browser_download_url,
    sha256: sha256.toLowerCase(),
  };
};

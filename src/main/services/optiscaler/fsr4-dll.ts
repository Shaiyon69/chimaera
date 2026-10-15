import { app } from "electron";
import axios from "axios";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { SevenZip } from "../7zip";
import { logger } from "../logger";

const API =
  "https://api.github.com/repos/zgauthier2000/fsr4-shader-performance-overrides/releases?per_page=30";
const ARCHIVES = {
  desktop: "fsr4.1.1-cyboman.zip",
  igpu: "fsr4.1.1-igpu-cyboman.zip",
} as const;
const DLL = "amd_fidelityfx_upscaler_dx12.dll";
const TAG_PREFIX = "dll-";

export type Fsr4Variant = "exact" | "lossy";
export type Fsr4Family = keyof typeof ARCHIVES;

const cacheDir = () => path.join(app.getPath("userData"), "optiscaler", "fsr4");
const dllPath = (tag: string, family: Fsr4Family, variant: Fsr4Variant) =>
  path.join(cacheDir(), tag, family, variant, DLL);

const hasFamily = (tag: string, family: Fsr4Family) =>
  fs.existsSync(dllPath(tag, family, "exact")) &&
  fs.existsSync(dllPath(tag, family, "lossy"));

const sha256 = (file: string) =>
  crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");

/** Parses `sha256sum` output into a map of relative path -> hash. */
export const parseSums = (text: string): Map<string, string> =>
  new Map(
    text
      .split(/\r?\n/)
      .map((l) => l.match(/^([0-9a-f]{64})\s+\*?(.+)$/i))
      .filter((m): m is RegExpMatchArray => !!m)
      .map((m) => [m[2].trim(), m[1].toLowerCase()])
  );

const newestCachedTag = (family: Fsr4Family): string | null => {
  const dir = cacheDir();
  if (!fs.existsSync(dir)) return null;
  return (
    fs
      .readdirSync(dir)
      .filter((t) => t.startsWith(TAG_PREFIX) && hasFamily(t, family))
      .sort()
      .pop() ?? null
  );
};

/** Downloaded DLL for a variant, without touching the network. */
export const cachedFsr4Dll = (
  family: Fsr4Family,
  variant: Fsr4Variant
): string | null => {
  const tag = newestCachedTag(family);
  return tag ? dllPath(tag, family, variant) : null;
};

const download = async (url: string, dest: string) => {
  const res = await axios.get(url, {
    responseType: "arraybuffer",
    timeout: 120000,
  });
  fs.writeFileSync(dest, Buffer.from(res.data));
};

/** Fetches the newest FSR4 DLL release for a GPU family into the cache; falls back to the newest cached one when offline. */
export const ensureFsr4Dlls = async (
  family: Fsr4Family
): Promise<string | null> => {
  const archiveName = ARCHIVES[family];
  try {
    const { data } = await axios.get(API, {
      headers: { Accept: "application/vnd.github+json" },
      timeout: 30000,
    });
    const rel = (
      data as {
        tag_name: string;
        assets: { name: string; browser_download_url: string }[];
      }[]
    ).find((r) => r.tag_name.startsWith(TAG_PREFIX));
    if (!rel) throw new Error("No FSR4 DLL release found");

    const tag = rel.tag_name;
    if (hasFamily(tag, family)) return tag;

    const asset = (name: string) =>
      rel.assets.find((a) => a.name === name)?.browser_download_url;
    const archiveUrl = asset(archiveName);
    const sumsUrl = asset("SHA256SUMS");
    if (!archiveUrl || !sumsUrl)
      throw new Error(`Release ${tag} is missing ${archiveName} or SHA256SUMS`);

    // Stage per family so desktop and igpu archives can share one tag folder.
    const dest = path.join(cacheDir(), tag);
    const tmp = path.join(cacheDir(), `${tag}.${family}.tmp`);
    fs.rmSync(tmp, { recursive: true, force: true });
    fs.mkdirSync(tmp, { recursive: true });

    const archive = path.join(tmp, archiveName);
    await download(archiveUrl, archive);
    const { data: sumsText } = await axios.get<string>(sumsUrl, {
      responseType: "text",
      timeout: 30000,
    });
    const sums = parseSums(sumsText);

    if (sha256(archive) !== sums.get(archiveName))
      throw new Error(`Checksum mismatch for ${archiveName}`);
    const extracted = await SevenZip.extractFile({
      filePath: archive,
      outputPath: tmp,
    });
    if (!extracted.success) throw new Error(`Failed to extract ${archiveName}`);
    fs.rmSync(archive, { force: true });

    for (const variant of ["exact", "lossy"] as const) {
      const rel = `${family}/${variant}/${DLL}`;
      const file = path.join(tmp, ...rel.split("/"));
      if (!fs.existsSync(file) || sha256(file) !== sums.get(rel))
        throw new Error(`Bad or missing ${rel} in ${archiveName}`);
    }

    fs.mkdirSync(dest, { recursive: true });
    fs.rmSync(path.join(dest, family), { recursive: true, force: true });
    fs.renameSync(path.join(tmp, family), path.join(dest, family));
    fs.rmSync(tmp, { recursive: true, force: true });
    return tag;
  } catch (err) {
    logger.error("Failed to fetch FSR4 DLLs", err);
    return newestCachedTag(family);
  }
};

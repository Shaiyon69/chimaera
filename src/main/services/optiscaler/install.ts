import fs from "node:fs";
import path from "node:path";
import { configureIni, type Fsr4Mode } from "./ini.js";

export const MARKER = "optiscaler_manager.json";
export const BACKUP = ".optiscaler_backup";
export const FSR4_DLL = "amd_fidelityfx_upscaler_dx12.dll";
export const PROXIES = [
  "dxgi.dll",
  "winmm.dll",
  "version.dll",
  "dbghelp.dll",
  "d3d12.dll",
  "wininet.dll",
  "winhttp.dll",
];

export interface Marker {
  version: string;
  proxy: string;
  files: string[];
  backed_up: string[];
}

export const readMarker = (exeDir: string): Marker | null => {
  try {
    const m: Marker = JSON.parse(
      fs.readFileSync(path.join(exeDir, MARKER), "utf-8")
    );
    // Other tools (the Bloodborne port) write a marker of the same name.
    return PROXIES.includes(m.proxy) ? m : null;
  } catch {
    return null;
  }
};

const writeMarker = (exeDir: string, m: Marker) =>
  fs.writeFileSync(path.join(exeDir, MARKER), JSON.stringify(m, null, 2));

const listFiles = (root: string): string[] =>
  fs
    .readdirSync(root, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) =>
      path
        .relative(root, path.join(e.parentPath, e.name))
        .split(path.sep)
        .join("/")
    );

export const uninstall = (exeDir: string, keepIni = false) => {
  const m = readMarker(exeDir);
  if (!m) throw new Error("No install marker found");
  for (const rel of m.files) {
    if (keepIni && rel.toLowerCase() === "optiscaler.ini") continue;
    fs.rmSync(path.join(exeDir, rel), { force: true });
  }
  const backup = path.join(exeDir, BACKUP);
  for (const rel of m.backed_up) {
    const src = path.join(backup, rel);
    if (!fs.existsSync(src)) continue;
    const dst = path.join(exeDir, rel);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.renameSync(src, dst);
  }
  fs.rmSync(backup, { recursive: true, force: true });
  fs.rmSync(path.join(exeDir, MARKER), { force: true });
  // prune empty dirs we created
  const root = path.resolve(exeDir);
  for (const rel of [...m.files].sort((a, b) => b.length - a.length)) {
    let d = path.dirname(path.resolve(exeDir, rel));
    while (d !== root && fs.existsSync(d) && fs.readdirSync(d).length === 0) {
      fs.rmdirSync(d);
      d = path.dirname(d);
    }
  }
};

/**
 * Copy the release payload into exeDir, backing up anything it replaces.
 * The marker is written before copying, so a failure rolls back through uninstall()
 * to the game's original files instead of leaving a half-installed folder.
 */
export const install = (opts: {
  payload: string;
  exeDir: string;
  proxy: string;
  tag: string;
  fsr4Dll?: string | null;
  fsr4Mode?: Fsr4Mode;
  api?: string;
}): [string, string][] => {
  const { payload, exeDir, proxy, tag, fsr4Dll, api = "unknown" } = opts;
  const fsr4Mode = opts.fsr4Mode ?? (fsr4Dll ? "dll" : null);
  const old = readMarker(exeDir);
  if (!old && fs.existsSync(path.join(exeDir, MARKER)))
    throw new Error("Another tool's optiscaler_manager.json is in this folder");
  if (old) uninstall(exeDir, true); // restore originals first so backups stay the true originals

  const backup = path.join(exeDir, BACKUP);
  const copied: string[] = [];
  const backed: string[] = [];
  const marker: Marker = {
    version: tag,
    proxy,
    files: copied,
    backed_up: backed,
  };
  writeMarker(exeDir, marker);

  const backUp = (dst: string, rel: string) => {
    const b = path.join(backup, rel);
    fs.mkdirSync(path.dirname(b), { recursive: true });
    fs.renameSync(dst, b);
    backed.push(rel);
  };

  const put = (src: string, rel: string) => {
    const dst = path.join(exeDir, rel);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    if (fs.existsSync(dst)) {
      if (rel.toLowerCase() === "optiscaler.ini") {
        // still ours from the previous install: keep the user's settings
        if (old?.files.includes("OptiScaler.ini")) copied.push(rel);
        return;
      }
      backUp(dst, rel);
    }
    fs.copyFileSync(src, dst);
    copied.push(rel);
  };

  try {
    for (let rel of listFiles(payload)) {
      if (rel.startsWith("!!") || rel.toLowerCase().startsWith("setup_"))
        continue;
      const src = path.join(payload, rel);
      if (rel.toLowerCase() === "optiscaler.dll") rel = proxy;
      put(src, rel);
      writeMarker(exeDir, marker);
    }
    if (fsr4Dll) {
      const dst = path.join(exeDir, FSR4_DLL);
      if (fs.existsSync(dst) && !copied.includes(FSR4_DLL))
        backUp(dst, FSR4_DLL);
      fs.copyFileSync(fsr4Dll, dst);
      if (!copied.includes(FSR4_DLL)) copied.push(FSR4_DLL);
    }
    writeMarker(exeDir, marker);
    return configureIni(path.join(exeDir, "OptiScaler.ini"), api, fsr4Mode);
  } catch (err) {
    try {
      uninstall(exeDir);
    } catch {
      // rollback is best effort; the original error matters more
    }
    throw err;
  }
};

import fs from "node:fs";
import path from "node:path";

export const GAME_DIR_NAME = "CUSA03173";

/** Choice tables mirror the port's launcher.py so launcher_settings.json keeps its meaning. */
export const RES_NATIVE = "1920x1080 (Native)";
export const RES_CHOICES = [RES_NATIVE, "1280x720", "2560x1440", "3840x2160"];
export const FPS_CHOICES = ["uncap", "60", "90", "30"];
export const WINDOW_MODES = ["Windowed", "Borderless", "Fullscreen"];
const ANISO_CHOICES: Record<string, string> = {
  "16x": "16",
  "8x": "8",
  "4x": "4",
  "2x": "2",
  Off: "0",
};
export const FROM_MENU = "From in-game menu";
export const UPSCALER_CHOICES: Record<string, string> = {
  [FROM_MENU]: "",
  "Off (native)": "off",
  "TAA (native AA)": "taa",
  "FSR 3.1": "fsr3",
  "FSR 4 (INT8)": "fsr4",
  "FSR 4.1.1": "fsr411",
};
const PRESET_CHOICES: Record<string, string> = {
  [FROM_MENU]: "",
  "Native AA (x1)": "0",
  "Quality (x1.5)": "1",
  "Balanced (x1.7)": "2",
  "Performance (x2)": "3",
  "Ultra Performance (x3, lite model)": "4",
};

export interface BbSettings {
  /** eboot.bin path or the game folder. */
  eboot: string;
  fps: string;
  res: string;
  aniso: string;
  windowMode: string;
  upscaler: string;
  preset: string;
  mods: boolean;
  featOverlay: boolean;
  featHud: boolean;
  featFpsPatch: boolean;
  featResScaling: boolean;
  enabledPatches: string[];
}

export const DEFAULT_BB_SETTINGS: BbSettings = {
  eboot: "",
  fps: "uncap",
  res: RES_NATIVE,
  aniso: "16x",
  windowMode: "Windowed",
  upscaler: FROM_MENU,
  preset: FROM_MENU,
  mods: true,
  featOverlay: true,
  featHud: false,
  featFpsPatch: true,
  featResScaling: true,
  enabledPatches: [],
};

const pick = (v: unknown, allowed: string[], d: string) =>
  typeof v === "string" && allowed.includes(v) ? v : d;
const bool = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);
const key = (v: unknown, table: Record<string, string>, d: string) =>
  typeof v === "string" && v in table ? v : d;

/** Parses launcher_settings.json; unknown or invalid values fall back to defaults. */
export const readLauncherSettings = (raw: unknown): BbSettings => {
  const s = (raw && typeof raw === "object" ? raw : {}) as Record<
    string,
    unknown
  >;
  const d = DEFAULT_BB_SETTINGS;
  const res =
    s.res === "Default (1080p)" || s.res === "1920x1080" ? RES_NATIVE : s.res;
  const windowMode =
    s.window_mode ?? (s.fullscreen ? "Fullscreen" : "Windowed");

  return {
    eboot: typeof s.eboot === "string" ? s.eboot : d.eboot,
    fps: pick(s.fps, FPS_CHOICES, d.fps),
    res: pick(res, RES_CHOICES, d.res),
    aniso: key(s.aniso, ANISO_CHOICES, d.aniso),
    windowMode: pick(windowMode, WINDOW_MODES, d.windowMode),
    upscaler: key(
      s.upscaler,
      UPSCALER_CHOICES,
      s.feat_upscaler === false ? "Off (native)" : FROM_MENU
    ),
    preset: key(s.preset, PRESET_CHOICES, FROM_MENU),
    mods: bool(s.mods, d.mods),
    featOverlay: bool(s.feat_overlay, d.featOverlay),
    featHud: bool(s.feat_hud, d.featHud),
    featFpsPatch: bool(s.feat_fps_patch, d.featFpsPatch),
    featResScaling: bool(s.feat_res_scaling, d.featResScaling),
    enabledPatches: Array.isArray(s.enabled_patches)
      ? s.enabled_patches.filter((p): p is string => typeof p === "string")
      : [],
  };
};

/** Game folder for an eboot.bin path or a folder containing it, else null. */
export const resolveGameDir = (target: string): string | null => {
  const p = target.trim().replace(/^"|"$/g, "");
  if (!p) return null;
  try {
    const st = fs.statSync(p);
    if (st.isFile() && path.basename(p).toLowerCase() === "eboot.bin")
      return path.dirname(p);
    if (st.isDirectory() && fs.existsSync(path.join(p, "eboot.bin"))) return p;
  } catch {
    // not found
  }
  return null;
};

/** Environment run.bat expects. Optional vars are removed, not blanked. */
export const buildLaunchEnv = (
  s: BbSettings,
  gameDir: string,
  base: NodeJS.ProcessEnv
): NodeJS.ProcessEnv => {
  const env: NodeJS.ProcessEnv = { ...base };
  const set = (k: string, v: string | undefined) => {
    if (v) env[k] = v;
    else delete env[k];
  };

  env.BB_GAME_DIR = gameDir;
  env.BB_FPS = s.fps;
  env.BB_MODS_ENABLED = s.mods ? "1" : "0";
  set("BB_UPSCALER", UPSCALER_CHOICES[s.upscaler]);
  set("BB_UPSCALE_PRESET", PRESET_CHOICES[s.preset]);
  set("BB_OVERLAY", s.featOverlay ? undefined : "0");
  set("BB_HUD", s.featHud ? "1" : undefined);
  set("BB_FPS_PATCH", s.featFpsPatch ? undefined : "0");
  set(
    "BB_RENDER_RES",
    s.featResScaling && s.res !== RES_NATIVE ? s.res : undefined
  );

  const mode = s.windowMode.toLowerCase();
  env.BB_WINDOW_MODE = mode;
  env.BB_FULLSCREEN = mode !== "windowed" ? "1" : "0";
  env.BB_FRAMES_AHEAD ??= "2";
  env.BB_ANISO = ANISO_CHOICES[s.aniso] ?? "16";
  set("BB_PATCHES", [...s.enabledPatches].sort().join(";"));
  return env;
};

/** Missing pieces that make launching fail. Empty list = ready. */
export const preflight = (
  portDir: string,
  gameDir: string | null,
  systemRoot = process.env.SystemRoot ?? "C:\\Windows"
): string[] => {
  const problems: string[] = [];
  if (!gameDir) problems.push("eboot.bin not found in the selected path");
  for (const rel of ["run.bat", "out/bbport.exe", "out/SDL3.dll"])
    if (!fs.existsSync(path.join(portDir, rel)))
      problems.push(`missing ${rel}`);
  if (!fs.existsSync(path.join(systemRoot, "System32", "vulkan-1.dll")))
    problems.push("vulkan-1.dll not found (install a GPU driver)");
  return problems;
};

/** A port install: the launch script and the built executable. */
export const isPortDir = (dir: string): boolean =>
  fs.existsSync(path.join(dir, "run.bat")) &&
  fs.existsSync(path.join(dir, "out", "bbport.exe"));

/** The port installed beside the chosen game folder wins over the bundled one. */
export const resolvePortDir = (
  bundled: string,
  gameDir: string | null
): string => {
  const beside = gameDir ? path.dirname(gameDir) : null;
  return beside && isPortDir(beside) ? beside : bundled;
};

/** Likely CUSA03173 locations, most specific first. */
export const gameDirCandidates = (
  portDir: string,
  searchRoots: string[],
  drives: string[]
): string[] => {
  const out = [
    path.join(portDir, "..", GAME_DIR_NAME),
    path.join(portDir, GAME_DIR_NAME),
  ];
  for (const drive of drives) {
    out.push(
      path.join(drive, GAME_DIR_NAME),
      path.join(drive, "Games", GAME_DIR_NAME),
      path.join(drive, "Games", "Bloodborne", GAME_DIR_NAME),
      path.join(drive, "External Apps", "Games", "Bloodborne", GAME_DIR_NAME)
    );
  }
  for (const root of searchRoots)
    out.push(...findNamed(root, GAME_DIR_NAME, 2));
  return out;
};

/** Folders called `name` at most `depth` levels under `root`. */
const findNamed = (root: string, name: string, depth: number): string[] => {
  if (depth < 0) return [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return [];
  }
  const dirs = entries.filter((e) => e.isDirectory());
  return [
    ...dirs.filter((e) => e.name === name).map((e) => path.join(root, e.name)),
    ...dirs.flatMap((e) => findNamed(path.join(root, e.name), name, depth - 1)),
  ];
};

export const findGameDir = (candidates: string[]): string | null => {
  for (const c of candidates) {
    const dir = resolveGameDir(c);
    if (dir) return dir;
  }
  return null;
};

/** Patch names exactly as the port's Bloodborne.xml / launcher.py spell them. */
export const POPULAR_PATCHES = [
  "Skip Intro",
  "Performance Patch (perf increase)",
  "Disable Motion Blur (perf increase)",
];

/** launcher_settings.json in launcher.py's snake_case keys; inverse of readLauncherSettings. */
export const toLauncherSettingsJson = (s: BbSettings) => ({
  eboot: s.eboot,
  fps: s.fps,
  res: s.res,
  aniso: s.aniso,
  window_mode: s.windowMode,
  upscaler: s.upscaler,
  preset: s.preset,
  mods: s.mods,
  feat_overlay: s.featOverlay,
  feat_hud: s.featHud,
  feat_fps_patch: s.featFpsPatch,
  feat_res_scaling: s.featResScaling,
  enabled_patches: s.enabledPatches,
});

// Top-level folders of the game's dvdroot_ps4 (mirrors scripts/mods.py GAME_FOLDERS).
const GAME_FOLDERS = new Set(
  "action chr event facegen font map menu movie msg mtd obj other param paramdef parts remo script sfx shader sound".split(
    " "
  )
);
const DOC_EXTENSIONS = new Set([".txt", ".md", ".jpg", ".png", ".ini"]);

const hasChild = (dir: string, name: string) => {
  try {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .some((e) => e.isDirectory() && e.name.toLowerCase() === name);
  } catch {
    return false;
  }
};

/** Whether the port's mods.py (content_root) accepts this folder as a mod. */
export const isModFolder = (dir: string): boolean => {
  let entries: fs.Dirent[];
  try {
    entries = fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((e) => !e.name.startsWith("."));
  } catch {
    return false;
  }
  if (
    hasChild(dir, "dvdroot_ps4") ||
    ["app0", "cusa03173"].some(
      (w) =>
        hasChild(dir, w) &&
        hasChild(path.join(dir, entryName(entries, w)), "dvdroot_ps4")
    )
  )
    return true;

  const folders = entries.filter((e) => e.isDirectory());
  if (
    folders.length &&
    folders.every((e) => GAME_FOLDERS.has(e.name.toLowerCase()))
  )
    return true;

  const onlyDocs = entries
    .filter((e) => e.isFile())
    .every((e) => DOC_EXTENSIONS.has(path.extname(e.name).toLowerCase()));
  return folders.length === 1 && onlyDocs
    ? isModFolder(path.join(dir, folders[0].name))
    : false;
};

const entryName = (entries: fs.Dirent[], lower: string) =>
  entries.find((e) => e.name.toLowerCase() === lower)?.name ?? lower;

export interface ModEntry {
  name: string;
  enabled: boolean;
}

/** mods.json as mods.py reads it: `order` first, new folders appended alphabetically. */
export const listMods = (
  modsDir: string,
  config: { order?: unknown; disabled?: unknown } | null
): ModEntry[] => {
  let found: string[];
  try {
    found = fs
      .readdirSync(modsDir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && isModFolder(path.join(modsDir, e.name)))
      .map((e) => e.name)
      .sort(
        (a, b) =>
          a.toLowerCase().localeCompare(b.toLowerCase()) || +(a > b) - +(a < b)
      );
  } catch {
    return [];
  }
  const strings = (v: unknown) =>
    Array.isArray(v) ? v.filter((n): n is string => typeof n === "string") : [];
  const disabled = new Set(strings(config?.disabled));
  const names = new Set([...strings(config?.order), ...found]);
  return [...names]
    .filter((n) => found.includes(n))
    .map((name) => ({ name, enabled: !disabled.has(name) }));
};

export const toModsConfig = (mods: ModEntry[]) => ({
  order: mods.map((m) => m.name),
  disabled: mods.filter((m) => !m.enabled).map((m) => m.name),
});

/** Mod names become folder names: no separators or dot segments. */
export const isSafeModName = (name: string) =>
  name.length > 0 &&
  name === path.basename(name) &&
  name !== "." &&
  name !== "..";

/** `{fsr4: true}` from `bb-gpu-capabilities.exe --upscalers`. A missing key means unknown. */
export const parseCaps = (stdout: string): Record<string, boolean> => {
  const caps: Record<string, boolean> = {};
  for (const line of stdout.split(/\r?\n/)) {
    const eq = line.indexOf("=");
    if (eq !== -1)
      caps[line.slice(0, eq).trim()] = line.slice(eq + 1).trim() === "1";
  }
  return caps;
};

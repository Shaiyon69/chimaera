import { app, dialog, shell } from "electron";
import { execFile, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type {
  GameShop,
  ShopAssets,
  ShopDetails,
  SteamAchievement,
} from "@types";
import { gamesSublevel, levelKeys } from "@main/level";
import { getDownloadsPath } from "@main/events/helpers/get-downloads-path";
import { logger } from "../logger";
import { SevenZip } from "../7zip";
import { SystemPath } from "../system-path";
import { downloadedPortDir } from "./bloodborne-port-installer";
import { WindowManager } from "../window-manager";
import {
  buildLaunchEnv,
  findGameDir,
  FPS_CHOICES,
  POPULAR_PATCHES,
  RES_CHOICES,
  UPSCALER_CHOICES,
  WINDOW_MODES,
  gameDirCandidates,
  isModFolder,
  isPortDir,
  isSafeModName,
  listMods,
  parseCaps,
  preflight,
  readLauncherSettings,
  resolveGameDir,
  resolvePortDir,
  toLauncherSettingsJson,
  toModsConfig,
  type BbSettings,
  type ModEntry,
} from "./bloodborne-core";

/** Port shipped with the app (older builds) or the repo-root copy in dev; else the in-app download. */
const bundledPortDir = () => {
  const shipped = app.isPackaged
    ? path.join(process.resourcesPath, "bloodborne-port")
    : path.join(__dirname, "..", "..", "bloodborne-port");
  return isPortDir(shipped) ? shipped : downloadedPortDir();
};

/** Port beside the chosen game folder (an existing install), else the bundled one. */
const portDir = () =>
  resolvePortDir(bundledPortDir(), resolveGameDir(loadSettings().eboot));

/** Writable: the bundle can sit in a read-only install dir. */
const dataDir = () => path.join(SystemPath.getPath("userData"), "bloodborne");

const driveRoots = () =>
  "CDEFGHIJKLMNOPQRSTUVWXYZ"
    .split("")
    .map((l) => `${l}:\\`)
    .filter((d) => fs.existsSync(d));

const settingsFile = () => path.join(dataDir(), "launcher_settings.json");

const loadSettings = (): BbSettings => {
  try {
    return readLauncherSettings(
      JSON.parse(fs.readFileSync(settingsFile(), "utf-8"))
    );
  } catch {
    return readLauncherSettings(null);
  }
};

/** Setup is done once the saved game folder still holds eboot.bin. */
const isConfigured = () =>
  fs.existsSync(settingsFile()) &&
  resolveGameDir(loadSettings().eboot) !== null;

export const saveBloodborneSetup = (settings: BbSettings) => {
  const gameDir = resolveGameDir(settings.eboot);
  if (!gameDir) throw new Error("eboot.bin not found in the selected folder");
  fs.mkdirSync(dataDir(), { recursive: true });
  fs.writeFileSync(
    settingsFile(),
    JSON.stringify(
      toLauncherSettingsJson({ ...settings, eboot: gameDir }),
      null,
      2
    )
  );
};

/** Clearing the executable path undoes setup, so Install asks for the game folder again. */
export const resetBloodborneSetup = () =>
  fs.rmSync(settingsFile(), { force: true });

const modsDir = () => path.join(dataDir(), "mods");
const modsConfigFile = () => path.join(dataDir(), "mods.json");

const readModsConfig = () => {
  try {
    return JSON.parse(fs.readFileSync(modsConfigFile(), "utf-8"));
  } catch {
    return null;
  }
};

export const getBloodborneMods = () => ({
  enabled: loadSettings().mods,
  mods: listMods(modsDir(), readModsConfig()),
});

export const saveBloodborneMods = (state: {
  enabled: boolean;
  mods: ModEntry[];
}) => {
  fs.mkdirSync(dataDir(), { recursive: true });
  fs.writeFileSync(
    modsConfigFile(),
    JSON.stringify(toModsConfig(state.mods), null, 2)
  );
  // The master switch lives in launcher_settings.json (BB_MODS_ENABLED).
  if (fs.existsSync(settingsFile()))
    fs.writeFileSync(
      settingsFile(),
      JSON.stringify(
        toLauncherSettingsJson({ ...loadSettings(), mods: state.enabled }),
        null,
        2
      )
    );
};

/** Copies a mod folder, or extracts an archive, into the mods folder. Null when cancelled. */
export const addBloodborneMod = async (
  kind: "folder" | "archive"
): Promise<string | null> => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title:
      kind === "folder"
        ? "Select a Bloodborne mod folder"
        : "Select a Bloodborne mod archive",
    properties: [kind === "folder" ? "openDirectory" : "openFile"],
    filters:
      kind === "archive"
        ? [{ name: "Archives", extensions: ["zip", "7z", "rar"] }]
        : undefined,
  });
  const source = filePaths[0];
  if (canceled || !source) return null;

  const name = path.basename(
    source,
    kind === "folder" ? "" : path.extname(source)
  );
  const dest = path.join(modsDir(), name);
  if (!isSafeModName(name)) throw new Error("invalid mod name");
  if (fs.existsSync(dest)) throw new Error("mod already added");

  try {
    if (kind === "folder")
      await fs.promises.cp(source, dest, { recursive: true });
    else await SevenZip.extractFile({ filePath: source, outputPath: dest });
    if (!isModFolder(dest)) throw new Error("not a Bloodborne mod");
  } catch (error) {
    await fs.promises.rm(dest, { recursive: true, force: true });
    throw error;
  }
  return name;
};

export const removeBloodborneMod = async (name: string) => {
  if (!isSafeModName(name)) throw new Error("invalid mod name");
  await fs.promises.rm(path.join(modsDir(), name), {
    recursive: true,
    force: true,
  });
};

export const openBloodborneModsFolder = async () => {
  fs.mkdirSync(modsDir(), { recursive: true });
  await shell.openPath(modsDir());
};

export const selectBloodborneGameDir = async (): Promise<string | null> => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: "Select your Bloodborne CUSA03173 folder (contains eboot.bin)",
    properties: ["openDirectory"],
  });
  return canceled ? null : resolveGameDir(filePaths[0] ?? "");
};

const detectUpscalers = (): Promise<Record<string, boolean>> => {
  const exe = path.join(portDir(), "out", "bb-gpu-capabilities.exe");
  if (!fs.existsSync(exe)) return Promise.resolve({});
  return new Promise((resolve) =>
    execFile(
      exe,
      ["--upscalers"],
      { timeout: 20000, windowsHide: true },
      (err, stdout) => resolve(err ? {} : parseCaps(stdout))
    )
  );
};

/** The port's own launcher_settings.json beside the game folder, used to seed first-time setup. */
const importPortSettings = (gameDir: string | null): BbSettings | null => {
  if (!gameDir) return null;
  try {
    return readLauncherSettings(
      JSON.parse(
        fs.readFileSync(
          path.join(path.dirname(gameDir), "launcher_settings.json"),
          "utf-8"
        )
      )
    );
  } catch {
    return null;
  }
};

export const getBloodborneSetup = async () => {
  const configured = isConfigured();
  const downloads = await getDownloadsPath().catch(() => null);
  const detected = findGameDir(
    gameDirCandidates(
      bundledPortDir(),
      downloads ? [downloads] : [],
      driveRoots()
    )
  );
  const settings =
    (!configured && importPortSettings(detected)) || loadSettings();
  return {
    configured,
    portInstalled: isPortDir(portDir()),
    settings: {
      ...settings,
      eboot: resolveGameDir(settings.eboot) ?? detected ?? "",
    },
    upscalerSupport: await detectUpscalers(),
    choices: {
      fps: FPS_CHOICES,
      res: RES_CHOICES,
      windowMode: WINDOW_MODES,
      upscalers: UPSCALER_CHOICES,
      patches: POPULAR_PATCHES,
    },
  };
};

const fail = (problems: string[]) => {
  logger.error("Bloodborne launch failed", { problems });
  WindowManager.sendToAppWindows("on-bloodborne-launch-error", problems);
  return null;
};

/** Art the user drops in resources/bloodborne; missing files become null. */
const artDir = () =>
  app.isPackaged
    ? path.join(process.resourcesPath, "bloodborne")
    : path.join(__dirname, "..", "..", "resources", "bloodborne");

const art = (name: string) => {
  const file = path.join(artDir(), name);
  return fs.existsSync(file) ? `local:${file}` : null;
};

export const BLOODBORNE_OBJECT_ID = "bloodborne";

export const bloodborneShopAssets = (): ShopAssets => ({
  objectId: BLOODBORNE_OBJECT_ID,
  shop: "custom",
  title: "Bloodborne",
  iconUrl: art("icon.png"),
  libraryHeroImageUrl: art("hero.jpg"),
  libraryImageUrl: art("header.png"),
  logoImageUrl: art("logo.png"),
  logoPosition: null,
  coverImageUrl: art("cover.png"),
  downloadSources: [],
});

const SCREENSHOT_FILES = [
  "001",
  "008",
  "015",
  "046",
  "054",
  "062",
  "070",
  "078",
  "086",
].map((n) => `screenshot-${n}.jpg`);

// Figures from the port README (github.com/Shaiyon69/bloodborne_pc_windows_port)
// and early player reports (RX 6650 XT + Ryzen 5 5600X: 89-100 FPS at 1080p).
const REQUIREMENTS = {
  minimum:
    '<ul class="bb_ul"><li><strong>OS:</strong> Windows 10 (1903+) 64-bit</li>' +
    "<li><strong>Processor:</strong> Intel Core 4th gen (Haswell) or AMD Ryzen, with AVX2</li>" +
    "<li><strong>Memory:</strong> 6 GB free (RAM + page file)</li>" +
    "<li><strong>Graphics:</strong> Vulkan 1.3 GPU: GeForce GTX 1060, Radeon RX 480 or Intel Arc A380</li>" +
    "<li><strong>Additional Notes:</strong> Python 3.10+. Your own decrypted CUSA03173 v1.09 dump (eboot.bin). Target: 30-60 FPS at 720p-1080p with an upscaler.</li></ul>",
  recommended:
    '<ul class="bb_ul"><li><strong>OS:</strong> Windows 11 64-bit</li>' +
    "<li><strong>Processor:</strong> AMD Ryzen 5 5600X or better</li>" +
    "<li><strong>Memory:</strong> 10 GB free (RAM + page file) for 1440p/4K output</li>" +
    "<li><strong>Graphics:</strong> Radeon RX 6650 XT / GeForce RTX 3060 or better (RTX 20-series+ for DLSS)</li>" +
    "<li><strong>Additional Notes:</strong> Current vendor drivers. Reported: 89-100 FPS at 1080p on an RX 6650 XT; about 90 FPS at 4K with FSR 4 Balanced on an RX 7800 XT.</li></ul>",
};

export const bloodborneShopDetails = (): ShopDetails => {
  const about =
    "Hunt your nightmares in the gothic city of Yharnam. Native Windows port of the PlayStation 4 game: bring your own CUSA03173 dump.";
  const description =
    "<p>Face your fears as you search for answers in the ancient city of Yharnam, now cursed with a strange endemic illness spreading through the streets like wildfire. Danger, death and madness lurk around every corner of this dark and horrifying world, and you must discover its darkest secrets in order to survive.</p>" +
    "<ul><li>Fast, aggressive combat built around trick weapons and the regain system.</li>" +
    "<li>Interconnected gothic world, optional chalice dungeons and three endings.</li>" +
    "<li>The Old Hunters expansion adds the Hunter's Nightmare and new bosses.</li></ul>" +
    "<p><strong>PC port notes:</strong> this is a native Windows build of the PlayStation 4 game, not an emulator. It needs your own decrypted CUSA03173 v1.09 dump and supports FSR, DLSS and TAA upscaling plus FPS and resolution patches.</p>";
  return {
    objectId: BLOODBORNE_OBJECT_ID,
    name: "Bloodborne",
    steam_appid: 0,
    detailed_description: description,
    about_the_game: description,
    short_description: about,
    screenshots: SCREENSHOT_FILES.flatMap((name, id) => {
      const url = art(name);
      return url ? [{ id, path_thumbnail: url, path_full: url }] : [];
    }),
    developers: ["FromSoftware"],
    publishers: ["Sony Interactive Entertainment"],
    genres: [
      { id: "1", name: "Action" },
      { id: "3", name: "RPG" },
    ],
    supported_languages: "English",
    pc_requirements: REQUIREMENTS,
    mac_requirements: { minimum: "", recommended: "" },
    linux_requirements: { minimum: "", recommended: "" },
    release_date: { coming_soon: false, date: "24 Mar, 2015" },
    content_descriptors: { ids: [] },
  } as ShopDetails;
};

// [displayName, description, hidden]; no trophy hooks in the port, so these only display.
const TROPHIES: [string, string, boolean][] = [
  ["Bloodborne", "All trophies acquired. Hats off!", false],
  ["Yharnam Sunrise", "You lived through the hunt, and saw another day.", true],
  [
    "Honouring Wishes",
    "Captivated by the moon presence, you pledge to watch over the hunter's dream.",
    true,
  ],
  [
    "Childhood's Beginning",
    "You became an infant Great One, lifting humanity into its next childhood.",
    true,
  ],
  ["Hunter's Essence", "Acquire all hunter weapons.", false],
  ["Hunter's Craft", "Acquire all special hunter tools.", false],
  ["Weapon Master", "Acquire a weapon of the highest level.", false],
  ["Blood Gem Master", "Acquire an extremely precious blood gem.", false],
  ["Rune Master", "Acquire an extremely precious Caryll Rune.", false],
  ["Cainhurst", "Gain entry to Cainhurst, the lost and ruined castle.", false],
  [
    "The Choir",
    "Gain entry to the realm of the Choir, the high stratum of the Healing Church.",
    false,
  ],
  [
    "The Source of the Dream",
    "Discover the abandoned old workshop, the source of the hunter's dream.",
    false,
  ],
  [
    "Nightmare Lecture Building",
    "Gain entry into the Byrgenwerth lecture building, that drifts within the realm of nightmare.",
    false,
  ],
  [
    "Blood Gem Contact",
    "Acquire a blood gem that imbues hunter weapons with special strength.",
    false,
  ],
  [
    "Rune Contact",
    "Acquire a Caryll Rune that endows hunters with special strength.",
    false,
  ],
  [
    "Chalice of Pthumeru",
    "Acquire the Chalice of Pthumeru that seals the catacombs that form a web deep below Yharnam.",
    false,
  ],
  [
    "Chalice of Ailing Loran",
    "Acquire the Chalice of Ailing Loran that seals the tragic land lost to the sands.",
    false,
  ],
  [
    "Chalice of Isz",
    "Acquire the Great Chalice of Isz that seals the home of the cosmic kin.",
    false,
  ],
  ["Cleric Beast", "Defeat the Cleric Beast.", false],
  ["Father Gascoigne", "Defeat Father Gascoigne.", false],
  ["Blood-starved Beast", "Defeat the Blood-starved Beast.", false],
  ["Vicar Amelia", "Defeat Vicar Amelia.", false],
  ["Shadow of Yharnam", "Defeat the Shadows of Yharnam.", false],
  ["Rom, the Vacuous Spider", "Defeat Rom, the Vacuous Spider.", false],
  ["The One Reborn", "Defeat The One Reborn.", false],
  [
    "Micolash, Host of the Nightmare",
    "Defeat Micolash, Host of the Nightmare.",
    false,
  ],
  ["Mergo's Wet Nurse", "Defeat Mergo's Wet Nurse.", false],
  ["Martyr Logarius", "Defeat Martyr Logarius.", false],
  ["Darkbeast Paarl", "Defeat Darkbeast Paarl.", false],
  ["Amygdala", "Defeat Great One: Amygdala.", false],
  ["Celestial Emissary", "Defeat the Celestial Emissary.", false],
  [
    "Ebrietas, Daughter of the Cosmos",
    "Defeat Ebrietas, Daughter of the Cosmos.",
    false,
  ],
  ["The Witch of Hemwick", "Defeat the Witch of Hemwick.", false],
  [
    "Yharnam, Pthumerian Queen",
    "Defeat Yharnam, Blood Queen of the Old Labyrinth.",
    false,
  ],
  ["Old Hunter's Essence", "Acquire all old hunter weapons.", false],
  ["Orphan of Kos", "Defeat Great One: Orphan of Kos.", false],
  [
    "Ludwig, the Holy Blade",
    "Defeat the beast that was once Ludwig, the Holy Blade.",
    false,
  ],
  [
    "Lady Maria of the Astral Clocktower",
    "Defeat Lady Maria of the Astral Clocktower.",
    false,
  ],
  [
    "Living Failures",
    "Defeat the failed attempts to become Great Ones.",
    false,
  ],
  [
    "Laurence, the First Vicar",
    "Defeat the beast that was once Laurence, the First Vicar.",
    false,
  ],
];

export const bloodborneAchievements = (): SteamAchievement[] => {
  const icon = art("icon.png") ?? art("cover.png") ?? "";
  return TROPHIES.map(([displayName, description, hidden]) => ({
    name: displayName.toUpperCase().replace(/[^A-Z0-9]+/g, "_"),
    displayName,
    description,
    icon,
    icongray: icon,
    hidden,
  }));
};

// A second run.bat would rewrite out/ under the running game and kill it.
let launching = false;

export const launchBloodborne = async (shop: GameShop, objectId: string) => {
  if (launching) {
    logger.warn("Bloodborne is already running");
    return null;
  }
  const port = portDir();

  // The setup modal offers the port download when it is missing.
  if (!isPortDir(port) || !isConfigured()) {
    WindowManager.sendToAppWindows(
      "on-bloodborne-setup-required",
      shop,
      objectId
    );
    return null;
  }

  const settings = loadSettings();
  const gameDir = resolveGameDir(settings.eboot);
  const problems = preflight(port, gameDir);
  if (problems.length || !gameDir) return fail(problems);

  const data = dataDir();
  fs.mkdirSync(data, { recursive: true });
  const env = buildLaunchEnv(settings, gameDir, process.env);
  env.BB_DATA_DIR = data;
  // run.bat falls back to a system Python when none is bundled.
  const python = path.join(bundledPortDir(), "python", "python.exe");
  if (fs.existsSync(python)) env.PYTHON = python;

  // ".\" because NoDefaultCurrentDirectoryInExePath=1 stops cmd finding run.bat in cwd.
  const log = fs.createWriteStream(path.join(data, "launcher.log"));
  const proc = spawn("cmd.exe", ["/d", "/c", ".\\run.bat"], {
    cwd: port,
    env,
    // Not detached: without a console the port's bbport.exe crashes at boot (exit 139)
    // and Python children each open their own window.
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  launching = true;
  proc.stdout?.pipe(log, { end: false });
  proc.stderr?.pipe(log, { end: false });
  proc.once("error", (error) => {
    logger.error("Bloodborne spawn failed", error);
    launching = false;
    log.end();
  });
  proc.once("close", (code) => {
    launching = false;
    log.write(`[EXIT] code ${code}\n`);
    log.end();
  });
  proc.unref();

  // Lets the process watcher track playtime; run.bat itself exits only with the game.
  const key = levelKeys.game(shop, objectId);
  const record = await gamesSublevel.get(key).catch(() => null);
  if (record) {
    await gamesSublevel.put(key, {
      ...record,
      executablePath: path.join(port, "run.bat"),
      executablePathUpdatedAt: new Date(),
      trackingExecutablePaths: [path.join(port, "out", "bbport.exe")],
      trackingExecutablePathsUpdatedAt: new Date(),
    });
  }

  return null;
};

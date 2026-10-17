// Exports everything the signed-in Hydra account has into hydra-backup/<timestamp>/,
// in the HydraBackup v1 format that Chimaera imports (src/main/services/hydra-backup).
// Usage: node scripts/hydra-backup-export.mjs <copy of userData/hydra-db> [outRoot]
// The token is read from the database copy and only sent to the Hydra API.
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { ClassicLevel } from "classic-level";

const [dbPath, outRoot = "hydra-backup"] = process.argv.slice(2);
if (!dbPath) {
  console.error(
    "usage: node scripts/hydra-backup-export.mjs <hydra-db copy> [outRoot]"
  );
  process.exit(1);
}

const env = Object.fromEntries(
  fs
    .readFileSync(".env", "utf-8")
    .split(/\r?\n/)
    .map((l) => /^([A-Z0-9_]+)=(.*)$/.exec(l.trim()))
    .filter(Boolean)
    .map((m) => [m[1], m[2].replace(/^["']|["']$/g, "")])
);
const API = env.MAIN_VITE_API_URL?.replace(/\/+$/, "");
if (!API) throw new Error("MAIN_VITE_API_URL missing in .env");

const db = new ClassicLevel(dbPath, { valueEncoding: "json" });
const auth = await db.get("auth").catch(() => null);
await db.close();
if (!auth?.accessToken)
  throw new Error("No Hydra session in the database copy");

let token = auth.accessToken;
if (Date.now() > auth.tokenExpirationTimestamp) {
  const r = await fetch(`${API}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: auth.refreshToken }),
  });
  if (!r.ok) throw new Error(`Token refresh failed: HTTP ${r.status}`);
  token = (await r.json()).accessToken;
}

const toQuery = (params = {}) => {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v == null) continue;
    for (const item of Array.isArray(v) ? v : [v]) q.append(k, String(item));
  }
  const s = q.toString();
  return s ? `?${s}` : "";
};

const api = async (method, url, { params, body } = {}) => {
  const r = await fetch(`${API}${url}${toQuery(params)}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) {
    const err = new Error(`${method} ${url}: HTTP ${r.status}`);
    err.status = r.status;
    throw err;
  }
  const text = await r.text();
  return text ? JSON.parse(text) : null;
};
const get = (url, params) => api("GET", url, { params });
const post = (url, body) => api("POST", url, { body });

const createdAt = new Date();
const dir = path.resolve(
  outRoot,
  createdAt.toISOString().replace(/[:.]/g, "-")
);
fs.mkdirSync(path.join(dir, "files"), { recursive: true });

const backup = {
  version: 1,
  createdAt: createdAt.toISOString(),
  appVersion: `export-script`,
  user: { id: "", displayName: null },
  sections: {},
  data: {},
  files: [],
};

const section = async (name, fn) => {
  try {
    const value = await fn();
    backup.data[name] = value;
    backup.sections[name] = {
      ok: true,
      count: Array.isArray(value) ? value.length : value == null ? 0 : 1,
    };
    return value;
  } catch (e) {
    backup.sections[name] = { ok: false, count: 0, error: e.message };
    return undefined;
  }
};

const addFile = async (rel, url, source = url, headers = {}) => {
  const relPath = `files/${rel}`;
  const target = path.join(dir, relPath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const r = await fetch(url, { headers });
  if (!r.ok || !r.body) throw new Error(`download HTTP ${r.status}`);
  const hash = createHash("sha256");
  let size = 0;
  await pipeline(
    Readable.fromWeb(r.body),
    async function* (src) {
      for await (const chunk of src) {
        hash.update(chunk);
        size += chunk.length;
        yield chunk;
      }
    },
    fs.createWriteStream(target)
  );
  backup.files.push({
    path: relPath,
    sha256: hash.digest("hex"),
    sizeBytes: size,
    source,
  });
  return relPath;
};

const PAGE = 100;
const allPages = async (url, params = {}) => {
  const out = [];
  for (let skip = 0; ; skip += PAGE) {
    const page = await get(url, { ...params, take: PAGE, skip });
    const items = Array.isArray(page) ? page : [];
    out.push(...items);
    if (items.length < PAGE) return out;
  }
};

const me = await section("me", () => get("/profile/me"));
if (!me?.id) throw new Error("Could not read /profile/me");
backup.user = { id: me.id, displayName: me.displayName ?? null };

await section("profile", () =>
  get(`/users/${me.id}`, { shop: ["steam", "launchbox"] })
);
await section("stats", () => get(`/users/${me.id}/stats`));
const library =
  (await section("library", async () => {
    const lists = await Promise.all([
      allPages("/profile/games"),
      allPages("/profile/games", { shop: "launchbox" }).catch(() => []),
      allPages("/profile/games/hidden").catch(() => []),
      allPages("/profile/games/hidden", { shop: "launchbox" }).catch(() => []),
    ]);
    return lists.flat();
  })) ?? [];
await section("reviews", () => get(`/users/${me.id}/reviews`));
await section("souvenirs", async () => {
  const items = [];
  for (let skip = 0; ; skip += PAGE) {
    const page = await get(`/users/${me.id}/souvenirs`, {
      take: PAGE,
      skip,
      sortBy: "recent",
      shop: ["steam", "launchbox"],
    });
    const pageItems = page?.items ?? [];
    items.push(...pageItems);
    if (pageItems.length < PAGE) return items;
  }
});
await section("collections", () => get("/profile/games/collections"));
await section("friends", () =>
  get("/profile/friends", { take: PAGE, skip: 0 })
);
await section("blocks", () => get("/profile/blocks", { take: PAGE, skip: 0 }));
await section("badges", () => get("/badges"));
await section("notifications", () => get("/profile/notifications"));
await section("downloadSources", () => get("/profile/download-sources"));
await section("steamIntegration", () => get("/profile/integrations/steam"));
await section("retroAchievementsIntegration", () =>
  get("/profile/integrations/retroachievements")
);

const achievements = {};
const artifacts = {};
const cloudSaves = {};
const gameErrors = {};
const noteError = (key, what, e) =>
  (gameErrors[key] ??= []).push(`${what}: ${e.message}`);
let cloudAllowed = !!me.subscription;

for (const [i, game] of library.entries()) {
  if (!game?.objectId || !game?.shop) continue;
  process.stdout.write(`\rgames ${i + 1}/${library.length}`);
  const key = `${game.shop}:${game.objectId}`;
  const slug = `${game.shop}-${game.objectId}`.replace(/[<>:"/\\|?*]+/g, "_");

  await get(`/users/${me.id}/games/achievements`, {
    shop: game.shop,
    objectId: game.objectId,
  })
    .then((list) => {
      if (Array.isArray(list) && list.length) achievements[key] = list;
    })
    .catch((e) => noteError(key, "achievements", e));

  if (!cloudAllowed || game.shop === "custom") continue;

  await get("/profile/games/artifacts", {
    objectId: game.objectId,
    shop: game.shop,
  })
    .then(async (list) => {
      if (!Array.isArray(list) || !list.length) return;
      const saved = [];
      for (const a of list) {
        const d = await post(`/profile/games/artifacts/${a.id}/download`);
        const file = await addFile(
          `cloud-artifacts/${slug}/${a.id}.tar`,
          d.downloadUrl,
          `artifact:${a.id}`
        );
        saved.push({
          ...a,
          homeDir: d.homeDir,
          winePrefixPath: d.winePrefixPath,
          backupFile: file,
        });
      }
      artifacts[key] = saved;
    })
    .catch((e) => {
      if (e.status === 401 || e.status === 402 || e.status === 403)
        cloudAllowed = false;
      noteError(key, "cloud artifacts", e);
    });

  await get("/profile/cloud-saves/snapshots", {
    shop: game.shop,
    objectId: game.objectId,
  })
    .then(async (list) => {
      const [snapshot] = Array.isArray(list) ? list : [];
      if (!snapshot) return;
      const manifest = await get(
        "/profile/cloud-saves/snapshot-restore-manifest",
        { snapshotId: snapshot.id }
      );
      const urls = await get("/profile/cloud-saves/snapshot-download-urls", {
        snapshotId: snapshot.id,
      });
      const files = [];
      const done = new Set();
      for (const f of Array.isArray(urls) ? urls : []) {
        const rel = `cloud-saves/${slug}/${f.hash}`;
        if (!done.has(f.hash)) {
          await addFile(
            rel,
            f.downloadUrl,
            `snapshot:${snapshot.id}:${f.hash}`
          );
          done.add(f.hash);
        }
        const { downloadUrl: _url, ...meta } = f;
        files.push({ ...meta, backupFile: `files/${rel}` });
      }
      cloudSaves[key] = { snapshot, manifest, files };
    })
    .catch((e) => noteError(key, "cloud saves", e));
}
process.stdout.write("\n");

backup.data.achievements = achievements;
backup.sections.achievements = {
  ok: true,
  count: Object.keys(achievements).length,
};
backup.data.cloudArtifacts = artifacts;
backup.sections.cloudArtifacts = {
  ok: true,
  count: Object.keys(artifacts).length,
};
backup.data.cloudSaves = cloudSaves;
backup.sections.cloudSaves = {
  ok: true,
  count: Object.keys(cloudSaves).length,
};
if (Object.keys(gameErrors).length) backup.data.gameErrors = gameErrors;

if (cloudAllowed) {
  const kinds = [
    ["ps1", "duckstation"],
    ["ps2", "pcsx2"],
    ["psp", "ppsspp"],
    ["gamecube", "dolphin"],
    ["wii", "dolphin"],
  ];
  await section("emulationSaves", async () => {
    const out = [];
    for (const [platform, emulator] of kinds) {
      const list = await get("/profile/emulation-saves", {
        platform,
        emulator,
        saveKind: "game_save",
      });
      for (const s of Array.isArray(list) ? list : []) {
        const { downloadUrl } = await post(
          `/profile/emulation-saves/${s.id}/download-url`
        );
        const name = String(s.fileName ?? s.id).replace(/[^a-z0-9._-]+/gi, "_");
        const file = await addFile(
          `emulation-saves/${platform}/${s.id}-${name}`,
          downloadUrl,
          `emulation-save:${s.id}`
        );
        out.push({ ...s, platform, emulator, backupFile: file });
      }
    }
    return out;
  });
} else {
  backup.sections.emulationSaves = {
    ok: false,
    count: 0,
    error: "no Hydra Cloud subscription",
  };
}

// Avatar, background and souvenir pictures.
const imageKeys = new Set([
  "profileImageUrl",
  "backgroundImageUrl",
  "imageUrl",
  "souvenirImageUrl",
]);
const urls = new Set();
const walk = (v) => {
  if (Array.isArray(v)) v.forEach(walk);
  else if (v && typeof v === "object")
    for (const [k, c] of Object.entries(v)) {
      if (imageKeys.has(k) && typeof c === "string" && /^https?:\/\//.test(c))
        urls.add(c);
      else walk(c);
    }
};
walk([
  backup.data.me,
  backup.data.profile,
  achievements,
  backup.data.souvenirs,
]);
const images = {};
let i = 0;
for (const url of urls) {
  process.stdout.write(`\rimages ${++i}/${urls.size}`);
  const ext = (
    /\.[a-z0-9]{1,5}$/i.exec(new URL(url).pathname)?.[0] ?? ""
  ).toLowerCase();
  await addFile(`images/${i}${ext}`, url)
    .then((rel) => (images[url] = rel))
    .catch(() => {});
}
process.stdout.write("\n");
backup.data.images = images;
backup.sections.images = { ok: true, count: Object.keys(images).length };

fs.writeFileSync(
  path.join(dir, "backup.json"),
  JSON.stringify(backup, null, 2)
);

// Verify every file against its recorded size and hash.
let bad = 0;
for (const f of backup.files) {
  const p = path.join(dir, f.path);
  const ok =
    fs.existsSync(p) &&
    fs.statSync(p).size === f.sizeBytes &&
    createHash("sha256").update(fs.readFileSync(p)).digest("hex") === f.sha256;
  if (!ok) bad++;
}

console.log(`Backup: ${dir}`);
for (const [name, s] of Object.entries(backup.sections)) {
  console.log(`  ${name}: ${s.ok ? s.count : `FAILED (${s.error})`}`);
}
console.log(`files: ${backup.files.length}, bad: ${bad}`);
if (Object.keys(gameErrors).length)
  console.log(
    `per-game errors: ${Object.keys(gameErrors).length} games (see data.gameErrors)`
  );

import fs from "node:fs";
import path from "node:path";

const SKIP = [
  "unins",
  "crash",
  "launcher",
  "redist",
  "unitycrash",
  "vc_redist",
  "dxsetup",
  "eac",
  "easyanticheat",
  "benchmark",
];
const AC_NAMES = [
  "easyanticheat",
  "beservice",
  "battleye",
  "vgk",
  "mhyprot",
  "equ8",
  "xigncode",
  "nprotect",
];
const API_MARKS: [Buffer, string][] = (
  [
    ["d3d12", "dx12"],
    ["d3d11", "dx11"],
    ["vulkan-1", "vulkan"],
  ] as const
).flatMap(([n, a]) => [
  [Buffer.from(n, "ascii"), a] as [Buffer, string],
  [Buffer.from(n, "utf16le"), a] as [Buffer, string],
]);

const walk = (
  root: string,
  maxDepth: number,
  visit: (dir: string, entry: fs.Dirent) => void
) => {
  const rec = (dir: string, depth: number) => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      visit(dir, e);
      if (e.isDirectory() && !e.name.startsWith(".") && depth + 1 < maxDepth)
        rec(path.join(dir, e.name), depth + 1);
    }
  };
  rec(root, 0);
};

/** Largest non-launcher exe up to 5 levels deep; prefers Unreal `*-Win64-Shipping.exe`. */
export const findMainExe = (gameDir: string): string | null => {
  let best: string | null = null;
  let bestSize = -1;
  walk(gameDir, 5, (dir, e) => {
    const low = e.name.toLowerCase();
    if (!e.isFile() || !low.endsWith(".exe")) return;
    if (SKIP.some((s) => low.includes(s))) return;
    const p = path.join(dir, e.name);
    let size: number;
    try {
      size = fs.statSync(p).size;
    } catch {
      return;
    }
    if (low.endsWith("-win64-shipping.exe")) size += 2 ** 40;
    if (size > bestSize) {
      best = p;
      bestSize = size;
    }
  });
  return best;
};

/** Heuristic graphics API from DLL names embedded in the exe. */
export const detectApi = (exePath: string | null): string => {
  if (!exePath) return "unknown";
  const found = new Set<string>();
  try {
    const fd = fs.openSync(exePath, "r");
    try {
      const buf = Buffer.alloc(1 << 20);
      let tail: Buffer = Buffer.alloc(0);
      let n: number;
      while ((n = fs.readSync(fd, buf, 0, buf.length, null)) > 0) {
        const chunk = Buffer.concat([tail, buf.subarray(0, n)]);
        const lower = Buffer.from(chunk.toString("latin1").toLowerCase(), "latin1");
        for (const [needle, name] of API_MARKS)
          if (lower.includes(needle)) found.add(name);
        tail = chunk.subarray(Math.max(0, chunk.length - 24));
      }
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return "unknown";
  }
  return ["dx12", "dx11", "vulkan"].find((a) => found.has(a)) ?? "unknown";
};

/** Name of the first anti-cheat file/folder within 4 levels, else null. */
export const detectAnticheat = (gameDir: string): string | null => {
  let hit: string | null = null;
  walk(gameDir, 4, (_dir, e) => {
    if (hit) return;
    const low = e.name.toLowerCase();
    if (AC_NAMES.some((a) => low.includes(a))) hit = e.name;
  });
  return hit;
};

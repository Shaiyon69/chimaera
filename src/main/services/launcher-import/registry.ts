import { execFile } from "node:child_process";

export interface RegEntry {
  /** Last path segment of the key. */
  name: string;
  /** Path of the key below the queried root. */
  path: string;
  values: Record<string, string>;
}

export interface UninstallProgram {
  keyName: string;
  displayName: string;
  installLocation: string;
  publisher: string;
  uninstallString: string;
}

const UNINSTALL = String.raw`SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall`;

/** Parses `reg query <root> /s` output. Keys directly under root come back as depth-1 entries. */
export const parseRegQuery = (text: string, root: string): RegEntry[] => {
  const entries: RegEntry[] = [];
  const rootLower = root.toLowerCase().replace(/^hk[a-z_]+\\/, "");
  let current: RegEntry | null = null;

  for (const line of text.split(/\r?\n/)) {
    if (/^HKEY_/i.test(line)) {
      const full = line.trim().replace(/^HKEY_[A-Z_]+\\/i, "");
      const idx = full.toLowerCase().indexOf(rootLower);
      const rel =
        idx === 0 ? full.slice(rootLower.length).replace(/^\\/, "") : full;
      current = rel
        ? { name: rel.split("\\").pop() ?? rel, path: rel, values: {} }
        : null;
      if (current) entries.push(current);
      continue;
    }
    const m = /^\s{4}(.+?)\s{4}REG_\w+(?:\s{4}(.*))?$/.exec(line);
    if (m && current) current.values[m[1]] = (m[2] ?? "").trim();
  }
  return entries;
};

const regQuery = (
  hive: "HKLM" | "HKCU",
  key: string,
  view: 32 | 64
): Promise<RegEntry[]> =>
  new Promise((resolve) => {
    const root = `${hive}\\${key}`;
    execFile(
      "reg",
      ["query", root, "/s", `/reg:${view}`],
      { maxBuffer: 64 * 1024 * 1024, windowsHide: true },
      (error, stdout) =>
        resolve(error ? [] : parseRegQuery(String(stdout), root))
    );
  });

/** Registry keys under `key` for HKLM in the requested view. Empty when missing or not on Windows. */
export const queryKey = (key: string, view: 32 | 64 = 64) =>
  process.platform === "win32"
    ? regQuery("HKLM", key, view)
    : Promise.resolve([]);

export const toUninstallPrograms = (entries: RegEntry[]): UninstallProgram[] =>
  entries
    .filter((e) => !e.path.includes("\\") && e.values.DisplayName)
    .map((e) => ({
      keyName: e.name,
      displayName: e.values.DisplayName,
      installLocation: (e.values.InstallLocation ?? "").replace(/^"|"$/g, ""),
      publisher: e.values.Publisher ?? "",
      uninstallString: e.values.UninstallString ?? "",
    }));

/** Installed-programs list, as Windows shows it: HKLM (both views) plus HKCU. */
export const listUninstallPrograms = async (): Promise<UninstallProgram[]> => {
  if (process.platform !== "win32") return [];
  const lists = await Promise.all([
    regQuery("HKLM", UNINSTALL, 64),
    regQuery("HKLM", UNINSTALL, 32),
    regQuery("HKCU", UNINSTALL, 64),
  ]);
  const seen = new Set<string>();
  return lists.flatMap(toUninstallPrograms).filter((p) => {
    const id = `${p.keyName}|${p.installLocation}`.toLowerCase();
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
};

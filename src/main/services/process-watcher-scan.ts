import path from "node:path";

export const isValidProcessWatcherScan = <T>(scan: T | null): scan is T =>
  scan !== null;

export const startOptionalExecutableCatalogueLoad = (
  loadOptionalExecutableCatalogue: () => Promise<boolean>
) => {
  void loadOptionalExecutableCatalogue().catch(() => false);
};

const winKey = (p: string) => path.win32.normalize(p).toLowerCase();

/** Windows paths are case-insensitive and may mix separators. */
export const hasWindowsPathMatch = (
  processMap: Map<string, Set<string>>,
  matchPath: string
) => {
  const name = path.win32.basename(matchPath).toLowerCase();
  const want = winKey(matchPath);
  return [...(processMap.get(name) ?? [])].some((e) => winKey(e) === want);
};

/** True when any running process executes from inside `dir`. */
export const hasProcessUnderDir = (
  processMap: Map<string, Set<string>>,
  dir: string
) => {
  const prefix = winKey(dir).replace(/\\+$/, "") + "\\";
  for (const exes of processMap.values())
    for (const e of exes) if (winKey(e).startsWith(prefix)) return true;
  return false;
};

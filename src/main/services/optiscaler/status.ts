import fs from "node:fs";
import path from "node:path";
import { MARKER } from "./install";

/** "live" if OptiScaler.log (written after install) shows the FSR4 4.1.x DLL, "loaded" if only OptiScaler ran, else null. */
export const loadedState = (exeDir: string): "live" | "loaded" | null => {
  const log = path.join(exeDir, "OptiScaler.log");
  try {
    const st = fs.statSync(log);
    const marker = fs.statSync(path.join(exeDir, MARKER));
    if (!st.isFile() || st.mtimeMs < marker.mtimeMs) return null;
    const fd = fs.openSync(log, "r");
    try {
      const len = Math.min(st.size, 2 << 20);
      const buf = Buffer.alloc(len);
      fs.readSync(fd, buf, 0, len, st.size - len);
      return buf.toString("utf-8").includes("4.1.1") ? "live" : "loaded";
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return null;
  }
};

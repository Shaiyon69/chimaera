import { execFile } from "node:child_process";

/** native: RDNA4 runs AMD's own FSR4, no override DLL. desktop/igpu pick the matching override zip. */
export type Fsr4Gpu = "native" | "desktop" | "igpu";

const NATIVE = /RX\s*9\d{3}|R9700|Radeon AI PRO/i;
const DESKTOP = /RX\s*[5-8]\d{3}|GeForce|RTX|GTX|Quadro|Arc\s*[AB]\d{2,3}\b/i;

/** Best card wins: a discrete GPU beats an iGPU in the same machine. */
export const classifyGpus = (names: string[]): Fsr4Gpu => {
  if (names.some((n) => NATIVE.test(n))) return "native";
  if (names.some((n) => DESKTOP.test(n))) return "desktop";
  // Unknown or undetected falls back to desktop, the pre-detection behavior.
  return names.length ? "igpu" : "desktop";
};

let cached: Promise<string[]> | null = null;

export const detectGpuNames = (): Promise<string[]> => {
  cached ??= new Promise((resolve) => {
    execFile(
      "powershell",
      [
        "-NoProfile",
        "-Command",
        "(Get-CimInstance Win32_VideoController).Name",
      ],
      { timeout: 10000, windowsHide: true },
      (err, stdout) =>
        resolve(
          err
            ? []
            : stdout
                .split(/\r?\n/)
                .map((l) => l.trim())
                .filter(Boolean)
        )
    );
  });
  return cached;
};

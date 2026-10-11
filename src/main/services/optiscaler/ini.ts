import fs from "node:fs";

/** Read a key from an ini file; if `value` is given, set it (appended when missing). Keys match across all sections. */
export const iniGetSet = (
  iniPath: string,
  key: string,
  value?: string
): string | null => {
  const lines = fs.existsSync(iniPath)
    ? fs.readFileSync(iniPath, "utf-8").split(/\r?\n/)
    : [];
  if (lines.at(-1) === "") lines.pop();

  let old: string | null = null;
  let found = false;
  for (let i = 0; i < lines.length; i++) {
    const eq = lines[i].indexOf("=");
    if (eq !== -1 && lines[i].slice(0, eq).trim() === key) {
      old = lines[i].slice(eq + 1).trim();
      found = true;
      if (value !== undefined) lines[i] = `${key}=${value}`;
      break;
    }
  }
  if (!found && value !== undefined) lines.push(`${key}=${value}`);
  if (value !== undefined) fs.writeFileSync(iniPath, lines.join("\n") + "\n");
  return old;
};

const UPSCALER_KEYS: Record<string, [string, string][]> = {
  dx12: [["Dx12Upscaler", "fsr31"]],
  dx11: [["Dx11Upscaler", "fsr31_12"]],
  vulkan: [["VulkanUpscaler", "fsr31_12"]],
  unknown: [
    ["Dx12Upscaler", "fsr31"],
    ["Dx11Upscaler", "fsr31_12"],
    ["VulkanUpscaler", "fsr31_12"],
  ],
};

/** Set FSR4-related keys that are still "auto". Never overrides the user's own values. */
export const configureIni = (
  iniPath: string,
  api: string,
  hasFsr4: boolean
): [string, string][] => {
  if (!fs.existsSync(iniPath)) return [];
  let wanted: [string, string][] = [
    ["LogToFile", "true"],
    ["LogLevel", "2"],
  ];
  if (hasFsr4) {
    wanted = [
      ["Fsr4Update", "true"],
      ["Fsr4ForceEnableInt8", "true"],
      ...(UPSCALER_KEYS[api] ?? UPSCALER_KEYS.unknown),
      ...wanted,
    ];
  }
  const done: [string, string][] = [];
  for (const [k, v] of wanted) {
    if ((iniGetSet(iniPath, k) ?? "").toLowerCase() === "auto") {
      iniGetSet(iniPath, k, v);
      done.push([k, v]);
    }
  }
  return done;
};

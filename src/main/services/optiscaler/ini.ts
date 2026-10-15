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

/** native: GPU runs AMD's own FSR4. dll: override DLL installed. null: no FSR4. */
export type Fsr4Mode = "native" | "dll" | null;

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
  fsr4: Fsr4Mode
): [string, string][] => {
  if (!fs.existsSync(iniPath)) return [];
  let wanted: [string, string][] = [
    ["LogToFile", "true"],
    ["LogLevel", "2"],
  ];
  if (fsr4) {
    wanted = [
      ["Fsr4Update", "true"],
      // RDNA4 runs FSR4 natively; INT8 is the fallback for the override DLL on older cards.
      ...(fsr4 === "dll" ? [["Fsr4ForceEnableInt8", "true"]] : []),
      ...(UPSCALER_KEYS[api] ?? UPSCALER_KEYS.unknown),
      ...wanted,
    ] as [string, string][];
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

const UPSCALERS = [
  "auto",
  "fsr31",
  "fsr31_12",
  "fsr21",
  "fsr21_12",
  "xess",
  "dlss",
];

export type ConfigField =
  | { key: string; type: "toggle" }
  | { key: string; type: "select"; options: string[] }
  | { key: string; type: "number"; min: number; max: number };

/** Allowlist of user-editable keys; the renderer can only touch these. */
export const CONFIG_FIELDS: ConfigField[] = [
  { key: "Dx12Upscaler", type: "select", options: UPSCALERS },
  { key: "Dx11Upscaler", type: "select", options: UPSCALERS },
  { key: "VulkanUpscaler", type: "select", options: UPSCALERS },
  { key: "FGType", type: "select", options: ["auto", "nofg", "optifg"] },
  { key: "Sharpness", type: "number", min: 0, max: 1 },
  { key: "Fsr4Update", type: "toggle" },
  { key: "Fsr4ForceEnableInt8", type: "toggle" },
  { key: "LogToFile", type: "toggle" },
  { key: "LogLevel", type: "select", options: ["0", "1", "2", "3", "4"] },
];

/** Fields whose key is present in the ini, with their current value. */
export const readConfig = (iniPath: string) =>
  CONFIG_FIELDS.flatMap((field) => {
    const value = iniGetSet(iniPath, field.key);
    return value === null ? [] : [{ ...field, value }];
  });

export const writeConfigValue = (
  iniPath: string,
  key: string,
  value: string
) => {
  const field = CONFIG_FIELDS.find((f) => f.key === key);
  if (!field || iniGetSet(iniPath, key) === null)
    throw new Error(`Unsupported setting: ${key}`);
  const num = Number(value);
  const valid =
    field.type === "toggle"
      ? value === "true" || value === "false"
      : field.type === "select"
        ? field.options.includes(value)
        : value.trim() !== "" && num >= field.min && num <= field.max;
  if (!valid) throw new Error(`Invalid value for ${key}: ${value}`);
  iniGetSet(iniPath, key, value);
};

export interface ThemePreset {
  id: string;
  name: string;
  css: string;
  /** swatch colours: background, surface, accent */
  preview: [string, string, string];
}

export const DEFAULT_PRESET = "oled";
const STORAGE_KEY = "chimaera.themePreset";

// Pure #000 surfaces (pixels off) separated by borders, grayscale accent.
export const THEME_PRESETS: ThemePreset[] = [
  {
    id: "oled",
    name: "OLED",
    css: `:root {
      --bg: #000; --backdrop: #000; --shade: 0 0 0;
      --glass-1: #000; --glass-2: #000; --glass-3: #000;
      --line: rgb(255 255 255 / 0.16); --line-strong: rgb(255 255 255 / 0.3);
      --accent: #fff; --accent-text: #fff; --on-accent: #000;
      --selection-bg: #fff; --selection-text: #000;
    }`,
    preview: ["#000", "#000", "#fff"],
  },
  {
    id: "crimson",
    name: "Crimson",
    css: ":root { --accent: #e5303c; --accent-text: #ff6b74; }",
    preview: ["#000", "#0f0f0f", "#e5303c"],
  },
  {
    id: "midnight",
    name: "Midnight",
    css: `:root {
      --bg: #0b1020; --backdrop: #0b1020; --shade: 11 16 32;
      --glass-1: #121a30; --glass-2: #162039; --glass-3: #1b2644;
      --accent: #6e8bff; --accent-text: #9db1ff;
    }`,
    preview: ["#0b1020", "#162039", "#6e8bff"],
  },
  {
    id: "glass",
    name: "Glass",
    css: `:root {
      --bg: #12141a; --bg-2: rgb(0 0 0 / 0.26); --shade: 10 12 18;
      --backdrop:
        radial-gradient(900px 600px at 8% -10%, rgb(10 132 255 / 0.3), transparent 60%),
        radial-gradient(800px 600px at 100% 105%, rgb(191 90 242 / 0.2), transparent 60%),
        radial-gradient(600px 400px at 90% 0%, rgb(48 209 200 / 0.1), transparent 60%),
        rgb(10 12 18 / 0.58);
      --glass-1: rgb(34 38 50 / 0.34); --glass-2: rgb(30 34 46 / 0.5); --glass-3: rgb(24 27 38 / 0.66);
      --blur: blur(30px) saturate(180%);
      --rim: inset 0 1px 0 rgb(255 255 255 / 0.16), inset 0 0 0 0.5px rgb(255 255 255 / 0.12);
      --lift: 0 10px 30px rgb(0 0 0 / 0.28), 0 2px 6px rgb(0 0 0 / 0.18);
    }`,
    preview: ["#1b2233", "#2a3040", "#0a84ff"],
  },
];

// Must come after the app CSS to beat tokens.scss, but before Hydra's
// #custom-css so user themes still layer on top.
function applyPreset(css: string) {
  let el = document.getElementById("theme-preset");
  if (!el) {
    el = document.createElement("style");
    el.id = "theme-preset";
    document.head.insertBefore(el, document.getElementById("custom-css"));
  }
  el.textContent = css;
}

export function getPresetId(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? DEFAULT_PRESET;
  } catch {
    return DEFAULT_PRESET;
  }
}

export function setPreset(id: string) {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // storage blocked: preset still applies for this session
  }
  applyPreset(THEME_PRESETS.find((p) => p.id === id)?.css ?? "");
}

export function loadPreset() {
  setPreset(getPresetId());
}

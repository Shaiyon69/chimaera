// Builds the Bloodborne PC port from source (or takes a built one) and copies its runtime
// files into ./bloodborne-port for bundling (see electron-builder.yml).
// usage: node scripts/stage-bloodborne-port.mjs [path-to-built-port]
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPO = "https://github.com/Shaiyon69/bloodborne_pc_windows_port.git";
// Pinned so a package build is reproducible; bump deliberately.
const COMMIT = "fc026c3bb6d5befb5d773f6b4339377cc7202e35";

// run.bat needs Python 3; ship the embeddable build so players need not install it.
const PYTHON_URL =
  "https://www.python.org/ftp/python/3.12.10/python-3.12.10-embed-amd64.zip";
const PYTHON_SHA256 =
  "4acbed6dd1c744b0376e3b1cf57ce906f9dc9e95e68824584c8099a63025a3c3";
// run.bat never uses bb-probe.exe (250 MB). The rest are Windows system DLLs copied
// into out/ by the build; they must not be redistributed.
const SKIP = new Set([
  "bb-probe.exe",
  "wsock32.dll",
  "bcryptprimitives.dll",
  "gdiplus.dll",
]);

const run = (cmd, args, cwd) =>
  execFileSync(cmd, args, { cwd, stdio: "inherit" });

const buildFromSource = () => {
  const dir = path.join(root, ".cache", "bloodborne-port-src");
  if (!fs.existsSync(path.join(dir, ".git"))) {
    fs.mkdirSync(path.dirname(dir), { recursive: true });
    run("git", ["config", "--global", "core.longpaths", "true"]);
    run("git", ["clone", "--recursive", REPO, dir]);
  }
  run("git", ["fetch", "origin"], dir);
  run("git", ["checkout", COMMIT], dir);
  run("git", ["submodule", "update", "--init", "--recursive"], dir);
  if (!fs.existsSync(path.join(dir, "out", "bbport.exe"))) {
    run("cmd.exe", ["/d", "/c", "build.bat"], dir);
  }
  return dir;
};

if (process.platform !== "win32" && !process.argv[2]) {
  console.log("Bloodborne port is Windows-only: skipping");
  process.exit(0);
}

const src = process.argv[2] ?? buildFromSource();
for (const required of ["out/bbport.exe", "out/SDL3.dll", "run.bat"]) {
  if (!fs.existsSync(path.join(src, required))) {
    console.error(`${required} not found in ${src}: the port build failed`);
    process.exit(1);
  }
}

const dest = path.join(root, "bloodborne-port");
fs.rmSync(dest, { recursive: true, force: true });
fs.mkdirSync(path.join(dest, "out", "gpu"), { recursive: true });

// Runtime files only: no sources, build trees, saves or launcher_settings.json.
for (const name of [
  "run.bat",
  "scripts",
  "patches",
  "fsr4_shaders",
  "fsr4_411",
  "LICENSE",
]) {
  const from = path.join(src, name);
  if (fs.existsSync(from))
    fs.cpSync(from, path.join(dest, name), { recursive: true });
}
for (const sub of ["out", path.join("out", "gpu")]) {
  const dir = path.join(src, sub);
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir)) {
    if (/\.(exe|dll)$/i.test(f) && !SKIP.has(f.toLowerCase()))
      fs.copyFileSync(path.join(dir, f), path.join(dest, sub, f));
  }
}
const zip = path.join(root, ".cache", "python-embed.zip");
if (!fs.existsSync(zip)) {
  fs.mkdirSync(path.dirname(zip), { recursive: true });
  const res = await fetch(PYTHON_URL);
  if (!res.ok) throw new Error(`python download failed: ${res.status}`);
  fs.writeFileSync(zip, Buffer.from(await res.arrayBuffer()));
}
const sha = createHash("sha256").update(fs.readFileSync(zip)).digest("hex");
if (sha !== PYTHON_SHA256) {
  fs.rmSync(zip);
  throw new Error(`python zip sha256 mismatch: ${sha}`);
}
const pyDir = path.join(dest, "python");
fs.mkdirSync(pyDir, { recursive: true });
// System32's bsdtar reads zips; a GNU tar earlier on PATH (Git Bash) does not.
run(path.join(process.env.SystemRoot ?? "C:\\Windows", "System32", "tar.exe"), [
  "-xf",
  zip,
  "-C",
  pyDir,
]);
// Without this the embeddable build ignores the script dir, so `from prepare import` fails.
for (const f of fs.readdirSync(pyDir))
  if (/^python\d+\._pth$/i.test(f)) fs.rmSync(path.join(pyDir, f));

// The port is not bundled in the installer; the app downloads this zip on demand.
// Upload it to the release named in bloodborne-port-installer.ts, then paste the sha256 there.
const portZip = path.join(root, ".cache", "bloodborne-port.zip");
fs.rmSync(portZip, { force: true });
run(path.join(process.env.SystemRoot ?? "C:\Windows", "System32", "tar.exe"), [
  "-a",
  "-cf",
  portZip,
  "-C",
  dest,
  ".",
]);
const portSha = createHash("sha256")
  .update(fs.readFileSync(portZip))
  .digest("hex");

console.log(`staged ${src} -> ${dest}`);
console.log(`zip:    ${portZip}`);
console.log(`sha256: ${portSha}`);

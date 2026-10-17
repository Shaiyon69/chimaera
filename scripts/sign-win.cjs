// Custom electron-builder signer (win.sign in electron-builder.yml).
// Skips bundled third-party binaries: signtool rejects ludusavi.exe ("badexeformat")
// and re-signing vendor files isn't ours to do. Cert comes from CSC_LINK / CSC_KEY_PASSWORD.
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const VENDOR =
  /[\\/]resources[\\/](ludusavi[\\/]|7z\.(exe|dll)$|elevate\.exe$)/i;
const SDK_SIGNTOOL =
  "C:\\Program Files (x86)\\Windows Kits\\10\\bin\\10.0.26100.0\\x64\\signtool.exe";

exports.default = async function sign(configuration) {
  const file = configuration.path;
  if (VENDOR.test(file)) return;

  const pfx = process.env.CSC_LINK;
  const password = process.env.CSC_KEY_PASSWORD;
  if (!pfx || !password)
    throw new Error("CSC_LINK and CSC_KEY_PASSWORD are required to sign");

  const signtool = process.env.SIGNTOOL_PATH ?? SDK_SIGNTOOL;
  if (!fs.existsSync(signtool))
    throw new Error(`signtool not found: ${signtool}`);

  execFileSync(
    signtool,
    [
      "sign",
      "/f",
      path.resolve(pfx),
      "/p",
      password,
      "/fd",
      "sha256",
      "/tr",
      "http://timestamp.digicert.com",
      "/td",
      "sha256",
      file,
    ],
    { stdio: "pipe" }
  );
};

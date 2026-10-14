# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Chimaera (a fork of Hydra Launcher): Electron + React + TypeScript game launcher, with a Rust native addon (`native/hydra-native`) and a libtorrent bridge (`native/torrent-bridge`).

## Commands

Use Yarn (npm is blocked via `engines`).

- `yarn dev` — run the app (electron-vite dev). `yarn dev:big-picture` runs the Big Picture UI standalone in Vite.
- `yarn build` — typecheck + electron-vite build. Platform packages: `yarn build:win|mac|linux`.
- `yarn build:native` — rebuild the Rust addon (also runs on `postinstall`). Needs Rust + a C++ toolchain; vcpkg fetches CMake. Win x64/Linux x64 use prebuilt torrent-bridge binaries from `native/torrent-bridge/prebuilt`; set `HYDRA_TORRENT_BRIDGE_FROM_SOURCE=1` to force a source build.
- `yarn lint` (eslint with `--fix`), `yarn format` / `yarn format-check` (prettier).
- `yarn typecheck` — runs `typecheck:node` (main/preload, `tsconfig.node.json`) and `typecheck:web` (renderer, `tsconfig.web.json`).
- `yarn test` — Node's built-in test runner over `src/**/*.test.ts` and `scripts/*.test.mjs`, loaded through ts-node ESM (`scripts/register-ts-node.mjs`, `tsconfig.test.json`).
- Single test file: `node --import ./scripts/register-ts-node.mjs --test src/main/services/optiscaler/optiscaler.test.ts`

Pre-commit hook (husky) runs format, lint, typecheck. Commit messages follow Conventional Commits (commitlint).

## Architecture

electron-vite builds four targets (`electron.vite.config.ts`): `main`, `preload`, `renderer`, and `bigPicture` (a second React UI in `src/big-picture`, output `out/big-picture`, shown with `--big-picture`).

- `src/main` — Electron main process.
  - `events/` — IPC handlers, one folder per domain. Each file calls `registerEvent(name, handler)` (`events/register-event.ts`, wraps `ipcMain.handle` and JSON-clones the result). Every domain folder must be imported from `events/index.ts`.
  - `services/` — business logic (downloads, cloud save, achievements, emulators, process watcher, Hydra API client, etc.). Re-exported via `services/index.ts`.
  - `level/` — local persistence on LevelDB (`classic-level`). `db` plus typed sublevels in `level/sublevels/` (games, downloads, themes, …); keys built with `levelKeys`.
- `src/preload/index.ts` — `contextBridge` exposes `window.electron`; each method is an `ipcRenderer.invoke("<eventName>", ...)`.
- `src/renderer/src` — main React UI. Redux Toolkit slices in `features/`, pages in `pages/`, `window.electron` typings in `declaration.d.ts`.
- `src/shared`, `src/types` — code/types shared across processes (`@shared`, `@types`).
- `src/locales/<lang>/translation.json` — i18next strings (Big Picture has its own `src/big-picture/src/locales`).

Adding an IPC call touches four places: handler in `src/main/events/<domain>/`, import in `src/main/events/index.ts`, method in `src/preload/index.ts`, type in `src/renderer/src/declaration.d.ts`.

Path aliases: `@main`, `@renderer`, `@shared`, `@types`, `@locales`, `@resources`. Note `@renderer` maps to `src/renderer/src` in Vite.

## Conventions (from `.cursorrules`)

- Log with `logger`, never `console`: main `import { logger } from "@main/services"`, renderer `import { logger } from "@renderer/logger"`.
- All user-facing strings go through i18next (`useTranslation`); add keys to `src/locales/en/translation.json`. Includes placeholders.
- Use `T[]`, not `Array<T>`.
- Prefer named exports for utilities/services; async/await over raw promises.
- Fix ESLint errors (especially jsx-a11y) before disabling a rule; any disable needs a comment explaining why.
- Comments: brief, explain why, not what.

## Tests

Tests run as native ESM via ts-node, so relative imports inside code under test need `.js` suffixes (e.g. `import { install } from "./install.js"`). Keep testable logic free of Electron imports (see the `*-core.ts` + `*.test.ts` split in `src/main/services`).

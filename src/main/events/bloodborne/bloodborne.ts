import { registerEvent } from "../register-event";
import {
  addBloodborneMod,
  getBloodborneMods,
  getBloodborneSetup,
  openBloodborneModsFolder,
  removeBloodborneMod,
  saveBloodborneMods,
  saveBloodborneSetup,
  selectBloodborneGameDir,
} from "@main/services/bloodborne/bloodborne";
import { downloadBloodbornePort } from "@main/services/bloodborne/bloodborne-port-installer";
import type {
  BbSettings,
  ModEntry,
} from "@main/services/bloodborne/bloodborne-core";

registerEvent("getBloodborneSetup", async () => getBloodborneSetup());
registerEvent(
  "saveBloodborneSetup",
  async (_event: Electron.IpcMainInvokeEvent, settings: BbSettings) =>
    saveBloodborneSetup(settings)
);
registerEvent("selectBloodborneGameDir", async () => selectBloodborneGameDir());

registerEvent("getBloodborneMods", async () => getBloodborneMods());
registerEvent(
  "saveBloodborneMods",
  async (
    _event: Electron.IpcMainInvokeEvent,
    state: { enabled: boolean; mods: ModEntry[] }
  ) => saveBloodborneMods(state)
);
registerEvent(
  "addBloodborneMod",
  async (_event: Electron.IpcMainInvokeEvent, kind: "folder" | "archive") =>
    addBloodborneMod(kind)
);
registerEvent(
  "removeBloodborneMod",
  async (_event: Electron.IpcMainInvokeEvent, name: string) =>
    removeBloodborneMod(name)
);
registerEvent("openBloodborneModsFolder", async () =>
  openBloodborneModsFolder()
);
registerEvent("downloadBloodbornePort", async () => downloadBloodbornePort());

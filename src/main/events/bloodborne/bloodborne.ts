import { registerEvent } from "../register-event";
import {
  getBloodborneSetup,
  openBloodborneLauncher,
} from "@main/services/bloodborne/bloodborne";
import { downloadBloodbornePort } from "@main/services/bloodborne/bloodborne-port-installer";

registerEvent("getBloodborneSetup", async () => getBloodborneSetup());
registerEvent("openBloodborneLauncher", async () => openBloodborneLauncher());
registerEvent("downloadBloodbornePort", async () => downloadBloodbornePort());

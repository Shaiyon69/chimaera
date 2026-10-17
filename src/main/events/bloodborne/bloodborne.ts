import { registerEvent } from "../register-event";
import { getBloodborneSetup } from "@main/services/bloodborne/bloodborne";
import { downloadBloodbornePort } from "@main/services/bloodborne/bloodborne-port-installer";

registerEvent("getBloodborneSetup", async () => getBloodborneSetup());
registerEvent("downloadBloodbornePort", async () => downloadBloodbornePort());

import path from "node:path";
import { app, safeStorage } from "electron";
import { registerEvent } from "../register-event";
import { createKeyStore } from "@main/services/messapp/key-store-core";
import { verifyMessappSession } from "@main/services/messapp/verify-session";

const keyStore = createKeyStore(
  path.join(app.getPath("userData"), "messapp-keys.json"),
  {
    available: () => safeStorage.isEncryptionAvailable(),
    encrypt: (text) => safeStorage.encryptString(text),
    decrypt: (data) => safeStorage.decryptString(data),
  }
);

// Callers pass their Supabase access token, never a bare user id: the renderer
// is untrusted, so the main process confirms with Supabase who the token
// actually belongs to before touching that user's key-store entry.
registerEvent(
  "saveMessappKey",
  async (_event, accessToken: string, privateJwk: string) =>
    keyStore.save(await verifyMessappSession(accessToken), privateJwk)
);
registerEvent("loadMessappKey", async (_event, accessToken: string) =>
  keyStore.load(await verifyMessappSession(accessToken))
);
registerEvent("clearMessappKey", async (_event, accessToken: string) =>
  keyStore.clear(await verifyMessappSession(accessToken))
);

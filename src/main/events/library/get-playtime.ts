import type { GameShop } from "@types";
import { gamesSublevel, levelKeys } from "@main/level";
import { registerEvent } from "../register-event";

registerEvent("getPlaytimeSummary", async () =>
  gamesSublevel.getPlaytimeSummary()
);

registerEvent(
  "getPlaySessions",
  async (
    _event: Electron.IpcMainInvokeEvent,
    shop: GameShop,
    objectId: string
  ) => gamesSublevel.getPlaySessions(levelKeys.game(shop, objectId))
);

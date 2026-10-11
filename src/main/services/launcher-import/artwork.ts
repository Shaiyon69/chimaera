import { app } from "electron";
import axios from "axios";
import { logger } from "../logger";
import {
  pickSteamMatch,
  steamArtwork,
  type GameArtwork,
  type SteamSearchItem,
} from "./artwork-core";

const findSteamArtwork = async (title: string): Promise<GameArtwork | null> => {
  const { data } = await axios.get<{ items?: SteamSearchItem[] }>(
    "https://store.steampowered.com/api/storesearch/",
    { params: { term: title, l: "english", cc: "us" }, timeout: 8000 }
  );
  const match = pickSteamMatch(data.items ?? [], title);
  return match ? steamArtwork(match.id) : null;
};

const exeIcon = async (exePath: string): Promise<GameArtwork | null> => {
  const icon = await app.getFileIcon(exePath, { size: "large" });
  return icon.isEmpty() ? null : { iconUrl: icon.toDataURL() };
};

/** Steam store art when the title matches exactly, else the exe's own icon. Never throws. */
export const fetchGameArtwork = async (
  title: string,
  exePath: string | null
): Promise<GameArtwork> => {
  try {
    const art = await findSteamArtwork(title);
    if (art) return art;
  } catch (error) {
    logger.warn("Steam artwork lookup failed", { title, error });
  }
  try {
    if (exePath) return (await exeIcon(exePath)) ?? {};
  } catch (error) {
    logger.warn("Exe icon lookup failed", { exePath, error });
  }
  return {};
};

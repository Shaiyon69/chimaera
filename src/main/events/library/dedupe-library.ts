import type { Game } from "@types";

const toComparableTitle = (title: string) =>
  title.toLowerCase().replaceAll(/[^a-z0-9]+/g, "");

const rank = (game: Game) => [
  game.shop === "steam" ? 1 : 0,
  game.executablePath ? 1 : 0,
  game.playTimeInMilliseconds ?? 0,
  game.lastTimePlayed ? new Date(game.lastTimePlayed).getTime() : 0,
];

const isBetter = (candidate: Game, current: Game) => {
  const a = rank(candidate);
  const b = rank(current);

  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return a[i] > b[i];
  }

  return false;
};

// Hides copies of one title that live under different keys (steam + custom + launcher
// imports). Nothing is deleted. LaunchBox is skipped: one title spans several platforms.
export const dedupeLibrary = <T extends [string, Game]>(entries: T[]): T[] => {
  const winners = new Map<string, T>();
  const result: T[] = [];

  for (const entry of entries) {
    const [, game] = entry;
    const title = toComparableTitle(game.title ?? "");

    if (game.shop === "launchbox" || !title) {
      result.push(entry);
      continue;
    }

    const current = winners.get(title);
    if (!current) {
      winners.set(title, entry);
      continue;
    }

    if (isBetter(game, current[1])) winners.set(title, entry);
  }

  return [...result, ...winners.values()];
};

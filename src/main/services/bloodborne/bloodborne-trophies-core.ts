const TROPHY_LINE = /Runtime: trophy (\d+) unlocked/;

export const parseTrophyId = (line: string): number | null => {
  const match = TROPHY_LINE.exec(line);
  return match ? Number(match[1]) : null;
};

export const trophyAchievementName = (displayName: string) =>
  displayName.toUpperCase().replace(/[^A-Z0-9]+/g, "_");

// The launcher stores the eboot path; run.bat wants its folder and a valid fps mode.
export const launchEnvFromSettings = (settings: {
  eboot?: string;
  fps?: string;
}) => {
  const env: Record<string, string> = {};
  if (settings.eboot) {
    env.BB_GAME_DIR = settings.eboot.replace(/[\\/]+eboot\.bin$/i, "");
  }
  if (settings.fps && /^(uncap|\d+)$/.test(settings.fps)) {
    env.BB_FPS = settings.fps;
  }
  return env;
};

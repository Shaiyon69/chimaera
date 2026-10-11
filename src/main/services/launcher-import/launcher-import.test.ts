import assert from "node:assert/strict";
import test from "node:test";
import {
  parseAmazon,
  parseBattleNet,
  parseEpic,
  parseGogInfo,
  parseGogPrograms,
  parseHumble,
  parseRockstar,
  parseUbisoft,
  parseXbox,
} from "./parsers.js";
import { pickSteamMatch, steamArtwork } from "./artwork-core.js";
import {
  parseRegQuery,
  toUninstallPrograms,
  type UninstallProgram,
} from "./registry.js";

const exists = () => true;
const program = (p: Partial<UninstallProgram>): UninstallProgram => ({
  keyName: "k",
  displayName: "n",
  installLocation: String.raw`C:\Games\x`,
  publisher: "",
  uninstallString: "",
  ...p,
});

test("parseRegQuery reads sub-keys, values and empty values", () => {
  const root = String.raw`HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall`;
  const text = [
    "",
    String.raw`HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\1207658924_is1`,
    "    DisplayName    REG_SZ    Some Game",
    "    InstallLocation    REG_SZ    C:\\GOG\\Some Game",
    "    Publisher    REG_SZ    GOG.com",
    "    Comments    REG_SZ    ",
    "",
  ].join("\r\n");
  const [entry] = parseRegQuery(text, root);
  assert.equal(entry.name, "1207658924_is1");
  assert.equal(entry.values.DisplayName, "Some Game");
  assert.equal(entry.values.Comments, "");
  const [p] = toUninstallPrograms([entry]);
  assert.equal(p.installLocation, String.raw`C:\GOG\Some Game`);
});

test("parseEpic skips DLC and engine plugins, prefers LauncherInstalled location", () => {
  const games = parseEpic(
    [
      {
        AppName: "Fortnite",
        DisplayName: "Game One",
        InstallLocation: String.raw`C:\stale`,
        LaunchExecutable: String.raw`Bin\game.exe`,
        CatalogNamespace: "ns",
        CatalogItemId: "item",
      },
      {
        AppName: "Dlc",
        InstallLocation: "C:\\d",
        AppCategories: ["addons"],
      },
      { AppName: "Plug", InstallLocation: "C:\\p", AppCategories: ["plugins"] },
    ],
    [{ AppName: "fortnite", InstallLocation: String.raw`C:\Epic\One` }],
    (d) => d !== String.raw`C:\stale`
  );
  assert.equal(games.length, 1);
  assert.equal(games[0].installDir, String.raw`C:\Epic\One`);
  assert.equal(games[0].exePath, String.raw`C:\Epic\One\Bin\game.exe`);
  assert.deepEqual(games[0].externalLaunch, {
    kind: "uri",
    uri: "com.epicgames.launcher://apps/ns%3Aitem%3AFortnite?action=launch&silent=true",
  });
});

test("GOG: registry filter, primary play task, DLC rejection", () => {
  const entries = parseGogPrograms(
    [
      program({
        keyName: "123_is1",
        publisher: "GOG.com",
        displayName: "G",
        installLocation: String.raw`C:\GOG\G`,
      }),
      program({ keyName: "456_is1", publisher: "Other" }),
      program({ keyName: "GOGPACK123_is1", publisher: "GOG.com" }),
    ],
    exists
  );
  assert.equal(entries.length, 1);
  const game = parseGogInfo(entries[0], {
    rootGameId: "123",
    playTasks: [
      {
        isPrimary: true,
        type: "FileTask",
        path: "g.exe",
        arguments: '-a "b c"',
      },
    ],
  });
  assert.equal(game?.exePath, String.raw`C:\GOG\G\g.exe`);
  assert.deepEqual(game?.externalLaunch, {
    kind: "exe",
    path: String.raw`C:\GOG\G\g.exe`,
    args: ["-a", "b c"],
  });
  assert.equal(
    parseGogInfo(entries[0], { rootGameId: "999", playTasks: [] }),
    null
  );
  assert.equal(
    parseGogInfo(entries[0], {
      rootGameId: "999",
      playTasks: [{ isPrimary: true, path: "x.exe" }],
    }),
    null
  );
});

test("Ubisoft titles come from the uninstall entry, else the folder", () => {
  const games = parseUbisoft(
    [
      {
        name: "720",
        path: "720",
        values: { InstallDir: "C:/Ubi/Game One/" },
      },
      { name: "99", path: "99", values: { InstallDir: "C:/Ubi/Other" } },
    ],
    [program({ keyName: "Uplay Install 720", displayName: "Game One Deluxe" })],
    exists
  );
  assert.deepEqual(
    games.map((g) => [g.id, g.title, g.installDir]),
    [
      ["720", "Game One Deluxe", String.raw`C:\Ubi\Game One`],
      ["99", "Other", String.raw`C:\Ubi\Other`],
    ]
  );
  assert.equal(games[0].externalLaunch?.kind, "uri");
});

test("Amazon uses the uri and takes the tracking exe from fuel.json", () => {
  const [game] = parseAmazon(
    [
      {
        Id: "amzn1",
        ProductTitle: "A",
        InstallDirectory: String.raw`C:\Amazon\A`,
      },
    ],
    () => "a.exe",
    exists
  );
  assert.equal(game.exePath, String.raw`C:\Amazon\A\a.exe`);
  assert.deepEqual(game.externalLaunch, {
    kind: "uri",
    uri: "amazon-games://play/amzn1",
  });
});

test("Humble keeps installed/downloaded entries and handles the legacy layout", () => {
  const games = parseHumble(
    {
      GameCollection4: [
        {
          machineName: "a",
          gameName: "A",
          status: "installed",
          filePath: String.raw`C:\H\a`,
          executablePath: "a.exe",
        },
        {
          machineName: "b",
          gameName: "B",
          status: "downloaded",
          downloadFilePath: String.raw`C:\H`,
          executablePath: "b.exe",
        },
        {
          machineName: "c",
          gameName: "C",
          status: "available",
          executablePath: "c.exe",
        },
      ],
    },
    exists
  );
  assert.deepEqual(
    games.map((g) => g.exePath),
    [String.raw`C:\H\a\a.exe`, String.raw`C:\H\b\b.exe`]
  );
});

test("Battle.net maps uids to products and launches through the client", () => {
  const games = parseBattleNet(
    [
      program({
        displayName: "World of Warcraft",
        installLocation: String.raw`C:\Blizzard\WoW`,
        uninstallString: String.raw`"C:\Program Files\Battle.net\Battle.net-Setup.exe" --uid=wow_classic --lang=enUS `,
      }),
      program({
        displayName: "Unknown",
        uninstallString: "Battle.net --uid=nothing_known ",
      }),
    ],
    exists,
    () => true,
    String.raw`C:\Battle.net\Battle.net.exe`
  );
  assert.equal(games.length, 1);
  assert.equal(games[0].id, "WoW");
  assert.deepEqual(games[0].externalLaunch, {
    kind: "exe",
    path: String.raw`C:\Battle.net\Battle.net.exe`,
    args: ["--exec=launch WoW"],
  });
});

test("Rockstar resolves the title id from the uninstall string", () => {
  const [game] = parseRockstar(
    [
      program({
        installLocation: String.raw`C:\Rockstar\GTAV`,
        uninstallString: String.raw`"C:\Rockstar\GTAV\uninstall.exe" -uninstall=gta5`,
      }),
    ],
    exists,
    String.raw`C:\RS\Launcher.exe`
  );
  assert.equal(game.title, "Grand Theft Auto V");
  assert.equal(game.exePath, String.raw`C:\Rockstar\GTAV\PlayGTAV.exe`);
  assert.deepEqual(game.externalLaunch, {
    kind: "exe",
    path: String.raw`C:\RS\Launcher.exe`,
    args: ["-launchTitleInFolder", String.raw`C:\Rockstar\GTAV`],
  });
});

test("Xbox treats a package as a game only with MicrosoftGame.config", () => {
  const pkg = {
    Name: "Contoso.Game",
    PackageFamilyName: "Contoso.Game_abc",
    InstallLocation: String.raw`C:\XboxGames\Game\Content`,
  };
  const manifest =
    '<Package><Applications><Application Id="Game" Executable="game.exe" /></Applications></Package>';
  assert.equal(parseXbox(pkg, manifest, null), null);
  const game = parseXbox(
    pkg,
    manifest,
    '<Game><ShellVisuals DefaultDisplayName="ms-resource:Title" /></Game>'
  );
  assert.equal(game?.title, "Contoso.Game");
  assert.equal(game?.exePath, String.raw`C:\XboxGames\Game\Content\game.exe`);
  assert.deepEqual(game?.externalLaunch, {
    kind: "exe",
    path: "explorer.exe",
    args: [String.raw`shell:AppsFolder\Contoso.Game_abc!Game`],
  });
});

test("pickSteamMatch needs an exact normalized title, app type only", () => {
  const items = [
    { type: "bundle", id: 1, name: "Portal" },
    { type: "app", id: 2, name: "Portal 2" },
    { type: "app", id: 3, name: "The Witcher® 3: Wild Hunt" },
  ];
  assert.equal(pickSteamMatch(items, "Portal"), null);
  assert.equal(pickSteamMatch(items, "portal 2")?.id, 2);
  assert.equal(pickSteamMatch(items, "The Witcher 3 - Wild Hunt")?.id, 3);
  assert.equal(pickSteamMatch(items, "   "), null);
  assert.match(
    steamArtwork(2).iconUrl ?? "",
    /\/apps\/2\/library_600x900_2x\.jpg$/
  );
});

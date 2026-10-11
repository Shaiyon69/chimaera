// Ported from Playnite's official library plugins (MIT, https://github.com/JosefNemec/PlayniteExtensions).

export interface BattleNetProduct {
  productId: string;
  internalId: string;
  name: string;
  type: "default" | "classic";
  executable?: string;
}

export interface RockstarProduct {
  name: string;
  executable: string;
  titleId: string;
}

export const BATTLENET_GAMES: BattleNetProduct[] = [
  {
    productId: "WoW",
    internalId: "wow",
    name: "World of Warcraft",
    type: "default",
  },
  {
    productId: "D3",
    internalId: "diablo3",
    name: "Diablo III",
    type: "default",
  },
  { productId: "S2", internalId: "s2", name: "StarCraft II", type: "default" },
  { productId: "S1", internalId: "s1", name: "StarCraft", type: "default" },
  {
    productId: "WTCG",
    internalId: "hs_beta",
    name: "Hearthstone",
    type: "default",
  },
  {
    productId: "Hero",
    internalId: "heroes",
    name: "Heroes of the Storm",
    type: "default",
  },
  {
    productId: "Pro",
    internalId: "prometheus",
    name: "Overwatch 2",
    type: "default",
  },
  {
    productId: "D2",
    internalId: "Diablo II",
    name: "Diablo II",
    type: "classic",
    executable: "Diablo II.exe",
  },
  {
    productId: "D2X",
    internalId: "Diablo II",
    name: "Diablo II: Lord of Destruction",
    type: "classic",
    executable: "Diablo II.exe",
  },
  {
    productId: "VIPR",
    internalId: "viper",
    name: "Call of Duty: Black Ops 4",
    type: "default",
  },
  {
    productId: "ODIN",
    internalId: "odin",
    name: "Call of Duty: Modern Warfare",
    type: "default",
  },
  {
    productId: "W3C",
    internalId: "Warcraft III",
    name: "Warcraft III: Reign of Chaos",
    type: "classic",
    executable: "Warcraft III.exe",
  },
  {
    productId: "W3CX",
    internalId: "Warcraft III",
    name: "Warcraft III: The Frozen Throne",
    type: "classic",
    executable: "Frozen Throne.exe",
  },
  {
    productId: "W3",
    internalId: "w3",
    name: "Warcraft III: Reforged",
    type: "default",
  },
  {
    productId: "LAZR",
    internalId: "lazarus",
    name: "Call of Duty: Modern Warfare 2 Campaign Remastered",
    type: "default",
  },
  {
    productId: "ZEUS",
    internalId: "zeus",
    name: "Call of Duty: Black Ops Cold War",
    type: "default",
  },
  {
    productId: "WLBY",
    internalId: "wlby",
    name: "Crash Bandicoot 4",
    type: "default",
  },
  {
    productId: "OSI",
    internalId: "osi",
    name: "Diablo II: Resurrected",
    type: "default",
  },
  {
    productId: "RTRO",
    internalId: "rtro",
    name: "Blizzard Arcade Collection",
    type: "default",
  },
  {
    productId: "FORE",
    internalId: "fore",
    name: "Call of Duty: Vanguard",
    type: "default",
  },
  {
    productId: "ANBS",
    internalId: "anbs",
    name: "Diablo Immortal",
    type: "default",
  },
  {
    productId: "AUKS",
    internalId: "auks",
    name: "Call of Duty: Modern Warfare II",
    type: "default",
  },
  { productId: "Fen", internalId: "Fen", name: "Diablo IV", type: "default" },
  { productId: "D1", internalId: "D1", name: "Diablo", type: "default" },
  {
    productId: "W1R",
    internalId: "w1r",
    name: "Warcraft: Remastered",
    type: "default",
  },
  {
    productId: "W2R",
    internalId: "w2r",
    name: "Warcraft II: Remastered",
    type: "default",
  },
  {
    productId: "W1R",
    internalId: "w1r",
    name: "Warcraft: Remastered",
    type: "default",
  },
  {
    productId: "W2R",
    internalId: "w2r",
    name: "Warcraft II: Remastered",
    type: "default",
  },
  {
    productId: "W1",
    internalId: "w1",
    name: "Warcraft: Orcs & Humans",
    type: "default",
  },
  {
    productId: "W2",
    internalId: "w2",
    name: "Warcraft II: Battle.net Edition",
    type: "default",
  },
  {
    productId: "GRY",
    internalId: "gryphon",
    name: "Warcraft Rumble",
    type: "default",
  },
  {
    productId: "ARIS",
    internalId: "aris",
    name: "Doom: The Dark Ages",
    type: "default",
  },
  {
    productId: "SCOR",
    internalId: "scorpio",
    name: "Sea of Thieves",
    type: "default",
  },
  {
    productId: "ARK",
    internalId: "arkansas",
    name: "The Outer Worlds 2",
    type: "default",
  },
  {
    productId: "LBRA",
    internalId: "libra",
    name: "Tony Hawk's Pro Skater 3 + 4",
    type: "default",
  },
  {
    productId: "PNTA",
    internalId: "pinta",
    name: "Call of Duty: Modern Warfare III",
    type: "default",
  },
  { productId: "AQUA", internalId: "aqua", name: "Avowed", type: "default" },
];

export const ROCKSTAR_GAMES: RockstarProduct[] = [
  { name: "Grand Theft Auto V", executable: "PlayGTAV.exe", titleId: "gta5" },
  {
    name: "Grand Theft Auto V Enhanced",
    executable: "GTA5_Enhanced_BE.exe",
    titleId: "gta5_gen9",
  },
  { name: "Red Dead Redemption", executable: "RDR.exe", titleId: "rdr" },
  { name: "Red Dead Redemption 2", executable: "RDR2.exe", titleId: "rdr2" },
  { name: "L.A. Noire", executable: "LANoire.exe", titleId: "lanoire" },
  { name: "Max Payne 3", executable: "MaxPayne3.exe", titleId: "mp3" },
  {
    name: "L.A. Noire: The VR Case Files",
    executable: "LANoireVR.exe",
    titleId: "lanoirevr",
  },
  {
    name: "Grand Theft Auto: San Andreas",
    executable: "gta_sa.exe",
    titleId: "gtasa",
  },
  { name: "Grand Theft Auto III", executable: "gta3.exe", titleId: "gta3" },
  {
    name: "Grand Theft Auto: Vice City",
    executable: "gta-vc.exe",
    titleId: "gtavc",
  },
  {
    name: "Bully: Scholarship Edition",
    executable: "Bully.exe",
    titleId: "bully",
  },
  { name: "Grand Theft Auto IV", executable: "GTAIV.exe", titleId: "gta4" },
  {
    name: "Grand Theft Auto III: The Definitive Edition",
    executable: "Gameface/Binaries/Win64/LibertyCity.exe",
    titleId: "gta3unreal",
  },
  {
    name: "Grand Theft Auto: Vice City – The Definitive Edition",
    executable: "Gameface/Binaries/Win64/ViceCity.exe",
    titleId: "gtavcunreal",
  },
  {
    name: "Grand Theft Auto: San Andreas – The Definitive Edition",
    executable: "Gameface/Binaries/Win64/SanAndreas.exe",
    titleId: "gtasaunreal",
  },
];

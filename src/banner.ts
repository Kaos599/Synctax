import { getTheme, paintLines, paintPixelWordmarkLine } from "./theme.js";

/**
 * FIGlet-style “Synctax” art (█/░). Shown for themes other than `pixel`/`synctax`.
 * Note: green tint in the editor is string syntax highlighting, not this file’s runtime colors.
 */
const rebelBanner = `
  █████████                                  █████
 ███░░░░░███                                ░░███
░███    ░░░  █████ ████ ████████    ██████  ███████    ██████   █████ █████
░░█████████ ░░███ ░███ ░░███░░███  ███░░███░░░███░    ░░░░░███ ░░███ ░░███
 ░░░░░░░░███ ░███ ░███  ░███ ░███ ░███ ░░░   ░███      ███████  ░░░█████░
 ███    ░███ ░███ ░███  ░███ ░███ ░███  ███  ░███ ███ ███░░███   ███░░░███
░░█████████  ░░███████  ████ █████░░██████   ░░█████ ░░████████ █████ █████
 ░░░░░░░░░    ░░░░░███ ░░░░ ░░░░░  ░░░░░░     ░░░░░   ░░░░░░░░ ░░░░░ ░░░░░
              ███ ░███
             ░░██████
              ░░░░░░
`;
export const REBEL_BANNER_LINES = rebelBanner.trim().split("\n");

const GAP = "    ";

const LETTERS: Record<string, string[]> = {
  S: [
    "WWWWWWW",
    "WW     ",
    "WW     ",
    " WWWWW ",
    "     WW",
    "     WW",
    "WWWWWWW",
  ],
  Y: [
    "WW   WW",
    " WW WW ",
    "  WWW  ",
    "   W   ",
    "   W   ",
    "   W   ",
    "   W   ",
  ],
  N: [
    "WW   WW",
    "WWW  WW",
    "WW W WW",
    "WW  WWW",
    "WW   WW",
    "WW   WW",
    "WW   WW",
  ],
  C: [
    " WWWWW ",
    "WW    W",
    "WW     ",
    "WW     ",
    "WW    W",
    " WWWWW ",
    "       ",
  ],
  T: [
    "WWWWWWW",
    "   W   ",
    "   W   ",
    "   W   ",
    "   W   ",
    "   W   ",
    "   W   ",
  ],
  A: [
    "  WWW  ",
    " W   W ",
    "WW   WW",
    "WWWWWWW",
    "WW   WW",
    "WW   WW",
    "WW   WW",
  ],
  X: [
    "WW   WW",
    " WW WW ",
    "  WWW  ",
    "  WWW  ",
    " WW WW ",
    "WW   WW",
    "       ",
  ],
};

function buildFaceGrid(word: string): string[] {
  const keys = word.split("");
  const rows: string[] = [];
  for (let r = 0; r < 7; r++) {
    const parts = keys.map((k) => LETTERS[k]?.[r] ?? ".......");
    rows.push(parts.join(GAP));
  }
  return rows;
}

function expandFaceSeparation(faceRows: string[]): string[] {
  const expandedRows: string[] = [];
  for (const rawLine of faceRows) {
    let next = "";
    for (let i = 0; i < rawLine.length; i++) {
      const ch = rawLine.charAt(i);
      next += ch;
      const currentIsFace = ch === "W";
      const nextCh = rawLine.charAt(i + 1);
      const nextIsFace = nextCh === "W";
      if (currentIsFace && nextIsFace) {
        next += " ";
      }
    }
    expandedRows.push(next);
  }
  return expandedRows;
}

function compositeShadow(faceRows: string[], down: number, left: number): string[] {
  const fh = faceRows.length;
  const fw = Math.max(...faceRows.map((l) => l.length));
  const padL = left;
  const padB = down;
  const oh = fh + padB;
  const ow = fw + padL;

  const face: (string | null)[][] = Array.from({ length: fh }, () => Array<string | null>(fw).fill(null));
  for (let r = 0; r < fh; r++) {
    const line = (faceRows[r] ?? "").padEnd(fw, " ");
    for (let c = 0; c < fw; c++) {
      const ch = line.charAt(c);
      if (ch === "W") face[r]![c] = ch;
    }
  }

  const grid: string[][] = Array.from({ length: oh }, () => Array(ow).fill(" "));

  for (let r = 0; r < fh; r++) {
    const frow = face[r];
    if (!frow) continue;
    for (let c = 0; c < fw; c++) {
      if (frow[c] === null) continue;
      const sr = r + down;
      const sc = c + padL - left;
      if (sr < 0 || sr >= oh || sc < 0 || sc >= ow) continue;
      const srow = grid[sr];
      if (!srow) continue;
      if (srow[sc] === " ") {
        srow[sc] = (sr + sc) % 2 === 0 ? "1" : "2";
      }
    }
  }

  for (let r = 0; r < fh; r++) {
    const frow = face[r];
    const grow = grid[r];
    if (!frow || !grow) continue;
    for (let c = 0; c < fw; c++) {
      const ch = frow[c];
      if (ch === "W") grow[c + padL] = ch;
    }
  }

  return grid.map((row) => row.join(""));
}

const pixelSynctaxLines = compositeShadow(expandFaceSeparation(buildFaceGrid("SYNCTAX")), 2, 2);

export function printBanner(themeName: string = "pixel") {
  if (themeName === "pixel" || themeName === "synctax") {
    const body = pixelSynctaxLines.map(paintPixelWordmarkLine).join("\n");
    console.log("\n" + body + "\n");
    return;
  }
  const palette = getTheme(themeName);
  console.log(paintLines(rebelBanner, palette));
}

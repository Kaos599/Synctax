import chalk from "chalk";

export const themes = {
  default: ["#362F4F", "#5B23FF", "#008BFF", "#E4FF30"],
  cyber: ["#FF2DD1", "#FDFFB8", "#4DFFBE", "#63C8FF"],
  rebel: ["#000000", "#CF0F47", "#FF0B55", "#FFDEDE"],
  /** Line-cycled greens on the FIGlet-style `rebelBanner` (similar to editor string highlighting). */
  green: ["#0d1f0d", "#1f5c2e", "#2fa14a", "#7bdc8f"],
};

const PIXEL = {
  face: chalk.hex("#F2F2F2"),
  faceHi: chalk.hex("#D0D0D0"),
  ditherA: chalk.hex("#4A4A4A"),
  ditherB: chalk.hex("#262626"),
};

export function getTheme(name: string = "default") {
  return themes[name as keyof typeof themes] || themes.default;
}

export function paintLines(text: string, palette: string[]) {
  if (palette.length === 0) return text;
  const lines = text.split("\n");
  const painted = lines.map((line, idx) => {
    const color = palette[idx % palette.length]!;
    return chalk.hex(color)(line);
  });
  return painted.join("\n");
}

/**
 * W / H = letter face (solid blocks; H = slightly dimmer “pinstripe” column).
 * 1 / 2 = shadow dither — same glyph (█) as the face so columns align in all terminals.
 */
export function paintPixelWordmarkLine(line: string): string {
  let out = "";
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === "W") out += PIXEL.face("█");
    else if (ch === "H") out += PIXEL.faceHi("█");
    else if (ch === "1") out += PIXEL.ditherA("█");
    else if (ch === "2") out += PIXEL.ditherB("█");
    else out += ch;
  }
  return out;
}

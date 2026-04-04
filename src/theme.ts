import chalk from "chalk";

export const themes = {
  default: ["#362F4F", "#5B23FF", "#008BFF", "#E4FF30"],
  cyber: ["#DDE6F5", "#4C5B71"],
  rebel: ["#000000", "#CF0F47", "#FF0B55", "#FFDEDE"],
  /** Line-cycled greens on the FIGlet-style `rebelBanner` (similar to editor string highlighting). */
  green: ["#0d1f0d", "#1f5c2e", "#2fa14a", "#7bdc8f"],
};

const PIXEL = {
  face: chalk.hex("#E8ECF4"),
  back: chalk.hex("#3A4556"),
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
 * W / H = letter face (same duotone front color for crisp edges).
 * 1 / 2 = back layer (same duotone back color) for clear foreground/background separation.
 */
export function paintPixelWordmarkLine(line: string): string {
  let out = "";
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === "W") out += PIXEL.face("█");
    else if (ch === "H") out += PIXEL.face("█");
    else if (ch === "1") out += PIXEL.back("█");
    else if (ch === "2") out += PIXEL.back("█");
    else out += ch;
  }
  return out;
}

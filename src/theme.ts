import chalk from "chalk";

export const themes = {
  default: ["#362F4F", "#5B23FF", "#008BFF", "#E4FF30"],
  cyber: ["#FF2DD1", "#FDFFB8", "#4DFFBE", "#63C8FF"],
  rebel: ["#000000", "#CF0F47", "#FF0B55", "#FFDEDE"]
};

export function getTheme(name: string = "default") {
  return themes[name as keyof typeof themes] || themes.default;
}

export function paintLines(text: string, palette: string[]) {
  const lines = text.split("\n");
  const painted = lines.map((line, idx) => {
    const color = palette[idx % palette.length];
    return chalk.hex(color)(line);
  });
  return painted.join("\n");
}

import chalk from "chalk";

/** Semantic colors for CLI output */
export const semantic = {
  success: chalk.green,
  error: chalk.red,
  warning: chalk.yellow,
  info: chalk.blue,
  muted: chalk.gray,
  label: chalk.cyan,
  emphasis: chalk.bold,
  highlight: chalk.whiteBright.bold,
} as const;

/** Consistent symbols across the entire CLI */
export const symbols = {
  success: "✓",
  error: "✗",
  warning: "⚠",
  info: "○",
  arrow: "→",
  bullet: "·",
  dash: "—",
} as const;

/** Brand colors */
export const brand = {
  primary: chalk.hex("#5B23FF"),
  accent: chalk.hex("#E4FF30"),
  secondary: chalk.hex("#008BFF"),
} as const;

/** Pre-compiled colors for info table headers */
export const tableHeader = {
  col1: chalk.hex("#E4FF30"),
  col2: chalk.hex("#4DFFBE"),
  col3: chalk.hex("#63C8FF"),
  col4: chalk.hex("#FF2DD1"),
  col5: chalk.hex("#FF0B55"),
} as const;

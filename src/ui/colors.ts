import chalk from "chalk";
import { getCapabilities } from "./capabilities.js";

type ColorFn = (text: string) => string;

function withColor(color: ColorFn): ColorFn {
  return (text: string) => {
    const caps = getCapabilities();
    if (!caps.colorEnabled) {
      return text;
    }
    return color(text);
  };
}

function withAdaptiveColor(rich: ColorFn, fallback: ColorFn): ColorFn {
  return (text: string) => {
    const caps = getCapabilities();
    if (!caps.colorEnabled) {
      return text;
    }
    if (caps.colorLevel >= 3) {
      return rich(text);
    }
    return fallback(text);
  };
}

/** Semantic colors for CLI output */
export const semantic = {
  success: withColor(chalk.green),
  error: withColor(chalk.red),
  warning: withColor(chalk.yellow),
  info: withColor(chalk.blue),
  muted: withColor(chalk.gray),
  label: withColor(chalk.cyan),
  emphasis: withColor(chalk.bold),
  highlight: withColor(chalk.whiteBright.bold),
} as const;

/** Consistent symbols across the entire CLI */
export const symbols = {
  get success() {
    return getCapabilities().unicode ? "✓" : "+";
  },
  get error() {
    return getCapabilities().unicode ? "✗" : "x";
  },
  get warning() {
    return getCapabilities().unicode ? "⚠" : "!";
  },
  get info() {
    return getCapabilities().unicode ? "○" : "o";
  },
  get arrow() {
    return getCapabilities().unicode ? "→" : "->";
  },
  get bullet() {
    return getCapabilities().unicode ? "·" : "*";
  },
  get dash() {
    return getCapabilities().unicode ? "—" : "-";
  },
} as const;

/** Brand colors */
export const brand = {
  primary: withAdaptiveColor(chalk.hex("#5B23FF"), chalk.magenta),
  accent: withAdaptiveColor(chalk.hex("#E4FF30"), chalk.yellowBright),
  secondary: withAdaptiveColor(chalk.hex("#008BFF"), chalk.blueBright),
} as const;

/** Pre-compiled colors for info table headers */
export const tableHeader = {
  col1: withAdaptiveColor(chalk.hex("#E4FF30"), chalk.yellowBright),
  col2: withAdaptiveColor(chalk.hex("#4DFFBE"), chalk.greenBright),
  col3: withAdaptiveColor(chalk.hex("#63C8FF"), chalk.blueBright),
  col4: withAdaptiveColor(chalk.hex("#FF2DD1"), chalk.magentaBright),
  col5: withAdaptiveColor(chalk.hex("#FF0B55"), chalk.redBright),
} as const;

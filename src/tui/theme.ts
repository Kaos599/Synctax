/**
 * TUI Design System — Multi-theme color palette and styling constants for the Ink-based TUI.
 *
 * Supports 16 theme presets with runtime switching via setActiveTheme().
 * Components import `colors`, `palette`, `chars`, `spacing` — the first two
 * are Proxy objects that always reflect the currently active theme.
 */

// ─── Theme Palette Type ──────────────────────────────────────────────

export interface ThemePalette {
  /** Primary brand color — headers, active borders */
  brand: string;
  /** Lighter brand accent — hover/active states */
  accent: string;
  /** Info / secondary accent (cyan/blue) */
  info: string;
  /** Success state */
  success: string;
  /** Warning / attention */
  warning: string;
  /** Error state */
  error: string;
  /** Primary foreground text */
  text: string;
  /** Secondary / lighter text */
  gray: string;
  /** Dim / muted text, borders */
  dim: string;
  /** Very dark — panel backgrounds */
  dark: string;
}

// ─── Semantic Colors Type ────────────────────────────────────────────

export interface SemanticColors {
  text: string;
  textSecondary: string;
  textMuted: string;
  brand: string;
  brandBright: string;
  success: string;
  warning: string;
  error: string;
  info: string;
  border: string;
  borderFocus: string;
  borderAccent: string;
  panelBg: string;
  headerBg: string;
  hotkey: string;
  hotkeyBg: string;
  actionLabel: string;
}

// ─── Theme Presets ───────────────────────────────────────────────────

const THEMES: Record<string, ThemePalette> = {
  // ── Signature ──
  synctax: {
    brand: "#8B5CF6", accent: "#A78BFA", info: "#22D3EE",
    success: "#34D399", warning: "#F59E0B", error: "#F87171",
    text: "#F1F5F9", gray: "#94A3B8", dim: "#475569", dark: "#1E293B",
  },

  // ── Community classics ──
  catppuccin: {
    brand: "#CBA6F7", accent: "#F5C2E7", info: "#89B4FA",
    success: "#A6E3A1", warning: "#F9E2AF", error: "#F38BA8",
    text: "#CDD6F4", gray: "#6C7086", dim: "#45475A", dark: "#1E1E2E",
  },
  dracula: {
    brand: "#BD93F9", accent: "#FF79C6", info: "#8BE9FD",
    success: "#50FA7B", warning: "#F1FA8C", error: "#FF5555",
    text: "#F8F8F2", gray: "#6272A4", dim: "#44475A", dark: "#282A36",
  },
  nord: {
    brand: "#81A1C1", accent: "#88C0D0", info: "#5E81AC",
    success: "#A3BE8C", warning: "#EBCB8B", error: "#BF616A",
    text: "#ECEFF4", gray: "#4C566A", dim: "#3B4252", dark: "#2E3440",
  },
  "tokyo-night": {
    brand: "#BB9AF7", accent: "#7DCFFF", info: "#7AA2F7",
    success: "#9ECE6A", warning: "#E0AF68", error: "#F7768E",
    text: "#A9B1D6", gray: "#565F89", dim: "#414868", dark: "#1A1B26",
  },
  gruvbox: {
    brand: "#D3869B", accent: "#FE8019", info: "#83A598",
    success: "#B8BB26", warning: "#FABD2F", error: "#FB4934",
    text: "#EBDBB2", gray: "#928374", dim: "#504945", dark: "#282828",
  },
  "one-dark": {
    brand: "#C678DD", accent: "#61AFEF", info: "#61AFEF",
    success: "#98C379", warning: "#E5C07B", error: "#E06C75",
    text: "#ABB2BF", gray: "#5C6370", dim: "#3E4451", dark: "#282C34",
  },
  solarized: {
    brand: "#268BD2", accent: "#2AA198", info: "#268BD2",
    success: "#859900", warning: "#B58900", error: "#DC322F",
    text: "#839496", gray: "#657B83", dim: "#586E75", dark: "#002B36",
  },

  // ── Vibrant / expressive ──
  "rose-pine": {
    brand: "#C4A7E7", accent: "#EBBCBA", info: "#9CCFD8",
    success: "#31748F", warning: "#F6C177", error: "#EB6F92",
    text: "#E0DEF4", gray: "#908CAA", dim: "#6E6A86", dark: "#191724",
  },
  monokai: {
    brand: "#AE81FF", accent: "#F92672", info: "#66D9EF",
    success: "#A6E22E", warning: "#E6DB74", error: "#F92672",
    text: "#F8F8F2", gray: "#75715E", dim: "#49483E", dark: "#272822",
  },
  cyberpunk: {
    brand: "#FF00FF", accent: "#00FFFF", info: "#00FFFF",
    success: "#39FF14", warning: "#FFD700", error: "#FF073A",
    text: "#EAEAEA", gray: "#7B68EE", dim: "#4A0E4E", dark: "#0D0221",
  },
  sunset: {
    brand: "#FF6B6B", accent: "#FFA07A", info: "#48D1CC",
    success: "#3CB371", warning: "#FFD93D", error: "#FF4757",
    text: "#F5F0E8", gray: "#B8A9C9", dim: "#6C5B7B", dark: "#2C1E3F",
  },
  ocean: {
    brand: "#6C63FF", accent: "#00D2FF", info: "#00B4D8",
    success: "#00F5D4", warning: "#FEE440", error: "#F72585",
    text: "#CAF0F8", gray: "#577590", dim: "#264653", dark: "#0A1628",
  },
  forest: {
    brand: "#7CB342", accent: "#AED581", info: "#4FC3F7",
    success: "#66BB6A", warning: "#FFA726", error: "#EF5350",
    text: "#E8F5E9", gray: "#81A594", dim: "#3E5641", dark: "#1B2E1B",
  },
  ember: {
    brand: "#FF7043", accent: "#FFAB91", info: "#4DD0E1",
    success: "#66BB6A", warning: "#FFD54F", error: "#EF5350",
    text: "#EFEBE9", gray: "#A1887F", dim: "#5D4037", dark: "#2C1810",
  },
  aurora: {
    brand: "#7C4DFF", accent: "#18FFFF", info: "#40C4FF",
    success: "#69F0AE", warning: "#FFD740", error: "#FF5252",
    text: "#E8EAF6", gray: "#7986CB", dim: "#3949AB", dark: "#0D0D2B",
  },
};

// ─── Derive Semantic Colors from Palette ─────────────────────────────

function buildColors(p: ThemePalette): SemanticColors {
  return {
    text: p.text,
    textSecondary: p.gray,
    textMuted: p.dim,
    brand: p.brand,
    brandBright: p.accent,
    success: p.success,
    warning: p.warning,
    error: p.error,
    info: p.info,
    border: p.dim,
    borderFocus: p.brand,
    borderAccent: p.info,
    panelBg: p.dark,
    headerBg: p.brand,
    hotkey: p.info,
    hotkeyBg: p.dark,
    actionLabel: p.text,
  };
}

// ─── Active Theme State ──────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
let _activePalette: ThemePalette = THEMES["synctax"]!;
let _activeColors: SemanticColors = buildColors(_activePalette);

// ─── Public API ──────────────────────────────────────────────────────

export function setActiveTheme(name: string): void {
  const key = name.toLowerCase();
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const chosen = THEMES[key] ?? THEMES["synctax"]!;
  _activePalette = chosen;
  _activeColors = buildColors(chosen);
}

export function getAvailableThemes(): string[] {
  return Object.keys(THEMES);
}

export const colors: SemanticColors = new Proxy({} as SemanticColors, {
  get(_target, prop: string) {
    return (_activeColors as any)[prop];
  },
  ownKeys() {
    return Reflect.ownKeys(_activeColors);
  },
  getOwnPropertyDescriptor(_target, prop) {
    if (Reflect.ownKeys(_activeColors).includes(prop)) {
      return { configurable: true, enumerable: true, value: (_activeColors as any)[prop] };
    }
    return undefined;
  },
});

export const palette: ThemePalette = new Proxy({} as ThemePalette, {
  get(_target, prop: string) {
    return (_activePalette as any)[prop];
  },
  ownKeys() {
    return Reflect.ownKeys(_activePalette);
  },
  getOwnPropertyDescriptor(_target, prop) {
    if (Reflect.ownKeys(_activePalette).includes(prop)) {
      return { configurable: true, enumerable: true, value: (_activePalette as any)[prop] };
    }
    return undefined;
  },
});

// ─── Theme-Independent Constants ─────────────────────────────────────

export const chars = {
  topLeft: "\u250C",      // ┌
  topRight: "\u2510",     // ┐
  bottomLeft: "\u2514",   // └
  bottomRight: "\u2518",  // ┘
  horizontal: "\u2500",   // ─
  vertical: "\u2502",     // │
  teeRight: "\u251C",     // ├
  teeLeft: "\u2524",      // ┤
  cross: "\u253C",        // ┼
  dot: "\u2022",          // •
  diamond: "\u25C6",      // ◆
  arrow: "\u25B8",        // ▸
  check: "\u2713",        // ✓
  cross_mark: "\u2717",   // ✗
  warning_sign: "\u26A0", // ⚠
  circle: "\u25CB",       // ○
  filledCircle: "\u25CF", // ●
  block: "\u2588",        // █
  lightBlock: "\u2591",   // ░
  medBlock: "\u2592",     // ▒
  heavyBlock: "\u2593",   // ▓
} as const;

export const spacing = {
  panelPadding: 1,
  sectionGap: 1,
  headerHeight: 4,
} as const;

import { execSync } from "node:child_process";

export type TerminalTheme = "dark" | "light";

/** Whether the terminal is macOS Terminal.app (limited ANSI support). */
export const isAppleTerminal = process.env.TERM_PROGRAM === "Apple_Terminal";

/**
 * Detect terminal background color.
 *
 * 1. $COLORFGBG (iTerm2, rxvt, etc.) — format: "fg;bg" or "fg;other;bg"
 * 2. macOS system appearance via `defaults read` (for Terminal.app which lacks COLORFGBG)
 * 3. Default: "dark"
 */
export function detectTerminalTheme(): TerminalTheme {
  // Method 1: COLORFGBG
  const raw = process.env.COLORFGBG;
  if (raw) {
    const parts = raw.split(";");
    const bg = Number(parts[parts.length - 1]);
    if (!Number.isNaN(bg)) {
      return bg <= 6 || bg === 8 ? "dark" : "light";
    }
  }

  // Method 2: macOS system appearance (AppleInterfaceStyle = "Dark" in dark mode)
  if (process.platform === "darwin") {
    try {
      const result = execSync("defaults read -g AppleInterfaceStyle", {
        encoding: "utf8",
        timeout: 500,
        stdio: ["pipe", "pipe", "pipe"],
      }).trim();
      return result === "Dark" ? "dark" : "light";
    } catch {
      // Command fails when light mode is active (key doesn't exist)
      return "light";
    }
  }

  return "dark";
}

interface ThemePalette {
  readonly warmAccent: string;
  readonly warmMuted: string;
  readonly warmReply: string;
  readonly warmBorder: string;
  readonly statusSuccess: string;
  readonly statusError: string;
  readonly statusActive: string;
  readonly statusIdle: string;
  readonly roleUser: string;
  readonly roleSystem: string;
}

const darkPalette: ThemePalette = {
  warmAccent: "#d4a070",
  warmMuted: "#8f8374",
  warmReply: "#a8c4d4",
  warmBorder: "#6b6156",
  statusSuccess: "#7ec87e",
  statusError: "#e06060",
  statusActive: "#d4a76a",
  statusIdle: "#7a7268",
  roleUser: "#c0a480",
  roleSystem: "#b8a8d0",
};

const lightPalette: ThemePalette = {
  warmAccent: "#8b5e3c",
  warmMuted: "#7a6e62",
  warmReply: "#2a5a7a",
  warmBorder: "#b0a898",
  statusSuccess: "#2e7d32",
  statusError: "#c62828",
  statusActive: "#a06020",
  statusIdle: "#908478",
  roleUser: "#6b4c30",
  roleSystem: "#5c4a80",
};

// Terminal.app: use basic 16-color ANSI names to avoid 24-bit escape sequences
// that can trigger CoreGraphics crashes with CJK text.
const appleTerminalDarkPalette: ThemePalette = {
  warmAccent: "yellow",
  warmMuted: "gray",
  warmReply: "cyan",
  warmBorder: "gray",
  statusSuccess: "green",
  statusError: "red",
  statusActive: "yellow",
  statusIdle: "gray",
  roleUser: "white",
  roleSystem: "magenta",
};

const appleTerminalLightPalette: ThemePalette = {
  warmAccent: "gray",
  warmMuted: "gray",
  warmReply: "black",
  warmBorder: "gray",
  statusSuccess: "green",
  statusError: "red",
  statusActive: "yellow",
  statusIdle: "gray",
  roleUser: "black",
  roleSystem: "magenta",
};

function resolvePalette(): ThemePalette {
  const theme = detectTerminalTheme();
  if (isAppleTerminal) {
    return theme === "light" ? appleTerminalLightPalette : appleTerminalDarkPalette;
  }
  return theme === "light" ? lightPalette : darkPalette;
}

const palette = resolvePalette();

export const WARM_ACCENT = palette.warmAccent;
export const WARM_MUTED = palette.warmMuted;
export const WARM_REPLY = palette.warmReply;
export const WARM_BORDER = palette.warmBorder;
export const STATUS_SUCCESS = palette.statusSuccess;
export const STATUS_ERROR = palette.statusError;
export const STATUS_ACTIVE = palette.statusActive;
export const STATUS_IDLE = palette.statusIdle;
export const ROLE_USER = palette.roleUser;
export const ROLE_SYSTEM = palette.roleSystem;

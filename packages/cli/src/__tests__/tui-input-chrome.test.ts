import { describe, expect, it } from "vitest";
import { buildInputChrome } from "../tui/effects.js";
import { stripAnsi } from "../tui/ansi.js";

describe("tui input chrome", () => {
  it("builds a floating prompt shell with inner padding and bottom gap", () => {
    const chrome = buildInputChrome(100);
    const topBorder = stripAnsi(chrome.topBorder);
    const bottomBorder = stripAnsi(chrome.bottomBorder);
    const promptPrefix = stripAnsi(chrome.promptPrefix);

    expect(topBorder.startsWith("  ╭")).toBe(true);
    expect(topBorder.endsWith("╮")).toBe(true);
    expect(bottomBorder.startsWith("  ╰")).toBe(true);
    expect(bottomBorder.endsWith("╯")).toBe(true);
    expect(promptPrefix).toContain("│");
    expect(promptPrefix).toContain("❯");
    expect(chrome.outerGapLines).toBeGreaterThan(0);
  });

  it("clamps the shell width instead of spanning edge-to-edge", () => {
    const chrome = buildInputChrome(72);

    expect(chrome.width).toBeLessThan(72);
    expect(chrome.width).toBeGreaterThanOrEqual(48);
  });
});

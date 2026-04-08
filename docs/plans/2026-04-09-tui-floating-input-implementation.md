# TUI Floating Input Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the TUI input area feel closer to Codex by giving it a floating input-shell look with clearer bottom spacing.

**Architecture:** Keep the existing REPL loop and natural-language flow intact. Only reshape the prompt chrome: extract a small render helper in the TUI effects layer, use it from the app loop, and lock the visual contract with a focused CLI test.

**Tech Stack:** TypeScript, Node readline, Vitest

---

### Task 1: Add a failing test for floating input chrome

**Files:**
- Create: `packages/cli/src/__tests__/tui-input-chrome.test.ts`
- Reference: `packages/cli/src/tui/effects.ts`

**Step 1: Write the failing test**

Add tests that expect:
- a bounded/floating top border line
- a prompt prefix that includes inner padding
- bottom spacing metadata greater than zero

**Step 2: Run test to verify it fails**

Run: `pnpm --dir packages/cli exec vitest run src/__tests__/tui-input-chrome.test.ts`

Expected: FAIL because the helper does not exist yet.

**Step 3: Write minimal implementation**

Add a small helper in `effects.ts` that builds the input chrome description from terminal width.

**Step 4: Run test to verify it passes**

Run: `pnpm --dir packages/cli exec vitest run src/__tests__/tui-input-chrome.test.ts`

Expected: PASS

### Task 2: Wire the floating chrome into the TUI prompt loop

**Files:**
- Modify: `packages/cli/src/tui/app.ts`
- Modify: `packages/cli/src/tui/effects.ts`

**Step 1: Write the failing test**

Extend the input-chrome test (or add a small app-facing assertion) so the exported prompt prefix and spacing are stable enough to drive the REPL loop.

**Step 2: Run test to verify it fails**

Run: `pnpm --dir packages/cli exec vitest run src/__tests__/tui-input-chrome.test.ts src/__tests__/tui-layout.test.ts`

Expected: FAIL until the app loop uses the new chrome contract.

**Step 3: Write minimal implementation**

Update `app.ts` so:
- the prompt string comes from the chrome helper
- the input area prints a floating top border and helper line
- the prompt is not visually glued to the terminal bottom

**Step 4: Run test to verify it passes**

Run: `pnpm --dir packages/cli exec vitest run src/__tests__/tui-input-chrome.test.ts src/__tests__/tui-layout.test.ts`

Expected: PASS

### Task 3: Verify CLI package build

**Files:**
- Modify: `packages/cli/src/tui/app.ts`
- Modify: `packages/cli/src/tui/effects.ts`
- Test: `packages/cli/src/__tests__/tui-input-chrome.test.ts`

**Step 1: Run package build**

Run: `pnpm --dir packages/cli run build`

Expected: PASS

**Step 2: Commit**

```bash
git add docs/plans/2026-04-09-tui-floating-input-implementation.md packages/cli/src/tui/app.ts packages/cli/src/tui/effects.ts packages/cli/src/__tests__/tui-input-chrome.test.ts
git commit -m "feat(tui): float input chrome above terminal edge"
```

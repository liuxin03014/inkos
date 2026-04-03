import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, mkdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { detectAndRewrite, loadDetectionHistory } from "../pipeline/detection-runner.js";
import { WriterAgent } from "../agents/writer.js";
import * as detectorModule from "../agents/detector.js";
import type { DetectionConfig } from "../models/project.js";

const ZERO_USAGE = {
  promptTokens: 0,
  completionTokens: 0,
  totalTokens: 0,
} as const;

describe("detection-runner", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("routes anti-detect rewrites through WriterAgent repairChapter", async () => {
    const root = await mkdtemp(join(tmpdir(), "inkos-detection-runner-test-"));
    const bookDir = join(root, "book");
    await mkdir(join(bookDir, "story"), { recursive: true });

    const config: DetectionConfig = {
      provider: "custom",
      apiUrl: "https://example.invalid/detect",
      apiKeyEnv: "TEST_DETECTION_KEY",
      threshold: 0.5,
      enabled: true,
      autoRewrite: true,
      maxRetries: 2,
    };

    vi.spyOn(detectorModule, "detectAIContent")
      .mockResolvedValueOnce({
        score: 0.91,
        provider: "custom",
        detectedAt: "2026-04-03T00:00:00.000Z",
      })
      .mockResolvedValueOnce({
        score: 0.14,
        provider: "custom",
        detectedAt: "2026-04-03T00:00:01.000Z",
      });

    const repairChapter = vi.spyOn(WriterAgent.prototype, "repairChapter").mockResolvedValue({
      revisedContent: "humanized chapter",
      wordCount: 15,
      fixedIssues: ["lowered ai tells"],
      updatedState: "state",
      updatedLedger: "ledger",
      updatedHooks: "hooks",
      tokenUsage: ZERO_USAGE,
    });

    try {
      const result = await detectAndRewrite(
        config,
        {
          client: {
            provider: "openai",
            apiFormat: "chat",
            stream: false,
            defaults: {
              temperature: 0.7,
              maxTokens: 4096,
              thinkingBudget: 0, maxTokensCap: null,
              extra: {},
            },
          },
          model: "test-model",
          projectRoot: root,
        },
        bookDir,
        "raw chapter",
        7,
        "xuanhuan",
      );

      expect(repairChapter).toHaveBeenCalledOnce();
      expect(repairChapter).toHaveBeenCalledWith(expect.objectContaining({
        bookDir,
        chapterContent: "raw chapter",
        chapterNumber: 7,
        mode: "anti-detect",
        genre: "xuanhuan",
      }));
      expect(result).toEqual({
        chapterNumber: 7,
        originalScore: 0.91,
        finalScore: 0.14,
        attempts: 1,
        passed: true,
        finalContent: "humanized chapter",
      });

      const history = await loadDetectionHistory(bookDir);
      expect(history).toHaveLength(1);
      expect(history[0]).toMatchObject({
        chapterNumber: 7,
        action: "rewrite",
        attempt: 1,
        score: 0.14,
      });

      const rawHistory = JSON.parse(await readFile(join(bookDir, "story/detection_history.json"), "utf-8")) as Array<Record<string, unknown>>;
      expect(rawHistory).toHaveLength(1);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

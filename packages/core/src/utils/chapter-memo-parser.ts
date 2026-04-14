import YAML from "js-yaml";
import { ChapterMemoSchema, type ChapterMemo } from "../models/input-governance.js";

export class PlannerParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlannerParseError";
  }
}

const REQUIRED_SECTIONS: ReadonlyArray<string> = [
  "## 当前任务",
  "## 读者此刻在等什么",
  "## 该兑现的 / 暂不掀的",
  "## 日常/过渡承担什么任务",
  "## 关键抉择过三连问",
  "## 章尾必须发生的改变",
  "## 不要做",
];

/**
 * Parse a planner memo produced by the LLM.
 *
 * Format: YAML frontmatter delimited by `---\n...\n---\n` followed by a
 * markdown body containing the seven required section headings.
 *
 * Strict on core fields (chapter integer + matches expected, goal non-empty
 * and ≤ 50 chars, required section headings present). Lenient on aux fields
 * (threadRefs coerced to string[], defaults to []).
 *
 * `isGoldenOpening` is authoritative from the caller — any value the LLM
 * includes in the frontmatter is ignored.
 */
export function parseMemo(
  raw: string,
  expectedChapter: number,
  isGoldenOpening: boolean,
): ChapterMemo {
  const trimmed = raw.trim();
  const match = trimmed.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  if (!match) {
    throw new PlannerParseError("missing YAML frontmatter delimiters");
  }

  const yamlText = match[1]!;
  const body = match[2]!.trim();

  let fm: unknown;
  try {
    fm = YAML.load(yamlText);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new PlannerParseError(`invalid YAML in frontmatter: ${message}`);
  }
  if (!fm || typeof fm !== "object" || Array.isArray(fm)) {
    throw new PlannerParseError("frontmatter is not an object");
  }
  const f = fm as Record<string, unknown>;

  if (typeof f.chapter !== "number" || !Number.isInteger(f.chapter)) {
    throw new PlannerParseError("chapter must be an integer");
  }
  if (f.chapter !== expectedChapter) {
    throw new PlannerParseError(
      `chapter mismatch: expected ${expectedChapter}, got ${f.chapter}`,
    );
  }

  if (typeof f.goal !== "string" || f.goal.length === 0) {
    throw new PlannerParseError("goal must be a non-empty string");
  }
  if (f.goal.length > 50) {
    throw new PlannerParseError(
      `goal too long: ${f.goal.length} chars (max 50)`,
    );
  }

  const missing = REQUIRED_SECTIONS.filter((heading) => !body.includes(heading));
  if (missing.length > 0) {
    throw new PlannerParseError(`missing sections: ${missing.join(", ")}`);
  }

  const threadRefs = Array.isArray(f.threadRefs)
    ? f.threadRefs.filter((value): value is string => typeof value === "string")
    : [];

  return ChapterMemoSchema.parse({
    chapter: f.chapter,
    goal: f.goal,
    isGoldenOpening,
    body,
    threadRefs,
  });
}

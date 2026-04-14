import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseMarkdownTableRows } from "../utils/story-markdown.js";

async function readOrEmpty(path: string): Promise<string> {
  try {
    return await readFile(path, "utf-8");
  } catch {
    return "";
  }
}

export async function readCharacterMatrix(storyDir: string): Promise<string> {
  return readOrEmpty(join(storyDir, "character_matrix.md"));
}

export async function readSubplotBoard(storyDir: string): Promise<string> {
  return readOrEmpty(join(storyDir, "subplot_board.md"));
}

export async function readEmotionalArcs(storyDir: string): Promise<string> {
  return readOrEmpty(join(storyDir, "emotional_arcs.md"));
}

export async function readPendingHooks(storyDir: string): Promise<string> {
  return readOrEmpty(join(storyDir, "pending_hooks.md"));
}

export async function readBookRules(storyDir: string): Promise<string> {
  return readOrEmpty(join(storyDir, "book_rules.md"));
}

/**
 * Grab the last N row(s) from chapter_summaries.md formatted as markdown
 * table. Returns original table slice (with header) so the planner gets
 * column meaning implicitly.
 */
export function formatRecentSummaries(
  chapterSummariesRaw: string,
  chapterNumber: number,
  limit: number,
): string {
  const rows = parseMarkdownTableRows(chapterSummariesRaw)
    .filter((row) => /^\d+$/.test(row[0] ?? ""))
    .filter((row) => parseInt(row[0]!, 10) < chapterNumber)
    .sort((a, b) => parseInt(a[0]!, 10) - parseInt(b[0]!, 10));

  const recent = rows.slice(-limit);
  if (recent.length === 0) {
    return "（暂无前章摘要）";
  }

  const header = "| 章节 | 标题 | 出场人物 | 关键事件 | 状态变化 | 伏笔动态 | 情绪基调 | 章节类型 |";
  const divider = "| --- | --- | --- | --- | --- | --- | --- | --- |";
  const body = recent.map((row) => `| ${row.join(" | ")} |`).join("\n");
  return [header, divider, body].join("\n");
}

/**
 * Option A: temporarily compose current_arc prose from subplot_board.md
 * active rows + emotional_arcs.md recent rows. Phase 8 will replace this
 * source with a dedicated tier2_current_arc.md file.
 */
export function composeCurrentArcProse(
  subplotBoardRaw: string,
  emotionalArcsRaw: string,
  chapterNumber: number,
): string {
  const activeSubplots = extractActiveSubplotLines(subplotBoardRaw);
  const recentArcs = extractRecentEmotionalArcLines(emotionalArcsRaw, chapterNumber, 3);

  const parts: string[] = [];
  if (activeSubplots.length > 0) {
    parts.push("活跃支线：\n" + activeSubplots.map((line) => `- ${line}`).join("\n"));
  }
  if (recentArcs.length > 0) {
    parts.push("近期情感线：\n" + recentArcs.map((line) => `- ${line}`).join("\n"));
  }
  if (parts.length === 0) {
    return "（暂无 arc 数据——可能是新书起始阶段）";
  }
  return parts.join("\n\n");
}

function extractActiveSubplotLines(raw: string): string[] {
  const rows = parseMarkdownTableRows(raw);
  if (rows.length === 0) {
    return raw
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.startsWith("-"))
      .map((line) => line.replace(/^-\s*/, ""))
      .filter(Boolean)
      .slice(0, 6);
  }
  return rows
    .filter((row) => !/^(id|subplot_id|subplot|status|状态)$/i.test(row[0] ?? ""))
    .filter((row) => {
      const status = (row.find((cell) => /进行|推进|高压|激活|activ|progress|partial/i.test(cell)) ?? "");
      const dormant = row.find((cell) => /暂稳待续|暂挂|dormant|paused/i.test(cell));
      return Boolean(status) && !dormant;
    })
    .map((row) => row.filter(Boolean).join(" | "))
    .slice(0, 6);
}

function extractRecentEmotionalArcLines(raw: string, chapterNumber: number, limit: number): string[] {
  const rows = parseMarkdownTableRows(raw);
  if (rows.length === 0) {
    return raw
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.startsWith("-"))
      .slice(-limit)
      .map((line) => line.replace(/^-\s*/, ""));
  }
  return rows
    .filter((row) => /^\d+$/.test(row[0] ?? ""))
    .filter((row) => parseInt(row[0]!, 10) < chapterNumber)
    .slice(-limit)
    .map((row) => row.filter(Boolean).join(" | "));
}

/**
 * Extract the protagonist row from character_matrix.md. Protagonist is
 * detected by relation column containing "主角" or "protagonist".
 */
export function extractProtagonistRow(characterMatrixRaw: string): string {
  const rows = parseMarkdownTableRows(characterMatrixRaw);
  const protagonist = rows.find((row) =>
    row.some((cell) => /^(主角|protagonist)$/i.test(cell.trim())),
  );
  if (protagonist) {
    return `| ${protagonist.join(" | ")} |`;
  }
  return "（未找到主角行——请检查 character_matrix.md）";
}

const OPPONENT_PATTERNS = /敌对|对手|阻力|opponent|antagonist|foe/i;
const COLLABORATOR_PATTERNS = /协力|盟友|临时助力|ally|collaborator|mentor/i;

export function extractOpponentRows(characterMatrixRaw: string, limit: number): string {
  return extractRowsByRelation(characterMatrixRaw, OPPONENT_PATTERNS, limit, "（暂无明确对手登场）");
}

export function extractCollaboratorRows(characterMatrixRaw: string, limit: number): string {
  return extractRowsByRelation(characterMatrixRaw, COLLABORATOR_PATTERNS, limit, "（暂无明确协作者登场）");
}

function extractRowsByRelation(
  characterMatrixRaw: string,
  pattern: RegExp,
  limit: number,
  emptyText: string,
): string {
  const rows = parseMarkdownTableRows(characterMatrixRaw)
    .filter((row) => row.some((cell) => pattern.test(cell)))
    .filter((row) => !row.some((cell) => /^(主角|protagonist)$/i.test(cell.trim())))
    .slice(0, limit);
  if (rows.length === 0) {
    return emptyText;
  }
  return rows.map((row) => `| ${row.join(" | ")} |`).join("\n");
}

const RELEVANT_THREAD_STATUS_PATTERN = /activat|partial_payoff|推进|高压|open|progress/i;
const STALE_STATUS_PATTERN = /resolved|deferred|dormant|暂稳待续|暂挂|已回收/i;

export function extractRelevantThreads(pendingHooksRaw: string, subplotBoardRaw: string): string {
  const hookRows = parseMarkdownTableRows(pendingHooksRaw)
    .filter((row) => !/^(hook_id)$/i.test(row[0] ?? ""))
    .filter((row) => row.some((cell) => RELEVANT_THREAD_STATUS_PATTERN.test(cell)))
    .filter((row) => !row.some((cell) => STALE_STATUS_PATTERN.test(cell)))
    .map((row) => `- ${row[0]}: ${row.slice(1).filter(Boolean).join(" | ")}`);

  const subplotRows = parseMarkdownTableRows(subplotBoardRaw)
    .filter((row) => !/^(id|subplot_id|subplot)$/i.test(row[0] ?? ""))
    .filter((row) => row.some((cell) => RELEVANT_THREAD_STATUS_PATTERN.test(cell)))
    .filter((row) => !row.some((cell) => STALE_STATUS_PATTERN.test(cell)))
    .map((row) => `- ${row[0]}: ${row.slice(1).filter(Boolean).join(" | ")}`);

  const lines = [...hookRows, ...subplotRows];
  if (lines.length === 0) {
    return "（暂无活跃线索）";
  }
  return lines.join("\n");
}

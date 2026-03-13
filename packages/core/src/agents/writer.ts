import { BaseAgent } from "./base.js";
import type { BookConfig } from "../models/book.js";
import type { GenreProfile } from "../models/genre-profile.js";
import type { BookRules } from "../models/book-rules.js";
import { buildWriterSystemPrompt } from "./writer-prompts.js";
import { readGenreProfile, readBookRules } from "./rules-reader.js";
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";

export interface WriteChapterInput {
  readonly book: BookConfig;
  readonly bookDir: string;
  readonly chapterNumber: number;
  readonly externalContext?: string;
}

export interface WriteChapterOutput {
  readonly chapterNumber: number;
  readonly title: string;
  readonly content: string;
  readonly wordCount: number;
  readonly preWriteCheck: string;
  readonly postSettlement: string;
  readonly updatedState: string;
  readonly updatedLedger: string;
  readonly updatedHooks: string;
  readonly chapterSummary: string;
  readonly updatedSubplots: string;
  readonly updatedEmotionalArcs: string;
  readonly updatedCharacterMatrix: string;
}

export class WriterAgent extends BaseAgent {
  get name(): string {
    return "writer";
  }

  async writeChapter(input: WriteChapterInput): Promise<WriteChapterOutput> {
    const { book, bookDir, chapterNumber } = input;

    const [
      storyBible, volumeOutline, styleGuide, currentState, ledger, hooks,
      chapterSummaries, subplotBoard, emotionalArcs, characterMatrix, styleProfileRaw,
    ] = await Promise.all([
        this.readFileOrDefault(join(bookDir, "story/story_bible.md")),
        this.readFileOrDefault(join(bookDir, "story/volume_outline.md")),
        this.readFileOrDefault(join(bookDir, "story/style_guide.md")),
        this.readFileOrDefault(join(bookDir, "story/current_state.md")),
        this.readFileOrDefault(join(bookDir, "story/particle_ledger.md")),
        this.readFileOrDefault(join(bookDir, "story/pending_hooks.md")),
        this.readFileOrDefault(join(bookDir, "story/chapter_summaries.md")),
        this.readFileOrDefault(join(bookDir, "story/subplot_board.md")),
        this.readFileOrDefault(join(bookDir, "story/emotional_arcs.md")),
        this.readFileOrDefault(join(bookDir, "story/character_matrix.md")),
        this.readFileOrDefault(join(bookDir, "story/style_profile.json")),
      ]);

    const recentChapters = await this.loadRecentChapters(bookDir, chapterNumber);

    // Load genre profile + book rules
    const { profile: genreProfile, body: genreBody } =
      await readGenreProfile(this.ctx.projectRoot, book.genre);
    const parsedBookRules = await readBookRules(bookDir);
    const bookRules = parsedBookRules?.rules ?? null;
    const bookRulesBody = parsedBookRules?.body ?? "";

    const styleFingerprint = this.buildStyleFingerprint(styleProfileRaw);

    const systemPrompt = buildWriterSystemPrompt(
      book, genreProfile, bookRules, bookRulesBody, genreBody, styleGuide, styleFingerprint,
    );

    const userPrompt = this.buildUserPrompt({
      chapterNumber,
      storyBible,
      volumeOutline,
      currentState,
      ledger: genreProfile.numericalSystem ? ledger : "",
      hooks,
      recentChapters,
      wordCount: book.chapterWordCount,
      externalContext: input.externalContext,
      chapterSummaries,
      subplotBoard,
      emotionalArcs,
      characterMatrix,
    });

    const response = await this.chat(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      { maxTokens: 16384, temperature: 0.7 },
    );

    return this.parseOutput(chapterNumber, response.content, genreProfile);
  }

  async saveChapter(
    bookDir: string,
    output: WriteChapterOutput,
    numericalSystem: boolean = true,
  ): Promise<void> {
    const chaptersDir = join(bookDir, "chapters");
    const storyDir = join(bookDir, "story");
    await mkdir(chaptersDir, { recursive: true });

    const paddedNum = String(output.chapterNumber).padStart(4, "0");
    const filename = `${paddedNum}_${this.sanitizeFilename(output.title)}.md`;

    const chapterContent = [
      `# 第${output.chapterNumber}章 ${output.title}`,
      "",
      output.content,
    ].join("\n");

    const writes: Array<Promise<void>> = [
      writeFile(join(chaptersDir, filename), chapterContent, "utf-8"),
      writeFile(join(storyDir, "current_state.md"), output.updatedState, "utf-8"),
      writeFile(join(storyDir, "pending_hooks.md"), output.updatedHooks, "utf-8"),
    ];

    if (numericalSystem) {
      writes.push(
        writeFile(join(storyDir, "particle_ledger.md"), output.updatedLedger, "utf-8"),
      );
    }

    await Promise.all(writes);
  }

  private buildUserPrompt(params: {
    readonly chapterNumber: number;
    readonly storyBible: string;
    readonly volumeOutline: string;
    readonly currentState: string;
    readonly ledger: string;
    readonly hooks: string;
    readonly recentChapters: string;
    readonly wordCount: number;
    readonly externalContext?: string;
    readonly chapterSummaries: string;
    readonly subplotBoard: string;
    readonly emotionalArcs: string;
    readonly characterMatrix: string;
  }): string {
    const contextBlock = params.externalContext
      ? `\n## 外部指令\n以下是来自外部系统的创作指令，请在本章中融入：\n\n${params.externalContext}\n`
      : "";

    const ledgerBlock = params.ledger
      ? `\n## 资源账本\n${params.ledger}\n`
      : "";

    const summariesBlock = params.chapterSummaries !== "(文件尚未创建)"
      ? `\n## 章节摘要（全部历史章节压缩上下文）\n${params.chapterSummaries}\n`
      : "";

    const subplotBlock = params.subplotBoard !== "(文件尚未创建)"
      ? `\n## 支线进度板\n${params.subplotBoard}\n`
      : "";

    const emotionalBlock = params.emotionalArcs !== "(文件尚未创建)"
      ? `\n## 情感弧线\n${params.emotionalArcs}\n`
      : "";

    const matrixBlock = params.characterMatrix !== "(文件尚未创建)"
      ? `\n## 角色交互矩阵\n${params.characterMatrix}\n`
      : "";

    return `请续写第${params.chapterNumber}章。
${contextBlock}
## 当前状态卡
${params.currentState}
${ledgerBlock}
## 伏笔池
${params.hooks}
${summariesBlock}${subplotBlock}${emotionalBlock}${matrixBlock}
## 最近章节
${params.recentChapters || "(这是第一章，无前文)"}

## 世界观设定
${params.storyBible}

## 卷纲
${params.volumeOutline}

要求：
- 正文不少于${params.wordCount}字
- 写完后更新状态卡${params.ledger ? "、资源账本" : ""}、伏笔池、章节摘要、支线进度板、情感弧线、角色交互矩阵
- 先输出写作自检表，再写正文`;
  }

  private async loadRecentChapters(
    bookDir: string,
    currentChapter: number,
  ): Promise<string> {
    const chaptersDir = join(bookDir, "chapters");
    try {
      const files = await readdir(chaptersDir);
      const mdFiles = files
        .filter((f) => f.endsWith(".md") && !f.startsWith("index"))
        .sort()
        .slice(-3);

      if (mdFiles.length === 0) return "";

      const contents = await Promise.all(
        mdFiles.map(async (f) => {
          const content = await readFile(join(chaptersDir, f), "utf-8");
          return content;
        }),
      );

      return contents.join("\n\n---\n\n");
    } catch {
      return "";
    }
  }

  private async readFileOrDefault(path: string): Promise<string> {
    try {
      return await readFile(path, "utf-8");
    } catch {
      return "(文件尚未创建)";
    }
  }

  private parseOutput(
    chapterNumber: number,
    content: string,
    genreProfile: GenreProfile,
  ): WriteChapterOutput {
    const extract = (tag: string): string => {
      const regex = new RegExp(
        `=== ${tag} ===\\s*([\\s\\S]*?)(?==== [A-Z_]+ ===|$)`,
      );
      const match = content.match(regex);
      return match?.[1]?.trim() ?? "";
    };

    const chapterContent = extract("CHAPTER_CONTENT");

    return {
      chapterNumber,
      title: extract("CHAPTER_TITLE") || `第${chapterNumber}章`,
      content: chapterContent,
      wordCount: chapterContent.length,
      preWriteCheck: extract("PRE_WRITE_CHECK"),
      postSettlement: extract("POST_SETTLEMENT"),
      updatedState: extract("UPDATED_STATE") || "(状态卡未更新)",
      updatedLedger: genreProfile.numericalSystem
        ? (extract("UPDATED_LEDGER") || "(账本未更新)")
        : "",
      updatedHooks: extract("UPDATED_HOOKS") || "(伏笔池未更新)",
      chapterSummary: extract("CHAPTER_SUMMARY"),
      updatedSubplots: extract("UPDATED_SUBPLOTS"),
      updatedEmotionalArcs: extract("UPDATED_EMOTIONAL_ARCS"),
      updatedCharacterMatrix: extract("UPDATED_CHARACTER_MATRIX"),
    };
  }

  /** Save new truth files (summaries, subplots, emotional arcs, character matrix). */
  async saveNewTruthFiles(bookDir: string, output: WriteChapterOutput): Promise<void> {
    const storyDir = join(bookDir, "story");
    const writes: Array<Promise<void>> = [];

    // Append chapter summary to chapter_summaries.md
    if (output.chapterSummary) {
      writes.push(this.appendChapterSummary(storyDir, output.chapterSummary));
    }

    // Overwrite subplot board
    if (output.updatedSubplots) {
      writes.push(writeFile(join(storyDir, "subplot_board.md"), output.updatedSubplots, "utf-8"));
    }

    // Overwrite emotional arcs
    if (output.updatedEmotionalArcs) {
      writes.push(writeFile(join(storyDir, "emotional_arcs.md"), output.updatedEmotionalArcs, "utf-8"));
    }

    // Overwrite character matrix
    if (output.updatedCharacterMatrix) {
      writes.push(writeFile(join(storyDir, "character_matrix.md"), output.updatedCharacterMatrix, "utf-8"));
    }

    await Promise.all(writes);
  }

  private async appendChapterSummary(storyDir: string, summary: string): Promise<void> {
    const summaryPath = join(storyDir, "chapter_summaries.md");
    let existing = "";
    try {
      existing = await readFile(summaryPath, "utf-8");
    } catch {
      // File doesn't exist yet — start with header
      existing = "# 章节摘要\n\n| 章节 | 标题 | 出场人物 | 关键事件 | 状态变化 | 伏笔动态 | 情绪基调 | 章节类型 |\n|------|------|----------|----------|----------|----------|----------|----------|\n";
    }

    // Extract only the data row(s) from the summary (skip header lines)
    const dataRows = summary
      .split("\n")
      .filter((line) => line.startsWith("|") && !line.startsWith("| 章节") && !line.startsWith("|--"))
      .join("\n");

    if (dataRows) {
      await writeFile(summaryPath, `${existing.trimEnd()}\n${dataRows}\n`, "utf-8");
    }
  }

  private buildStyleFingerprint(styleProfileRaw: string): string | undefined {
    if (!styleProfileRaw || styleProfileRaw === "(文件尚未创建)") return undefined;
    try {
      const profile = JSON.parse(styleProfileRaw);
      const lines: string[] = [];
      if (profile.avgSentenceLength) lines.push(`- 平均句长：${profile.avgSentenceLength}字`);
      if (profile.sentenceLengthStdDev) lines.push(`- 句长标准差：${profile.sentenceLengthStdDev}`);
      if (profile.avgParagraphLength) lines.push(`- 平均段落长度：${profile.avgParagraphLength}字`);
      if (profile.paragraphLengthRange) lines.push(`- 段落长度范围：${profile.paragraphLengthRange.min}-${profile.paragraphLengthRange.max}字`);
      if (profile.vocabularyDiversity) lines.push(`- 词汇多样性(TTR)：${profile.vocabularyDiversity}`);
      if (profile.topPatterns?.length > 0) lines.push(`- 高频句式：${profile.topPatterns.join("、")}`);
      if (profile.rhetoricalFeatures?.length > 0) lines.push(`- 修辞特征：${profile.rhetoricalFeatures.join("、")}`);
      return lines.length > 0 ? lines.join("\n") : undefined;
    } catch {
      return undefined;
    }
  }

  private sanitizeFilename(title: string): string {
    return title
      .replace(/[/\\?%*:|"<>]/g, "")
      .replace(/\s+/g, "_")
      .slice(0, 50);
  }
}

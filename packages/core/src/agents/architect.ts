import { BaseAgent } from "./base.js";
import type { BookConfig, FanficMode } from "../models/book.js";
import type { GenreProfile } from "../models/genre-profile.js";
import { readGenreProfile } from "./rules-reader.js";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { renderHookSnapshot } from "../utils/memory-retrieval.js";
import {
  shouldPromoteHook,
  type PromotionContext,
  type VolumeBoundary,
} from "../utils/hook-promotion.js";
import type { StoredHook } from "../state/memory-db.js";

// ---------------------------------------------------------------------------
// Phase 5 (v13) — Static 骨架 layer collapse
//
// Architect now produces 3 prose outline files + one-file-per-character roles/
// folder, plus compat pointer shims for story_bible.md and character_matrix.md.
// The 9-file contract degenerates into this shape:
//
//   outline/story_frame.md      ← 5 prose sections
//   outline/volume_map.md       ← 6 prose sections, chapter-granular
//   outline/节奏原则.md         ← 6 concrete rhythm principles (prose)
//   roles/主要角色/<name>.md    ← one file per major character
//   roles/次要角色/<name>.md    ← one file per minor character
//   story_bible.md              ← compat shim (pointer + excerpt)
//   character_matrix.md         ← compat shim (pointer + role listing)
//   book_rules.md               ← compat shim (cleanup #3). YAML frontmatter
//                                 now lives on story_frame.md.
//   current_state.md            ← runtime state (unchanged)
//   pending_hooks.md            ← runtime state (unchanged)
//   emotional_arcs.md           ← runtime state (unchanged)
//
// 「散文密度」= 架构师 LLM 的输出密度。所有 prose 都写死在架构师 prompt 里，
// 不从模板复制。v6 灵气的起点在这里。
// ---------------------------------------------------------------------------

export interface ArchitectRole {
  readonly tier: "major" | "minor";
  readonly name: string;
  readonly content: string;
}

/**
 * Split a markdown string into its leading YAML frontmatter block and the
 * remaining body. Returns `frontmatter: null` when no frontmatter is present.
 * Only recognises a frontmatter block that starts on the FIRST non-empty
 * line — embedded `---` sections in prose are left alone.
 */
function extractYamlFrontmatter(raw: string): { frontmatter: string | null; body: string } {
  if (!raw) return { frontmatter: null, body: "" };
  const stripped = raw.replace(/^```(?:md|markdown|yaml)?\s*\n/, "").replace(/\n```\s*$/, "");
  const leadingMatch = stripped.match(/^\s*---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if (!leadingMatch) {
    return { frontmatter: null, body: stripped };
  }
  return {
    frontmatter: `---\n${leadingMatch[1]}\n---`,
    body: leadingMatch[2].trim(),
  };
}

export interface ArchitectOutput {
  // Legacy shape — kept for back-compat with consumers that still read the
  // old file names. Filled from the new prose sections below when Phase 5
  // architect runs; external callers see the same surface.
  readonly storyBible: string;
  readonly volumeOutline: string;
  readonly bookRules: string;
  readonly currentState: string;
  readonly pendingHooks: string;
  // Phase 5 new shape. Optional in the type surface so legacy test fixtures
  // that mock only the old fields continue to compile — the architect itself
  // always fills these at runtime.
  readonly storyFrame?: string;
  readonly volumeMap?: string;
  readonly rhythmPrinciples?: string;
  readonly roles?: ReadonlyArray<ArchitectRole>;
}

export class ArchitectAgent extends BaseAgent {
  get name(): string {
    return "architect";
  }

  async generateFoundation(
    book: BookConfig,
    externalContext?: string,
    reviewFeedback?: string,
  ): Promise<ArchitectOutput> {
    const { profile: gp, body: genreBody } =
      await readGenreProfile(this.ctx.projectRoot, book.genre);
    const resolvedLanguage = book.language ?? gp.language;

    const contextBlock = externalContext
      ? `\n\n## 外部指令\n以下是来自外部系统的创作指令，请将其融入设定中：\n\n${externalContext}\n`
      : "";
    const reviewFeedbackBlock = this.buildReviewFeedbackBlock(reviewFeedback, resolvedLanguage);

    const numericalBlock = gp.numericalSystem
      ? "- 有明确的数值/资源体系可追踪\n- 在 book_rules 中定义 numericalSystemOverrides（hardCap、resourceTypes）"
      : "- 本题材无数值系统，不需要资源账本";
    const powerBlock = gp.powerScaling ? "- 有明确的战力等级体系" : "";
    const eraBlock = gp.eraResearch ? "- 需要年代考据支撑（在 book_rules 中设置 eraConstraints）" : "";

    const systemPrompt = resolvedLanguage === "en"
      ? this.buildEnglishFoundationPrompt(book, gp, genreBody, contextBlock, reviewFeedbackBlock, numericalBlock, powerBlock, eraBlock)
      : this.buildChineseFoundationPrompt(book, gp, genreBody, contextBlock, reviewFeedbackBlock, numericalBlock, powerBlock, eraBlock);

    const langPrefix = resolvedLanguage === "en"
      ? `【LANGUAGE OVERRIDE】ALL output (story_frame, volume_map, rhythm_principles, roles, book_rules, current_state, pending_hooks) MUST be written in English. Character names, place names, and all prose must be in English. The === SECTION: === tags remain unchanged.\n\n`
      : "";
    const userMessage = resolvedLanguage === "en"
      ? `Generate the complete foundation for a ${gp.name} novel titled "${book.title}". Write everything in English.`
      : `请为标题为"${book.title}"的${gp.name}小说生成完整基础设定。`;

    const response = await this.chat([
      { role: "system", content: langPrefix + systemPrompt },
      { role: "user", content: userMessage },
    ], { maxTokens: 20480, temperature: 0.8 });

    return this.parseSections(response.content, resolvedLanguage);
  }

  // -------------------------------------------------------------------------
  // Prose prompt — zh (primary)
  // -------------------------------------------------------------------------
  private buildChineseFoundationPrompt(
    book: BookConfig,
    gp: GenreProfile,
    genreBody: string,
    contextBlock: string,
    reviewFeedbackBlock: string,
    numericalBlock: string,
    powerBlock: string,
    eraBlock: string,
  ): string {
    return `你是这本书的总架构师。你的唯一输出是**散文密度的基础设定**——不是表格、不是 schema、不是条目化 bullet。v6 以后这本书的"灵气"从哪里来？从你这里来。你的散文密度决定了后面 planner 能不能读出"稀疏 memo"，writer 能不能写出活人，reviewer 能不能校准硬伤。${contextBlock}${reviewFeedbackBlock}

## 书籍元信息
- 平台：${book.platform}
- 题材：${gp.name}（${book.genre}）
- 目标章数：${book.targetChapters}章
- 每章字数：${book.chapterWordCount}字
- 标题：${book.title}

## 题材底色
${genreBody}

## 产出约束（硬性）
${numericalBlock}
${powerBlock}
${eraBlock}

## 输出结构（严格按 === SECTION: === 分块，不要漏任何一块）

=== SECTION: story_frame ===

这是散文骨架。5 段，每段约 1500 字，不要写表格，不要写 bullet list，写成能被人读下去的段落。段落标题用 \`## \` 开头，段落内部是正经段落。

### 段 1：主题与基调
写这本书到底讲的是什么——不是"讲主角如何从弱到强"这种空话，而是具体的命题（"一个被时代按在泥里的人，如何选择不被改写"、"当所有人都在撒谎时，坚持记录真相要付出什么代价"）。主题下面跟着基调——温情冷冽悲壮肃杀，哪一种？为什么是这种而不是另一种？

### 段 2：主角弧线（起点 → 终点 → 代价）
主角从哪里出发（身份、处境、核心缺陷、一开始最想要什么），到哪里落脚（最终变成什么样的人、拿到/失去什么），为了这个落脚他付出了什么不可逆的代价（关系、身体、信念、某段过去）。不要只写"变强"这种平面变化，要写**内在的位移**。

### 段 3：核心冲突与对手
这本书的主要矛盾是什么？不是"正邪对抗"，而是"因为 A 相信 X、B 相信 Y，所以他们一定会在某件事上对撞"。主要对手是谁（至少 2 个：一个显性对手 + 一个结构性对手/体制），他们的动机从哪里长出来。对手不是工具，对手有自己的逻辑。

### 段 4：世界观底色（含铁律 + 风格基调）
这个世界的运行规则是什么？3-5 条**不可违反的铁律**（原本写在 book_rules 里的 prohibitions，现在用散文嵌进去）。这个世界的质感是什么——湿的还是干的、快的还是慢的、噪的还是静的？给 writer 一个明确的感官锚（这是原来 particle_ledger 承载的基调部分）。

### 段 5：终局方向
这本书最后一章大概是什么感觉——不是"主角登顶"、"大结局"这种套话，而是**最后一个镜头**大致长什么样。主角最后在哪、做什么、身边有谁、心里想什么。这是给全书所有后面的规划一个远方靶子。

=== SECTION: volume_map ===

这是分卷散文地图，6 段。**关键要求：写到章级 prose**（"第 17 章让他回家"、"第 32-35 章把师父的秘密揭开"级别的布局）。这是 Phase 3 planner LLM 能从稀疏 memo 里读出动作的源头。不写到章级就废了。

### 段 1：各卷主题与情绪曲线
有几卷？每卷的主题一句话，每卷的情绪曲线一段（哪里压、哪里爽、哪里冷、哪里暖）。不要机械的"第一卷打小怪第二卷打大怪"，写情绪的流动。

### 段 2：关键节点章（散文级到章号）
列出本书的关键章——高潮章（第 X 章、第 Y 章）、重大转折章、呼吸章/温情章。每个节点一句话说"这一章发生什么、为什么放在这个位置"。例："第 17 章让他回家——母亲已经病了三卷没见，这一章的重量在回家路上那段沉默"。

### 段 3：卷间钩子与回收承诺
第 1 卷埋什么钩子、哪一章回收；第 2 卷埋什么、哪一章回收。散文写，不要表格。必须写具体"这个钩子在第 N 章回"而不是"后期回收"。

### 段 4：角色阶段性目标
主角在第 1 卷末要到什么状态？第 2 卷末？每一卷结束时主角的身份/关系/能力/心境应该是什么。次要角色的阶段性变化也要点到（师父在第 2 卷会死、对手在第 3 卷会黑化等）。

### 段 5：卷尾必须发生的改变
每一卷最后一章必须发生什么不可逆的事——权力结构改变、关系破裂、秘密暴露、主角身份重定位。写散文，一卷一段。

### 段 6：节奏意图（哪几章喘息 / 哪几章压紧）
本书节奏的宏观设计：前 X 章高压引人，第 X-Y 章放缓给感情线呼吸空间，第 Y-Z 章再次拉紧引向中卷高潮。这段直接指导 writer 在某一章该松还是该紧。

=== SECTION: rhythm_principles ===

6 条节奏原则——**必须写具体不抽象**。反面例子："节奏要张弛有度"（废话）。正面例子："前 30 章每 5 章一个小爽点，且小爽点必须落在章末 300 字内"。

### 原则 1：高潮间距
本书大高潮之间最长多少章？为什么？

### 原则 2：喘息频率
高压段多长必须插一章喘息？喘息章不是水章，它承担什么任务？

### 原则 3：钩子密度
每章章末必须留钩，一个还是两个？主钩最多允许悬多少章？

### 原则 4：信息释放节奏
主线信息（主角的秘密、对手的底牌、世界的真相）按什么节奏暴露？前 1/3 释放多少，中段多少，后段多少？

### 原则 5：爽点节奏
爽点间距多少章一个？什么样的爽点（智商碾压 / 实力反杀 / 翻身打脸 / 真相揭穿）？

### 原则 6：情感节点递进
情感关系（主角与 X 的关系）每多少章必须有一次实质推进？不推进会塌。

=== SECTION: roles ===

一人一卡 prose，用以下格式分隔：

---ROLE---
tier: major
name: <角色名>
---CONTENT---
（这里写散文角色卡，下面的 7 个小标题必须全部出现，每段至少 3 行正经散文，不要写表格）

## 核心标签
（3-5 个关键词 + 一句话为什么是这些词）

## 反差细节
（1-2 个与核心标签反差的具体细节——"冷酷杀手但会给流浪猫留鱼骨"。反差细节是人物立体化的公式，必须有。）

## 人物小传（过往经历）
（一段散文，说这个人怎么变成现在这样。童年/重大事件/塑造性格的那件事。）

## 当前现状
（第 0 章时他在哪、做什么、处境如何、最近最烦心的事。）

## 关系网络
（与主角、与其他重要角色的关系——一句话一条，关系不是标签是动态。）

## 内在驱动
（他想要什么、为什么想要、愿意付出什么代价。）

## 成长弧光
（他在这本书里会经历什么内在位移——变好变坏变复杂，落在哪里。）

---ROLE---
tier: major
name: <下一个主要角色>
---CONTENT---
...

（主要角色至少 3 个：主角 + 主要对手 + 主要协作者。建议 4-5 个。）

---ROLE---
tier: minor
name: <次要角色名>
---CONTENT---
（次要角色简化版，只需要 4 个小标题：核心标签 / 反差细节 / 当前现状 / 与主角关系，每段 1-2 行即可）

（次要角色 3-5 个，按出场密度给。）

=== SECTION: book_rules ===

生成 book_rules.md 格式的 YAML frontmatter，保留结构化字段供 readBookRules() 使用：
\`\`\`
---
version: "1.0"
protagonist:
  name: (主角名)
  personalityLock: [(3-5个性格关键词)]
  behavioralConstraints: [(3-5条行为约束)]
genreLock:
  primary: ${book.genre}
  forbidden: [(2-3种禁止混入的文风)]
${gp.numericalSystem ? `numericalSystemOverrides:
  hardCap: (根据设定确定)
  resourceTypes: [(核心资源类型列表)]` : ""}
prohibitions:
  - (3-5条本书禁忌)
chapterTypesOverride: []
fatigueWordsOverride: []
additionalAuditDimensions: []
enableFullCastTracking: false
---

## 叙事视角
(描述本书叙事视角，一段散文)

## 核心冲突驱动
(指向 outline/story_frame.md 的段 3 并做一段精简概述)
\`\`\`

=== SECTION: current_state ===

初始状态卡（第0章），Markdown 表格：
| 字段 | 值 |
|------|-----|
| 当前章节 | 0 |
| 当前位置 | (起始地点) |
| 主角状态 | (初始状态) |
| 当前目标 | (第一个目标) |
| 当前限制 | (初始限制) |
| 当前敌我 | (初始关系) |
| 当前冲突 | (第一个冲突) |

=== SECTION: pending_hooks ===

初始伏笔池（Markdown表格），Phase 7 扩展列：
| hook_id | 起始章节 | 类型 | 状态 | 最近推进 | 预期回收 | 回收节奏 | 上游依赖 | 回收卷 | 核心 | 半衰期 | 备注 |

伏笔表规则：
- 第5列必须是纯数字章节号，不能写自然语言描述
- 建书阶段所有伏笔都还没正式推进，所以第5列统一填 0
- 第7列必须填写：立即 / 近期 / 中程 / 慢烧 / 终局 之一
- 第8列「上游依赖」：列出必须在本伏笔之前种下/回收的上游 hook_id，格式如 [H003, H007]；若无依赖填「无」
- 第9列「回收卷」：用自然语言写该伏笔计划在哪一卷哪一段回收（例："第2卷中段"、"终卷终章前"）。不强制解析为章号
- 第10列「核心」：是否主线承重伏笔 true / false。主线承重伏笔一本书最多 3-7 条（主谜团、身世、核心承诺），其余次要伏笔填 false
- 第11列「半衰期」：可选，整数章数。若不填自动按回收节奏推导（立即/近期 = 10、中程 = 30、慢烧/终局 = 80）
- 初始线索放备注列，不放第5列

## 最后强调
- 符合${book.platform}平台口味、${gp.name}题材特征
- 主角人设鲜明、行为边界清晰
- 伏笔前后呼应、配角有独立动机不是工具人
- **story_frame / volume_map / rhythm_principles / roles 必须是散文密度，不要退化成 bullet**
- **pending_hooks 表必须包含 Phase 7 扩展列——depends_on 标出因果链、pays_off_in_arc 锁定回收大致位置、core_hook 标记主线承重伏笔（3-7 条）、half_life 仅给重点伏笔设置**`;
  }

  private buildEnglishFoundationPrompt(
    book: BookConfig,
    gp: GenreProfile,
    genreBody: string,
    contextBlock: string,
    reviewFeedbackBlock: string,
    numericalBlock: string,
    powerBlock: string,
    eraBlock: string,
  ): string {
    return `You are the architect of this book. Your only job is to produce **prose-density foundation design** — not tables, not schema, not bullet lists. The book's aura comes from your prose density: Phase 3 planner reads sparse memos out of your volume_map only if it was written to chapter-level prose; the writer only produces living characters because your role sheets carry contrast details; the reviewer only catches hard errors because your story_frame set the tonal anchors.${contextBlock}${reviewFeedbackBlock}

## Book metadata
- Platform: ${book.platform}
- Genre: ${gp.name} (${book.genre})
- Target chapters: ${book.targetChapters}
- Chapter length: ${book.chapterWordCount}
- Title: ${book.title}

## Genre body
${genreBody}

## Output constraints
${numericalBlock}
${powerBlock}
${eraBlock}

## Output contract (strict === SECTION: === blocks)

=== SECTION: story_frame ===

Five prose sections, ~1500 chars each. No tables. No bullet lists. Real paragraphs.

## 01_Theme_and_Tonal_Ground
What is this book actually about — not "hero grows from weak to strong" (empty), but a concrete proposition. Then the tonal ground: warm / cold / fierce / severe — which, and why this and not another.

## 02_Protagonist_Arc (start → end → cost)
Where the protagonist starts (identity, situation, core flaw, initial desire); where they land (who they become, what they gain or lose); the irreversible cost they pay for that landing. Show internal displacement, not just growth.

## 03_Core_Conflict_and_Opponent
The book's main tension — not "good vs evil" but "because A believes X and B believes Y, they will inevitably collide on Z". At least two opponents: one visible, one structural/systemic. Opponents have their own logic.

## 04_World_Tonal_Ground (hard rules + sensory tone)
The world's operating rules. 3-5 unbreakable laws (originally prohibitions, now embedded as prose). Sensory texture: wet or dry, fast or slow, noisy or quiet — give the writer an anchor (originally what particle_ledger carried).

## 05_Endgame_Direction
What the last chapter roughly feels like. The final shot: where, doing what, around whom, thinking what. A distant target for every planner call downstream.

=== SECTION: volume_map ===

Prose volume map, 6 sections. **Critical requirement: write to chapter-level prose** ("chapter 17 sends him home", "chapters 32-35 reveal the master's secret"). Without chapter-level detail the sparse-memo planner has nothing to read.

## 01_Volume_Themes_and_Emotional_Curves
How many volumes? Each volume's theme in one sentence; each volume's emotional curve as a paragraph (where pressured, where rewarding, where cold, where warm). Not mechanical rotation.

## 02_Key_Node_Chapters (prose-level, with chapter numbers)
Climax chapters (ch X, ch Y), turning-point chapters, breath/tender chapters. One line per node: "ch 17 sends him home — the mother has been ill three volumes unseen; the weight of the chapter lives in the silence of the walk home".

## 03_Cross_Volume_Hooks_and_Payoff_Promises
Volume 1 plants hook A, paid off in ch N; volume 2 plants hook B, paid off in ch M. Prose, not tables. Concrete chapter numbers, not "late game payoff".

## 04_Character_Stage_Goals
Protagonist's state at end of vol 1, vol 2, ... Supporting characters' stage changes (master dies end of vol 2, opponent breaks bad in vol 3).

## 05_Volume_End_Mandatory_Changes
Each volume's last chapter must contain an irreversible event. Prose, one paragraph per volume.

## 06_Rhythm_Intent (breath vs clench)
Macro rhythm: first X chapters high pressure, ch X-Y breathe for the relationship arc, ch Y-Z clench again for the mid-arc climax.

=== SECTION: rhythm_principles ===

Six rhythm principles — **must be concrete, not abstract**. Bad: "rhythm must balance tension and release". Good: "every 5 chapters in the first 30 must carry a small payoff, and each must land within the last 300 chars of the chapter".

## Principle_1_Climax_Spacing
Longest allowed distance between major climaxes. Why.

## Principle_2_Breath_Frequency
How long a high-pressure run before a breath chapter is mandatory. What the breath chapter must carry.

## Principle_3_Hook_Density
Chapter-end hooks — one or two per chapter? Maximum unresolved span for the main hook?

## Principle_4_Information_Release
How main-line information (protagonist's secret, opponent's hand, world truth) is released across first third / middle / last third.

## Principle_5_Payoff_Rhythm
Interval between small payoffs. What kind (intelligence domination / raw strength / face-slap / truth reveal).

## Principle_6_Relationship_Advancement
Every N chapters a relationship must make a concrete move or it collapses.

=== SECTION: roles ===

One-file-per-character prose. Use this delimiter:

---ROLE---
tier: major
name: <character name>
---CONTENT---
## Core_Tags
(3-5 tags + one sentence on why those tags)

## Contrast_Detail
(1-2 concrete details that contradict the core tags — "ice-cold killer but leaves fish bones for stray cats". Contrast detail is the formula for character dimensionality.)

## Back_Story
(Prose paragraph — how this person became who they are.)

## Current_State
(Where they are at chapter 0, what's on their mind, most recent worry.)

## Relationship_Network
(With protagonist, with other major characters. One line each. Relationships are dynamic, not labels.)

## Inner_Driver
(What they want, why, what they're willing to pay.)

## Growth_Arc
(What internal displacement they undergo across the book.)

---ROLE---
tier: major
name: <next major>
---CONTENT---
...

(At least 3 majors: protagonist + main opponent + main collaborator. 4-5 is ideal.)

---ROLE---
tier: minor
name: <minor name>
---CONTENT---
(Simplified: only 4 sections — Core_Tags / Contrast_Detail / Current_State / Relationship_to_Protagonist, 1-2 lines each.)

(3-5 minors.)

=== SECTION: book_rules ===

book_rules.md as YAML frontmatter + narrative guidance:
\`\`\`
---
version: "1.0"
protagonist:
  name: (protagonist name)
  personalityLock: [(3-5 personality keywords)]
  behavioralConstraints: [(3-5 behavioral constraints)]
genreLock:
  primary: ${book.genre}
  forbidden: [(2-3 forbidden style intrusions)]
${gp.numericalSystem ? `numericalSystemOverrides:
  hardCap: (decide from setting)
  resourceTypes: [(core resource types)]` : ""}
prohibitions:
  - (3-5 book-specific prohibitions)
chapterTypesOverride: []
fatigueWordsOverride: []
additionalAuditDimensions: []
enableFullCastTracking: false
---

## Narrative Perspective
(One prose paragraph on perspective and style.)

## Core Conflict Driver
(Brief pointer to outline/story_frame.md section 3.)
\`\`\`

=== SECTION: current_state ===

Initial state card (chapter 0) as a Markdown table:
| Field | Value |
| --- | --- |
| Current Chapter | 0 |
| Current Location | (starting location) |
| Protagonist State | (initial condition) |
| Current Goal | (first goal) |
| Current Constraint | (initial constraint) |
| Current Alliances | (initial relationships) |
| Current Conflict | (first conflict) |

=== SECTION: pending_hooks ===

Initial hook pool (Markdown table), Phase 7 extended columns:
| hook_id | start_chapter | type | status | last_advanced_chapter | expected_payoff | payoff_timing | depends_on | pays_off_in_arc | core_hook | half_life | notes |

Rules:
- Column 5 is a pure chapter number, not narrative description
- At book creation all planned hooks have last_advanced_chapter = 0
- Column 7 must be: immediate / near-term / mid-arc / slow-burn / endgame
- Column 8 (depends_on): upstream hook ids that must be planted / paid off before this one fires, formatted [H003, H007]; write "none" if no upstream
- Column 9 (pays_off_in_arc): free-form prose on where this hook is scheduled to pay off (e.g. "mid of volume 2", "right before the finale"). NOT parsed into chapter numbers
- Column 10 (core_hook): true / false. Core hooks are main-line load-bearing (central mystery, identity, key promise). A book typically has 3-7 cores; everything else is false
- Column 11 (half_life): optional integer chapters. If blank, derived from payoff_timing (immediate/near-term = 10, mid-arc = 30, slow-burn/endgame = 80)
- Put initial signal text in notes, not column 5

## Final emphasis
- Fit ${book.platform} platform taste and ${gp.name} genre traits
- Protagonist persona clear with sharp behavioral boundaries
- Hooks planted with payoff promises; supporting characters have independent motivation
- **story_frame / volume_map / rhythm_principles / roles must be prose density — no bullet-list degradation**
- **pending_hooks table MUST carry Phase 7 extended columns — depends_on spells out the causal chain, pays_off_in_arc locks the approximate payoff location, core_hook marks main-line load-bearing hooks (3-7 per book), half_life only on priority hooks**`;
  }

  // -------------------------------------------------------------------------
  // Parsing
  // -------------------------------------------------------------------------
  private parseSections(content: string, language: "zh" | "en"): ArchitectOutput {
    const parsedSections = new Map<string, string>();
    const sectionPattern = /^\s*===\s*SECTION\s*[：:]\s*([^\n=]+?)\s*===\s*$/gim;
    const matches = [...content.matchAll(sectionPattern)];

    for (let i = 0; i < matches.length; i++) {
      const match = matches[i]!;
      const rawName = match[1] ?? "";
      const start = (match.index ?? 0) + match[0].length;
      const end = matches[i + 1]?.index ?? content.length;
      const normalizedName = this.normalizeSectionName(rawName);
      parsedSections.set(normalizedName, content.slice(start, end).trim());
    }

    // Phase 5 new sections take precedence.
    const storyFrame = parsedSections.get("story_frame") ?? "";
    const volumeMap = parsedSections.get("volume_map") ?? "";
    const rhythmPrinciples = parsedSections.get("rhythm_principles") ?? "";
    const rolesRaw = parsedSections.get("roles") ?? "";

    // Legacy sections (still produced for back-compat where needed).
    // If the model used old section names we still accept them.
    const legacyStoryBible = parsedSections.get("story_bible") ?? "";
    const legacyVolumeOutline = parsedSections.get("volume_outline") ?? "";
    const bookRules = parsedSections.get("book_rules");
    const currentState = parsedSections.get("current_state");
    const pendingHooksRaw = parsedSections.get("pending_hooks");

    // Book-rules, current-state and pending-hooks are still required.
    if (!bookRules) throw new Error("Architect output missing required section: book_rules");
    if (!currentState) throw new Error("Architect output missing required section: current_state");
    if (!pendingHooksRaw) throw new Error("Architect output missing required section: pending_hooks");

    // At least one of the new prose sections or their legacy equivalents
    // must be present — otherwise the foundation is unusable.
    const effectiveStoryFrame = storyFrame || legacyStoryBible;
    const effectiveVolumeMap = volumeMap || legacyVolumeOutline;
    if (!effectiveStoryFrame) throw new Error("Architect output missing required section: story_frame");
    if (!effectiveVolumeMap) throw new Error("Architect output missing required section: volume_map");

    const roles = this.parseRoles(rolesRaw);
    const pendingHooks = this.normalizePendingHooksSection(
      this.stripTrailingAssistantCoda(pendingHooksRaw),
      effectiveVolumeMap,
    );

    // Synthesize legacy-facing content from new prose (so back-compat callers
    // still receive real content instead of empty strings).
    const storyBible = legacyStoryBible || this.buildStoryBibleShim(effectiveStoryFrame, language);
    const volumeOutline = legacyVolumeOutline || effectiveVolumeMap;

    return {
      storyBible,
      volumeOutline,
      bookRules,
      currentState,
      pendingHooks,
      storyFrame: effectiveStoryFrame,
      volumeMap: effectiveVolumeMap,
      rhythmPrinciples,
      roles,
    };
  }

  /**
   * Parse ---ROLE---...---CONTENT---... blocks from the roles section.
   * Drops malformed entries silently — this is prose the LLM produced,
   * not machine input.
   */
  private parseRoles(raw: string): ReadonlyArray<ArchitectRole> {
    if (!raw.trim()) return [];

    const blocks = raw.split(/^---ROLE---$/m).map((chunk) => chunk.trim()).filter(Boolean);
    const roles: ArchitectRole[] = [];

    for (const block of blocks) {
      const contentSplit = block.split(/^---CONTENT---$/m);
      if (contentSplit.length < 2) continue;

      const headerRaw = contentSplit[0]!.trim();
      const content = contentSplit.slice(1).join("\n---CONTENT---\n").trim();

      const tierMatch = headerRaw.match(/tier\s*[:：]\s*(major|minor|主要|次要)/i);
      const nameMatch = headerRaw.match(/name\s*[:：]\s*(.+)/i);
      if (!tierMatch || !nameMatch) continue;

      const tierValue = tierMatch[1]!.toLowerCase();
      const tier: "major" | "minor" = (tierValue === "major" || tierValue === "主要") ? "major" : "minor";
      const name = nameMatch[1]!.trim();
      if (!name || !content) continue;

      roles.push({ tier, name, content });
    }

    return roles;
  }

  private buildStoryBibleShim(storyFrame: string, language: "zh" | "en"): string {
    if (language === "en") {
      return `# Story Bible (compat pointer — deprecated)\n\n> This file is kept for external readers only. The authoritative source is now:\n> - outline/story_frame.md (theme / tonal ground / core conflict / world rules / endgame)\n> - outline/volume_map.md (chapter-granular plot map)\n> - roles/ directory (one-file-per-character sheets)\n\n## Excerpt from story_frame\n\n${storyFrame.slice(0, 2000)}\n`;
    }
    return `# 故事圣经（兼容指针——已废弃）\n\n> 本文件仅为外部读取保留。权威来源已迁移至：\n> - outline/story_frame.md（主题 / 基调 / 核心冲突 / 世界铁律 / 终局）\n> - outline/volume_map.md（章级别的分卷地图）\n> - roles/ 文件夹（一人一卡角色档案）\n\n## story_frame 摘录\n\n${storyFrame.slice(0, 2000)}\n`;
  }

  private buildCharacterMatrixShim(roles: ReadonlyArray<ArchitectRole>, language: "zh" | "en"): string {
    const majorLines = roles.filter((role) => role.tier === "major")
      .map((role) => `- roles/主要角色/${role.name}.md`);
    const minorLines = roles.filter((role) => role.tier === "minor")
      .map((role) => `- roles/次要角色/${role.name}.md`);

    if (language === "en") {
      return `# Character Matrix (compat pointer — deprecated)\n\n> This file is kept for external readers only. Authoritative source is now the roles/ directory (one-file-per-character).\n\n## Major characters\n\n${majorLines.join("\n") || "(none)"}\n\n## Minor characters\n\n${minorLines.join("\n") || "(none)"}\n`;
    }
    return `# 角色矩阵（兼容指针——已废弃）\n\n> 本文件仅为外部读取保留。权威来源已迁移至 roles/ 文件夹（一人一卡）。\n\n## 主要角色\n\n${majorLines.join("\n") || "（无）"}\n\n## 次要角色\n\n${minorLines.join("\n") || "（无）"}\n`;
  }

  private buildBookRulesShim(bookRulesBody: string, language: "zh" | "en"): string {
    const trimmedBody = bookRulesBody.trim();
    if (language === "en") {
      const excerpt = trimmedBody
        ? `\n\n## Narrative guidance excerpt\n\n${trimmedBody}\n`
        : "";
      return `# Book Rules (compat pointer — deprecated)\n\n> This file is kept for external readers only. The authoritative YAML frontmatter (protagonist / prohibitions / genreLock / ...) now lives at the top of outline/story_frame.md. readBookRules() prefers that location and only falls back here for books initialized before Phase 5 cleanup #3.${excerpt}`;
    }
    const excerpt = trimmedBody
      ? `\n\n## 叙事指引摘录\n\n${trimmedBody}\n`
      : "";
    return `# 本书规则（兼容指针——已废弃）\n\n> 本文件仅为外部读取保留。权威 YAML frontmatter（protagonist / prohibitions / genreLock / ...）已迁移至 outline/story_frame.md 顶部。readBookRules() 优先读那里，只有 Phase 5 cleanup #3 之前的老书才会回退到本文件。${excerpt}`;
  }

  // -------------------------------------------------------------------------
  // File writing
  // -------------------------------------------------------------------------
  async writeFoundationFiles(
    bookDir: string,
    output: ArchitectOutput,
    _numericalSystem: boolean = true,
    language: "zh" | "en" = "zh",
  ): Promise<void> {
    const storyDir = join(bookDir, "story");
    const outlineDir = join(storyDir, "outline");
    const rolesDir = join(storyDir, "roles");
    const rolesMajorDir = join(rolesDir, "主要角色");
    const rolesMinorDir = join(rolesDir, "次要角色");

    await Promise.all([
      mkdir(storyDir, { recursive: true }),
      mkdir(outlineDir, { recursive: true }),
      mkdir(rolesMajorDir, { recursive: true }),
      mkdir(rolesMinorDir, { recursive: true }),
    ]);

    const writes: Array<Promise<void>> = [];

    const storyFrameBody = output.storyFrame ?? output.storyBible;
    const volumeMap = output.volumeMap ?? output.volumeOutline;
    const rhythmPrinciples = output.rhythmPrinciples ?? "";
    const roles = output.roles ?? [];

    // Cleanup #3: book_rules YAML frontmatter is now the authoritative
    // schema for structured fields (protagonist, prohibitions, …). We prepend
    // it to story_frame.md so readers have one canonical place to look.
    // book_rules.md becomes a compat shim.
    const { frontmatter: bookRulesFrontmatter, body: bookRulesBody } =
      extractYamlFrontmatter(output.bookRules);
    const storyFrame = bookRulesFrontmatter
      ? `${bookRulesFrontmatter}\n\n${storyFrameBody.trim()}\n`
      : storyFrameBody;

    // Phase 5 primary prose files
    writes.push(writeFile(join(outlineDir, "story_frame.md"), storyFrame, "utf-8"));
    writes.push(writeFile(join(outlineDir, "volume_map.md"), volumeMap, "utf-8"));
    const rhythmFileName = language === "en" ? "rhythm_principles.md" : "节奏原则.md";
    writes.push(writeFile(join(outlineDir, rhythmFileName), rhythmPrinciples, "utf-8"));

    // Roles — one file per character
    for (const role of roles) {
      const targetDir = role.tier === "major" ? rolesMajorDir : rolesMinorDir;
      const safeName = role.name.replace(/[/\\:*?"<>|]/g, "_").trim();
      if (!safeName) continue;
      writes.push(writeFile(join(targetDir, `${safeName}.md`), role.content, "utf-8"));
    }

    // Compat shims — these are pointer files, not authoritative content.
    writes.push(writeFile(
      join(storyDir, "story_bible.md"),
      this.buildStoryBibleShim(storyFrame, language),
      "utf-8",
    ));
    writes.push(writeFile(
      join(storyDir, "character_matrix.md"),
      this.buildCharacterMatrixShim(roles, language),
      "utf-8",
    ));

    // Cleanup #1: volume_outline.md mirror removed. All readers now resolve
    // through readVolumeMap() in utils/outline-paths.ts, which prefers
    // outline/volume_map.md and falls back to legacy volume_outline.md for
    // books initialized before Phase 5.

    // book_rules.md is now a compat shim — the authoritative YAML
    // frontmatter lives on story_frame.md (cleanup #3). readBookRules()
    // prefers story_frame.md but still falls back here for older books.
    writes.push(writeFile(
      join(storyDir, "book_rules.md"),
      this.buildBookRulesShim(bookRulesBody, language),
      "utf-8",
    ));

    // Runtime state files (untouched by Phase 5)
    writes.push(writeFile(join(storyDir, "current_state.md"), output.currentState, "utf-8"));
    writes.push(writeFile(join(storyDir, "pending_hooks.md"), output.pendingHooks, "utf-8"));
    writes.push(writeFile(
      join(storyDir, "emotional_arcs.md"),
      language === "en"
        ? "# Emotional Arcs\n\n| Character | Chapter | Emotional State | Trigger Event | Intensity (1-10) | Arc Direction |\n| --- | --- | --- | --- | --- | --- |\n"
        : "# 情感弧线\n\n| 角色 | 章节 | 情绪状态 | 触发事件 | 强度(1-10) | 弧线方向 |\n|------|------|----------|----------|------------|----------|\n",
      "utf-8",
    ));

    // Cleanup #2 (Option B): particle_ledger.md / subplot_board.md /
    // chapter_summaries.md are pure runtime logs appended by the writer's
    // settlement phase. The architect no longer seeds them here — mixing a
    // static "setting" seed with a runtime "append log" was the dual-purpose
    // mess that prompted the cleanup. If they don't exist yet, downstream
    // readers see the placeholder and the first chapter settlement creates
    // them naturally. The `_numericalSystem` parameter is kept for API
    // compatibility with existing callers.

    await Promise.all(writes);
  }

  /**
   * Reverse-engineer foundation from existing chapters.
   */
  async generateFoundationFromImport(
    book: BookConfig,
    chaptersText: string,
    externalContext?: string,
    reviewFeedback?: string,
    options?: { readonly importMode?: "continuation" | "series" },
  ): Promise<ArchitectOutput> {
    const { profile: gp, body: genreBody } =
      await readGenreProfile(this.ctx.projectRoot, book.genre);
    const resolvedLanguage = book.language ?? gp.language;
    const reviewFeedbackBlock = this.buildReviewFeedbackBlock(reviewFeedback, resolvedLanguage);

    const contextBlock = externalContext
      ? (resolvedLanguage === "en"
          ? `\n\n## External Instructions\n${externalContext}\n`
          : `\n\n## 外部指令\n${externalContext}\n`)
      : "";

    const numericalBlock = gp.numericalSystem
      ? (resolvedLanguage === "en"
          ? "- The story uses a trackable numerical/resource system"
          : "- 有明确的数值/资源体系可追踪")
      : (resolvedLanguage === "en"
          ? "- No explicit numerical system"
          : "- 本题材无数值系统");

    const isSeries = options?.importMode === "series";

    const continuationDirective = resolvedLanguage === "en"
      ? (isSeries
          ? `## Continuation Direction Requirements
The continuation portion must open up new narrative space — new conflict vector, new location, new time horizon. Ignite within 5 chapters; at least 50% fresh scenes.`
          : `## Continuation Direction
Naturally extend the existing arc. Advance existing conflicts, pay off planted hooks, introduce new complications organically.`)
      : (isSeries
          ? `## 续写方向要求
续写必须引入新叙事空间——新冲突、新地点、新时间。5章内引爆，50%以上场景新鲜。`
          : `## 续写方向
自然延续已有叙事弧线。推进现有冲突、兑现已埋伏笔、引入有机新变数。`);

    const systemPrompt = resolvedLanguage === "en"
      ? `You are a professional novel architect. Reverse-engineer a prose-density foundation from the source chapters and write the continuation path.${contextBlock}${reviewFeedbackBlock}

## Book metadata
- Title: ${book.title}
- Platform: ${book.platform}
- Genre: ${gp.name} (${book.genre})
- Target chapters: ${book.targetChapters}
- Chapter length: ${book.chapterWordCount}

## Genre body
${genreBody}

${numericalBlock}

${continuationDirective}

## Output contract
Follow the same === SECTION: === block layout as original-foundation generation: story_frame, volume_map, rhythm_principles, roles, book_rules, current_state, pending_hooks.

All prose must be derived from the source text. Do not invent settings. For volume_map, treat existing chapters as "review" (one paragraph) and continuation as prose chapter-level planning. Hook extraction must be complete (every unresolved clue).

All output MUST be written in English.`
      : `你是专业的网络小说架构师。从已有章节中反向推导散文密度的基础设定，同时设计续写路径。${contextBlock}${reviewFeedbackBlock}

## 书籍元信息
- 标题：${book.title}
- 平台：${book.platform}
- 题材：${gp.name}（${book.genre}）
- 目标章数：${book.targetChapters}章

## 题材底色
${genreBody}

${numericalBlock}

${continuationDirective}

## 输出契约
与从零架构完全一致的 === SECTION: === 结构：story_frame / volume_map / rhythm_principles / roles / book_rules / current_state / pending_hooks。

所有 prose 必须从正文中推导，不得臆造。volume_map 中，已有章节作为"回顾段"（一段散文），续写部分写到章级 prose。伏笔识别要完整（所有悬而未决的线索）。`;

    const userMessage = resolvedLanguage === "en"
      ? `Generate the complete foundation for an imported ${gp.name} novel titled "${book.title}". Write everything in English.\n\n${chaptersText}`
      : `以下是《${book.title}》的全部已有正文，请从中反向推导完整基础设定：\n\n${chaptersText}`;

    const response = await this.chat([
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ], { maxTokens: 20480, temperature: 0.5 });

    return this.parseSections(response.content, resolvedLanguage);
  }

  async generateFanficFoundation(
    book: BookConfig,
    fanficCanon: string,
    fanficMode: FanficMode,
    reviewFeedback?: string,
  ): Promise<ArchitectOutput> {
    const { profile: gp, body: genreBody } =
      await readGenreProfile(this.ctx.projectRoot, book.genre);
    const reviewFeedbackBlock = this.buildReviewFeedbackBlock(reviewFeedback, book.language ?? "zh");

    const MODE_INSTRUCTIONS: Record<FanficMode, string> = {
      canon: "剧情发生在原作空白期或未详述的角度。不可改变原作已确立的事实。",
      au: "标注AU设定与原作的关键分歧点，分歧后的世界线自由发展。保留角色核心性格。",
      ooc: "标注角色性格偏离的起点和驱动事件。偏离必须有逻辑驱动。",
      cp: "以配对角色的关系线为主线规划卷纲。每卷必须有关系推进节点。",
    };

    const systemPrompt = `你是专业同人架构师。基于原作正典为同人生成散文密度的基础设定。

## 同人模式：${fanficMode}
${MODE_INSTRUCTIONS[fanficMode]}

## 新时空要求
必须为这本同人设计原创叙事空间，不是复述原作剧情：
1. 明确分岔点——story_frame 必须标注本作从原作的哪个节点分岔
2. 独立核心冲突——volume_map 的核心冲突必须是原创的
3. 5章内引爆
4. 场景新鲜度 ≥ 50%
${reviewFeedbackBlock}

## 原作正典
${fanficCanon}

## 题材底色
${genreBody}

## 输出契约
严格按 === SECTION: === 块输出：story_frame / volume_map / rhythm_principles / roles / book_rules / current_state / pending_hooks。

- 主要角色必须来自原作正典
- 可添加原创配角，标注"原创"
- book_rules 的 fanficMode 必须设为 "${fanficMode}"
- 所有 outline 必须是散文密度`;

    const response = await this.chat([
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `请为标题为"${book.title}"的${fanficMode}模式同人小说生成基础设定。目标${book.targetChapters}章，每章${book.chapterWordCount}字。`,
      },
    ], { maxTokens: 20480, temperature: 0.7 });

    return this.parseSections(response.content, book.language ?? "zh");
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------
  private buildReviewFeedbackBlock(
    reviewFeedback: string | undefined,
    language: "zh" | "en",
  ): string {
    const trimmed = reviewFeedback?.trim();
    if (!trimmed) return "";

    if (language === "en") {
      return `\n\n## Previous Review Feedback
The previous foundation draft was rejected. You must explicitly fix the following issues in this regeneration instead of paraphrasing the same design:

${trimmed}\n`;
    }

    return `\n\n## 上一轮审核反馈
上一轮基础设定未通过审核。你必须在这次重生中明确修复以下问题，不能只换措辞重写同一套方案：

${trimmed}\n`;
  }

  private normalizeSectionName(name: string): string {
    return name
      .normalize("NFKC")
      .toLowerCase()
      .replace(/[`"'*_]/g, " ")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  private stripTrailingAssistantCoda(section: string): string {
    const lines = section.split("\n");
    const cutoff = lines.findIndex((line) => {
      const trimmed = line.trim();
      if (!trimmed) return false;
      return /^(如果(?:你愿意|需要|想要|希望)|If (?:you(?:'d)? like|you want|needed)|I can (?:continue|next))/i.test(trimmed);
    });

    if (cutoff < 0) {
      return section;
    }

    return lines.slice(0, cutoff).join("\n").trimEnd();
  }

  private normalizePendingHooksSection(section: string, volumeMapRaw: string): string {
    const rows = section
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.startsWith("|"))
      .filter((line) => !line.includes("---"))
      .map((line) => line.split("|").slice(1, -1).map((cell) => cell.trim()))
      .filter((cells) => cells.some(Boolean));

    if (rows.length === 0) {
      return section;
    }

    const dataRows = rows.filter((row) => (row[0] ?? "").toLowerCase() !== "hook_id");
    if (dataRows.length === 0) {
      return section;
    }

    const language: "zh" | "en" = /[\u4e00-\u9fff]/.test(section) ? "zh" : "en";
    const normalizedHooks = dataRows.map((row, index) => {
      const rawProgress = row[4] ?? "";
      const normalizedProgress = this.parseHookChapterNumber(rawProgress);
      const seedNote = normalizedProgress === 0 && this.hasNarrativeProgress(rawProgress)
        ? (language === "zh" ? `初始线索：${rawProgress}` : `initial signal: ${rawProgress}`)
        : "";

      const phase7 = row.length >= 12;
      const phase6 = row.length >= 8;
      const noteCellIndex = phase7 ? 11 : phase6 ? 7 : 6;
      const notes = this.mergeHookNotes(row[noteCellIndex] ?? "", seedNote, language);

      const base: Record<string, unknown> = {
        hookId: row[0] || `hook-${index + 1}`,
        startChapter: this.parseHookChapterNumber(row[1]),
        type: row[2] ?? "",
        status: row[3] ?? "open",
        lastAdvancedChapter: normalizedProgress,
        expectedPayoff: row[5] ?? "",
        payoffTiming: phase6 ? row[6] ?? "" : "",
        notes,
      };

      if (phase7) {
        base.dependsOn = this.parseDependsOnCell(row[7] ?? "");
        base.paysOffInArc = (row[8] ?? "").trim();
        base.coreHook = this.parseBooleanCell(row[9]);
        const halfLife = this.parseOptionalInt(row[10]);
        if (halfLife !== undefined) base.halfLifeChapters = halfLife;
      }

      return base as unknown as StoredHook;
    });

    // Phase 7 hotfix 2: pre-promote seeds based on the three structural rules
    // that don't need runtime advanced_count (core_hook / depends_on /
    // cross_volume). advanced_count-based promotion is applied later by the
    // consolidator at volume boundaries.
    const volumeBoundaries = this.parseVolumeBoundariesForPromotion(volumeMapRaw);
    const allSeedStartChapters = new Map<string, number>(
      normalizedHooks.map((hook) => [hook.hookId, hook.startChapter]),
    );
    const promotionContext: PromotionContext = {
      volumeBoundaries,
      currentChapter: 0,
      advancedCounts: new Map(),
      allSeedStartChapters,
    };
    const promotedHooks = normalizedHooks.map((hook) => {
      const decision = shouldPromoteHook(hook, promotionContext);
      return { ...hook, promoted: decision.promote };
    });

    return renderHookSnapshot(
      promotedHooks as unknown as Parameters<typeof renderHookSnapshot>[0],
      language,
    );
  }

  /**
   * Parse `第N卷 (A-B章)` / `Volume N (chapters A-B)` headers from the
   * architect's volume_map prose. Best-effort: missing / unparseable blocks
   * return an empty list and cross-volume promotion simply never fires.
   */
  private parseVolumeBoundariesForPromotion(raw: string): ReadonlyArray<VolumeBoundary> {
    if (!raw) return [];
    const lines = raw.split("\n");
    const volumeHeader = /^(第[一二三四五六七八九十百千万零〇\d]+卷|Volume\s+\d+)/i;
    const rangePattern = /[（(]\s*(?:第|[Cc]hapters?\s+)?(\d+)\s*[-–~～—]\s*(\d+)\s*(?:章)?\s*[）)]|(?:第|[Cc]hapters?\s+)(\d+)\s*[-–~～—]\s*(\d+)\s*(?:章)?/i;

    const volumes: VolumeBoundary[] = [];
    for (const rawLine of lines) {
      const line = rawLine.replace(/^#+\s*/, "").trim();
      if (!volumeHeader.test(line)) continue;
      const rangeMatch = line.match(rangePattern);
      if (!rangeMatch) continue;
      const startCh = parseInt(rangeMatch[1] ?? rangeMatch[3] ?? "0", 10);
      const endCh = parseInt(rangeMatch[2] ?? rangeMatch[4] ?? "0", 10);
      if (startCh <= 0 || endCh <= 0) continue;
      const rangeIndex = rangeMatch.index ?? line.length;
      const name = line.slice(0, rangeIndex).replace(/[（(]\s*$/, "").trim();
      if (name.length > 0) {
        volumes.push({ name, startCh, endCh });
      }
    }
    return volumes;
  }

  private parseHookChapterNumber(value: string | undefined): number {
    if (!value) return 0;
    const match = value.match(/\d+/);
    return match ? parseInt(match[0], 10) : 0;
  }

  private parseDependsOnCell(value: string): ReadonlyArray<string> {
    const trimmed = value.trim();
    if (!trimmed) return [];
    const lower = trimmed.toLowerCase();
    if (lower === "none" || lower === "n/a" || lower === "-" || trimmed === "无") return [];
    const stripped = trimmed.replace(/^[\[\(]\s*/, "").replace(/\s*[\]\)]$/, "");
    return stripped
      .split(/[,，、\/]+/)
      .map((item) => item.trim().replace(/^\*\*(.+)\*\*$/, "$1").trim())
      .filter((item) => item.length > 0);
  }

  private parseBooleanCell(value: string | undefined): boolean {
    const normalized = (value ?? "").trim().toLowerCase();
    if (!normalized) return false;
    return /^(true|yes|y|是|核心|core|1|✓|✔)$/.test(normalized);
  }

  private parseOptionalInt(value: string | undefined): number | undefined {
    const normalized = (value ?? "").trim();
    if (!normalized) return undefined;
    const match = normalized.match(/\d+/);
    if (!match) return undefined;
    const parsed = parseInt(match[0], 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
  }

  private hasNarrativeProgress(value: string | undefined): boolean {
    const normalized = (value ?? "").trim().toLowerCase();
    if (!normalized) return false;
    return !["0", "none", "n/a", "na", "-", "无", "未推进"].includes(normalized);
  }

  private mergeHookNotes(notes: string, seedNote: string, language: "zh" | "en"): string {
    const trimmedNotes = notes.trim();
    const trimmedSeed = seedNote.trim();
    if (!trimmedSeed) {
      return trimmedNotes;
    }
    if (!trimmedNotes) {
      return trimmedSeed;
    }
    return language === "zh"
      ? `${trimmedNotes}（${trimmedSeed}）`
      : `${trimmedNotes} (${trimmedSeed})`;
  }
}

import { Command } from "commander";
import { StateManager, analyzeStyle } from "@actalk/inkos-core";
import { findProjectRoot, resolveBookId, log, logError } from "../utils.js";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";

export const styleCommand = new Command("style")
  .description("Style fingerprint analysis and import");

styleCommand
  .command("analyze")
  .description("Analyze a text file and extract style profile")
  .argument("<file>", "Text file to analyze")
  .option("--name <name>", "Source name for the profile")
  .option("--json", "Output JSON only")
  .action(async (file: string, opts) => {
    try {
      const text = await readFile(resolve(file), "utf-8");
      const profile = analyzeStyle(text, opts.name ?? file);

      if (opts.json) {
        log(JSON.stringify(profile, null, 2));
      } else {
        log("Style Profile:");
        log(`  Source: ${profile.sourceName ?? "unknown"}`);
        log(`  Avg sentence length: ${profile.avgSentenceLength} chars`);
        log(`  Sentence length std dev: ${profile.sentenceLengthStdDev}`);
        log(`  Avg paragraph length: ${profile.avgParagraphLength} chars`);
        log(`  Paragraph range: ${profile.paragraphLengthRange.min}-${profile.paragraphLengthRange.max} chars`);
        log(`  Vocabulary diversity (TTR): ${profile.vocabularyDiversity}`);
        if (profile.topPatterns.length > 0) {
          log(`  Top patterns: ${profile.topPatterns.join(", ")}`);
        }
        if (profile.rhetoricalFeatures.length > 0) {
          log(`  Rhetorical features: ${profile.rhetoricalFeatures.join(", ")}`);
        }
      }
    } catch (e) {
      logError(`Analysis failed: ${e}`);
      process.exit(1);
    }
  });

styleCommand
  .command("import")
  .description("Import a style profile into a book")
  .argument("<file>", "Text file to analyze and import")
  .argument("[book-id]", "Book ID (auto-detected if only one book)")
  .option("--name <name>", "Source name for the profile")
  .action(async (file: string, bookIdArg: string | undefined, opts) => {
    try {
      const root = findProjectRoot();
      const bookId = await resolveBookId(bookIdArg, root);
      const state = new StateManager(root);
      const bookDir = state.bookDir(bookId);

      const text = await readFile(resolve(file), "utf-8");
      const profile = analyzeStyle(text, opts.name ?? file);

      const storyDir = join(bookDir, "story");
      await mkdir(storyDir, { recursive: true });
      await writeFile(
        join(storyDir, "style_profile.json"),
        JSON.stringify(profile, null, 2),
        "utf-8",
      );

      log(`Style profile imported to "${bookId}" from "${file}"`);
      log(`  Avg sentence: ${profile.avgSentenceLength} chars, TTR: ${profile.vocabularyDiversity}`);
    } catch (e) {
      logError(`Import failed: ${e}`);
      process.exit(1);
    }
  });

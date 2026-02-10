import { Command } from "commander";
import { readFile, writeFile, access } from "node:fs/promises";
import { join } from "node:path";
import chalk from "chalk";
import { outputJson, outputJsonError } from "../utils/json-output.js";

const SNIPPET_DEFAULT = `## Project Expertise (Mulch)

This project uses [Mulch](https://github.com/jayminwest/mulch) for structured expertise management.

**At the start of every session**, run:
\`\`\`bash
mulch prime
\`\`\`

This injects project-specific conventions, patterns, decisions, and other learnings into your context.

**Before completing your task**, review your work for insights worth preserving — conventions discovered,
patterns applied, failures encountered, or decisions made — and record them:
\`\`\`bash
mulch record <domain> --type <convention|pattern|failure|decision|reference|guide> --description "..."
\`\`\`

Run \`mulch status\` to check domain health and entry counts.
Run \`mulch --help\` for full usage.

### Before You Finish

1. Store insights from this work session:
   \`\`\`bash
   mulch record <domain> --type <convention|pattern|failure|decision|reference|guide> --description "..."
   \`\`\`
2. Validate and commit:
   \`\`\`bash
   mulch validate && git add .mulch/ && git commit -m "mulch: record learnings"
   \`\`\`
`;

function getSnippet(provider: string | undefined): string {
  if (!provider || provider === "default") {
    return SNIPPET_DEFAULT;
  }

  // All providers use the same standardized snippet
  return SNIPPET_DEFAULT;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function detectTargetFile(cwd: string): Promise<string> {
  // If CLAUDE.md exists, prefer it
  if (await fileExists(join(cwd, "CLAUDE.md"))) {
    return "CLAUDE.md";
  }
  // Otherwise default to AGENTS.md
  return "AGENTS.md";
}

export async function runOnboard(options: {
  stdout?: boolean;
  provider?: string;
  cwd?: string;
  jsonMode?: boolean;
}): Promise<void> {
  const cwd = options.cwd ?? process.cwd();
  const snippet = getSnippet(options.provider);

  if (options.stdout) {
    process.stdout.write(snippet);
    return;
  }

  const targetFileName = await detectTargetFile(cwd);
  const targetPath = join(cwd, targetFileName);

  // Check if snippet is already present
  if (await fileExists(targetPath)) {
    const existing = await readFile(targetPath, "utf-8");
    if (existing.includes("## Project Expertise (Mulch)")) {
      if (options.jsonMode) {
        outputJson({
          success: true,
          command: "onboard",
          file: targetFileName,
          action: "already_present",
        });
      } else {
        console.log(
          chalk.yellow(`Mulch snippet already exists in ${targetFileName}. No changes made.`),
        );
      }
      return;
    }
    // Append to existing file
    await writeFile(targetPath, existing + "\n" + snippet, "utf-8");
  } else {
    // Create new file
    await writeFile(targetPath, snippet, "utf-8");
  }

  if (options.jsonMode) {
    outputJson({
      success: true,
      command: "onboard",
      file: targetFileName,
      action: await fileExists(targetPath) ? "appended" : "created",
    });
  } else {
    console.log(chalk.green(`Mulch onboarding snippet written to ${targetFileName}`));
  }
}

export function registerOnboardCommand(program: Command): void {
  program
    .command("onboard")
    .description(
      "Generate an AGENTS.md/CLAUDE.md snippet pointing to mulch prime",
    )
    .option("--stdout", "print snippet to stdout instead of writing to file")
    .option(
      "--provider <provider>",
      "customize snippet for a specific provider (e.g. claude)",
    )
    .action(async (options: { stdout?: boolean; provider?: string }) => {
      const jsonMode = program.opts().json === true;
      try {
        await runOnboard({ ...options, jsonMode });
      } catch (err) {
        if (jsonMode) {
          outputJsonError("onboard", (err as Error).message);
        } else {
          console.error(`Error: ${(err as Error).message}`);
        }
        process.exitCode = 1;
      }
    });
}

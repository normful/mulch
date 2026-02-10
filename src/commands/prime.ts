import { writeFile } from "node:fs/promises";
import { Command, Option } from "commander";
import chalk from "chalk";
import { readConfig, getExpertisePath } from "../utils/config.js";
import { readExpertiseFile, getFileModTime } from "../utils/expertise.js";
import {
  formatDomainExpertise,
  formatPrimeOutput,
  formatDomainExpertiseXml,
  formatPrimeOutputXml,
  formatDomainExpertisePlain,
  formatPrimeOutputPlain,
  formatDomainExpertiseCompact,
  formatPrimeOutputCompact,
  formatMcpOutput,
} from "../utils/format.js";
import type { McpDomain, PrimeFormat } from "../utils/format.js";
import { outputJsonError } from "../utils/json-output.js";
import { isGitRepo, getChangedFiles, filterByContext } from "../utils/git.js";

interface PrimeOptions {
  full?: boolean;
  verbose?: boolean;
  mcp?: boolean;
  format?: PrimeFormat;
  export?: string;
  domain?: string[];
  context?: boolean;
}

export function registerPrimeCommand(program: Command): void {
  program
    .command("prime")
    .description("Generate a priming prompt from expertise records")
    .argument("[domains...]", "optional domain(s) to scope output to")
    .option("--full", "include full record details (classification, evidence)")
    .option("-v, --verbose", "full output with section headers and recording instructions")
    .option("--mcp", "output in MCP-compatible JSON format")
    .option("--domain <domains...>", "domain(s) to include")
    .addOption(
      new Option("--format <format>", "output format")
        .choices(["markdown", "xml", "plain"])
        .default("markdown"),
    )
    .option("--context", "filter records to only those relevant to changed files")
    .option("--export <path>", "export output to a file")
    .action(async (domainsArg: string[], options: PrimeOptions) => {
      const jsonMode = program.opts().json === true;
      try {
        const config = await readConfig();
        const format = options.format ?? "markdown";

        const requested = [...domainsArg, ...(options.domain ?? [])];
        const unique = [...new Set(requested)];

        for (const d of unique) {
          if (!config.domains.includes(d)) {
            if (jsonMode) {
              outputJsonError("prime", `Domain "${d}" not found in config. Available domains: ${config.domains.join(", ")}`);
            } else {
              console.error(
                `Error: Domain "${d}" not found in config. Available domains: ${config.domains.join(", ")}`,
              );
            }
            process.exitCode = 1;
            return;
          }
        }

        const targetDomains = unique.length > 0
          ? unique
          : config.domains;

        // Resolve changed files for --context filtering
        let changedFiles: string[] | undefined;
        if (options.context) {
          const cwd = process.cwd();
          if (!isGitRepo(cwd)) {
            const msg = "Not in a git repository. --context requires git.";
            if (jsonMode) {
              outputJsonError("prime", msg);
            } else {
              console.error(`Error: ${msg}`);
            }
            process.exitCode = 1;
            return;
          }
          changedFiles = getChangedFiles(cwd, "HEAD~1");
          if (changedFiles.length === 0) {
            if (jsonMode) {
              outputJsonError("prime", "No changed files found. Nothing to filter by.");
            } else {
              console.log("No changed files found. Nothing to filter by.");
            }
            return;
          }
        }

        let output: string;

        if (options.mcp || jsonMode) {
          // --json and --mcp produce the same structured output
          const domains: McpDomain[] = [];
          for (const domain of targetDomains) {
            const filePath = getExpertisePath(domain);
            let records = await readExpertiseFile(filePath);
            if (changedFiles) {
              records = filterByContext(records, changedFiles);
            }
            if (!changedFiles || records.length > 0) {
              domains.push({ domain, entry_count: records.length, records });
            }
          }
          output = formatMcpOutput(domains);
        } else {
          const domainSections: string[] = [];
          for (const domain of targetDomains) {
            const filePath = getExpertisePath(domain);
            let records = await readExpertiseFile(filePath);
            if (changedFiles) {
              records = filterByContext(records, changedFiles);
              if (records.length === 0) continue;
            }
            const lastUpdated = await getFileModTime(filePath);

            if (options.verbose || format !== "markdown") {
              switch (format) {
                case "xml":
                  domainSections.push(
                    formatDomainExpertiseXml(domain, records, lastUpdated),
                  );
                  break;
                case "plain":
                  domainSections.push(
                    formatDomainExpertisePlain(domain, records, lastUpdated),
                  );
                  break;
                default:
                  domainSections.push(
                    formatDomainExpertise(domain, records, lastUpdated, {
                      full: options.full,
                    }),
                  );
                  break;
              }
            } else {
              domainSections.push(
                formatDomainExpertiseCompact(domain, records, lastUpdated),
              );
            }
          }

          if (options.verbose || format !== "markdown") {
            switch (format) {
              case "xml":
                output = formatPrimeOutputXml(domainSections);
                break;
              case "plain":
                output = formatPrimeOutputPlain(domainSections);
                break;
              default:
                output = formatPrimeOutput(domainSections);
                break;
            }
          } else {
            output = formatPrimeOutputCompact(domainSections);
          }
        }

        if (options.export) {
          await writeFile(options.export, output + "\n", "utf-8");
          if (!jsonMode) {
            console.log(chalk.green(`Exported to ${options.export}`));
          }
        } else {
          console.log(output);
        }
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") {
          if (jsonMode) {
            outputJsonError("prime", "No .mulch/ directory found. Run `mulch init` first.");
          } else {
            console.error("Error: No .mulch/ directory found. Run `mulch init` first.");
          }
        } else {
          if (jsonMode) {
            outputJsonError("prime", (err as Error).message);
          } else {
            console.error(`Error: ${(err as Error).message}`);
          }
        }
        process.exitCode = 1;
      }
    });
}

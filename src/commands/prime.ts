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
  formatMcpOutput,
} from "../utils/format.js";
import type { McpDomain, PrimeFormat } from "../utils/format.js";

interface PrimeOptions {
  full?: boolean;
  mcp?: boolean;
  format?: PrimeFormat;
  export?: string;
}

export function registerPrimeCommand(program: Command): void {
  program
    .command("prime")
    .description("Generate a priming prompt from expertise records")
    .option("--full", "include full record details (classification, evidence)")
    .option("--mcp", "output in MCP-compatible JSON format")
    .addOption(
      new Option("--format <format>", "output format")
        .choices(["markdown", "xml", "plain"])
        .default("markdown"),
    )
    .option("--export <path>", "export output to a file")
    .action(async (options: PrimeOptions) => {
      try {
        const config = await readConfig();
        const format = options.format ?? "markdown";

        let output: string;

        if (options.mcp) {
          const domains: McpDomain[] = [];
          for (const domain of config.domains) {
            const filePath = getExpertisePath(domain);
            const records = await readExpertiseFile(filePath);
            domains.push({ domain, entry_count: records.length, records });
          }
          output = formatMcpOutput(domains);
        } else {
          const domainSections: string[] = [];
          for (const domain of config.domains) {
            const filePath = getExpertisePath(domain);
            const records = await readExpertiseFile(filePath);
            const lastUpdated = await getFileModTime(filePath);

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
          }

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
        }

        if (options.export) {
          await writeFile(options.export, output + "\n", "utf-8");
          console.log(chalk.green(`Exported to ${options.export}`));
        } else {
          console.log(output);
        }
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") {
          console.error("Error: No .mulch/ directory found. Run `mulch init` first.");
        } else {
          console.error(`Error: ${(err as Error).message}`);
        }
        process.exitCode = 1;
      }
    });
}

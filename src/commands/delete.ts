import { Command } from "commander";
import chalk from "chalk";
import { readConfig, getExpertisePath } from "../utils/config.js";
import {
  readExpertiseFile,
  writeExpertiseFile,
} from "../utils/expertise.js";
import { getRecordSummary } from "../utils/format.js";
import { outputJson, outputJsonError } from "../utils/json-output.js";

export function registerDeleteCommand(program: Command): void {
  program
    .command("delete")
    .argument("<domain>", "expertise domain")
    .argument("<identifier>", "record ID (mx-XXXXXX) or 1-based index")
    .description("Delete an expertise record")
    .action(
      async (domain: string, identifier: string) => {
        const jsonMode = program.opts().json === true;
        try {
          const config = await readConfig();

          if (!config.domains.includes(domain)) {
            if (jsonMode) {
              outputJsonError("delete", `Domain "${domain}" not found in config. Available domains: ${config.domains.join(", ") || "(none)"}`);
            } else {
              console.error(
                chalk.red(`Error: domain "${domain}" not found in config.`),
              );
              console.error(
                chalk.red(
                  `Available domains: ${config.domains.join(", ") || "(none)"}`,
                ),
              );
            }
            process.exitCode = 1;
            return;
          }

          const filePath = getExpertisePath(domain);
          const records = await readExpertiseFile(filePath);

          let targetIndex: number;

          if (identifier.startsWith("mx-")) {
            // ID-based lookup
            const found = records.findIndex((r) => r.id === identifier);
            if (found === -1) {
              if (jsonMode) {
                outputJsonError("delete", `Record with ID "${identifier}" not found in domain "${domain}".`);
              } else {
                console.error(
                  chalk.red(`Error: record with ID "${identifier}" not found in domain "${domain}".`),
                );
              }
              process.exitCode = 1;
              return;
            }
            targetIndex = found;
          } else {
            // Legacy 1-based index
            const index = parseInt(identifier, 10);
            if (isNaN(index) || index < 1) {
              if (jsonMode) {
                outputJsonError("delete", "Identifier must be a record ID (mx-XXXXXX) or a positive integer (1-based index).");
              } else {
                console.error(
                  chalk.red("Error: identifier must be a record ID (mx-XXXXXX) or a positive integer (1-based index)."),
                );
              }
              process.exitCode = 1;
              return;
            }
            if (index > records.length) {
              if (jsonMode) {
                outputJsonError("delete", `Index ${index} out of range. Domain "${domain}" has ${records.length} record(s).`);
              } else {
                console.error(
                  chalk.red(
                    `Error: index ${index} out of range. Domain "${domain}" has ${records.length} record(s).`,
                  ),
                );
              }
              process.exitCode = 1;
              return;
            }
            targetIndex = index - 1;
          }

          const deleted = records[targetIndex];
          records.splice(targetIndex, 1);
          await writeExpertiseFile(filePath, records);

          if (jsonMode) {
            outputJson({
              success: true,
              command: "delete",
              domain,
              id: deleted.id ?? null,
              index: targetIndex + 1,
              type: deleted.type,
              summary: getRecordSummary(deleted),
            });
          } else {
            const idLabel = deleted.id ? ` (${deleted.id})` : "";
            console.log(
              chalk.green(
                `✔ Deleted ${deleted.type} #${targetIndex + 1}${idLabel} from ${domain}: ${getRecordSummary(deleted)}`,
              ),
            );
          }
        } catch (err) {
          if ((err as NodeJS.ErrnoException).code === "ENOENT") {
            if (jsonMode) {
              outputJsonError("delete", "No .mulch/ directory found. Run `mulch init` first.");
            } else {
              console.error(
                "Error: No .mulch/ directory found. Run `mulch init` first.",
              );
            }
          } else {
            if (jsonMode) {
              outputJsonError("delete", (err as Error).message);
            } else {
              console.error(`Error: ${(err as Error).message}`);
            }
          }
          process.exitCode = 1;
        }
      },
    );
}

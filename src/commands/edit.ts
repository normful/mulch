import { Command, Option } from "commander";
import _Ajv from "ajv";
const Ajv = _Ajv.default ?? _Ajv;
import chalk from "chalk";
import { readConfig, getExpertisePath } from "../utils/config.js";
import {
  readExpertiseFile,
  writeExpertiseFile,
} from "../utils/expertise.js";
import { recordSchema } from "../schemas/record-schema.js";
import type { Classification } from "../schemas/record.js";

export function registerEditCommand(program: Command): void {
  program
    .command("edit")
    .argument("<domain>", "expertise domain")
    .argument("<index>", "1-based record index")
    .description("Edit an existing expertise record")
    .addOption(
      new Option(
        "--classification <classification>",
        "update classification",
      ).choices(["foundational", "tactical", "observational"]),
    )
    .option("--content <content>", "update content (convention)")
    .option("--name <name>", "update name (pattern)")
    .option("--description <description>", "update description")
    .option("--resolution <resolution>", "update resolution (failure)")
    .option("--title <title>", "update title (decision)")
    .option("--rationale <rationale>", "update rationale (decision)")
    .option("--files <files>", "update related files (comma-separated)")
    .action(
      async (
        domain: string,
        indexStr: string,
        options: Record<string, unknown>,
      ) => {
        try {
          const config = await readConfig();

          if (!config.domains.includes(domain)) {
            console.error(
              chalk.red(`Error: domain "${domain}" not found in config.`),
            );
            console.error(
              chalk.red(
                `Available domains: ${config.domains.join(", ") || "(none)"}`,
              ),
            );
            process.exitCode = 1;
            return;
          }

          const index = parseInt(indexStr, 10);
          if (isNaN(index) || index < 1) {
            console.error(
              chalk.red("Error: index must be a positive integer (1-based)."),
            );
            process.exitCode = 1;
            return;
          }

          const filePath = getExpertisePath(domain);
          const records = await readExpertiseFile(filePath);

          if (index > records.length) {
            console.error(
              chalk.red(
                `Error: index ${index} out of range. Domain "${domain}" has ${records.length} record(s).`,
              ),
            );
            process.exitCode = 1;
            return;
          }

          const record = { ...records[index - 1] };

          // Apply updates based on record type
          if (options.classification) {
            record.classification = options.classification as Classification;
          }

          switch (record.type) {
            case "convention":
              if (options.content) {
                record.content = options.content as string;
              }
              break;
            case "pattern":
              if (options.name) {
                record.name = options.name as string;
              }
              if (options.description) {
                record.description = options.description as string;
              }
              if (typeof options.files === "string") {
                record.files = (options.files as string).split(",");
              }
              break;
            case "failure":
              if (options.description) {
                record.description = options.description as string;
              }
              if (options.resolution) {
                record.resolution = options.resolution as string;
              }
              break;
            case "decision":
              if (options.title) {
                record.title = options.title as string;
              }
              if (options.rationale) {
                record.rationale = options.rationale as string;
              }
              break;
            case "reference":
              if (options.name) {
                record.name = options.name as string;
              }
              if (options.description) {
                record.description = options.description as string;
              }
              if (typeof options.files === "string") {
                record.files = (options.files as string).split(",");
              }
              break;
            case "guide":
              if (options.name) {
                record.name = options.name as string;
              }
              if (options.description) {
                record.description = options.description as string;
              }
              break;
          }

          // Validate the updated record
          const ajv = new Ajv();
          const validate = ajv.compile(recordSchema);
          if (!validate(record)) {
            console.error(
              chalk.red("Error: updated record failed schema validation:"),
            );
            for (const err of validate.errors ?? []) {
              console.error(
                chalk.red(`  ${err.instancePath} ${err.message}`),
              );
            }
            process.exitCode = 1;
            return;
          }

          records[index - 1] = record;
          await writeExpertiseFile(filePath, records);

          console.log(
            chalk.green(
              `\u2714 Updated ${record.type} #${index} in ${domain}`,
            ),
          );
        } catch (err) {
          if ((err as NodeJS.ErrnoException).code === "ENOENT") {
            console.error(
              "Error: No .mulch/ directory found. Run `mulch init` first.",
            );
          } else {
            console.error(`Error: ${(err as Error).message}`);
          }
          process.exitCode = 1;
        }
      },
    );
}

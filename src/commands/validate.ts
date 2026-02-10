import { Command } from "commander";
import { readFile } from "node:fs/promises";
import _Ajv from "ajv";
const Ajv = _Ajv.default ?? _Ajv;
import chalk from "chalk";
import { readConfig, getExpertisePath } from "../utils/config.js";
import { recordSchema } from "../schemas/record-schema.js";
import { outputJson, outputJsonError } from "../utils/json-output.js";

export function registerValidateCommand(program: Command): void {
  program
    .command("validate")
    .description("Validate expertise records against schemas")
    .action(async () => {
      const jsonMode = program.opts().json === true;
      const config = await readConfig();
      const domains = config.domains;

      const ajv = new Ajv();
      const validate = ajv.compile(recordSchema);

      let totalRecords = 0;
      let totalErrors = 0;
      const errors: Array<{ domain: string; line: number; message: string }> = [];

      for (const domain of domains) {
        const filePath = getExpertisePath(domain);
        let content: string;
        try {
          content = await readFile(filePath, "utf-8");
        } catch {
          // File doesn't exist yet, skip
          continue;
        }

        const lines = content.split("\n");
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          if (line.length === 0) continue;

          totalRecords++;
          const lineNumber = i + 1;

          let parsed: unknown;
          try {
            parsed = JSON.parse(line);
          } catch {
            totalErrors++;
            const msg = "Invalid JSON: failed to parse";
            errors.push({ domain, line: lineNumber, message: msg });
            if (!jsonMode) {
              console.error(
                chalk.red(`${domain}:${lineNumber} - ${msg}`),
              );
            }
            continue;
          }

          if (!validate(parsed)) {
            totalErrors++;
            const schemaErrors = (validate.errors ?? []).map((err) => `${err.instancePath} ${err.message}`).join("; ");
            const msg = `Schema validation failed: ${schemaErrors}`;
            errors.push({ domain, line: lineNumber, message: msg });
            if (!jsonMode) {
              console.error(
                chalk.red(`${domain}:${lineNumber} - Schema validation failed:`),
              );
              for (const err of validate.errors ?? []) {
                console.error(
                  chalk.red(`  ${err.instancePath} ${err.message}`),
                );
              }
            }
          }
        }
      }

      if (jsonMode) {
        outputJson({
          success: totalErrors === 0,
          command: "validate",
          valid: totalErrors === 0,
          totalRecords,
          totalErrors,
          errors,
        });
      } else if (totalErrors > 0) {
        console.log(
          chalk.red(
            `${totalRecords} records validated, ${totalErrors} errors found`,
          ),
        );
      } else {
        console.log(
          chalk.green(
            `${totalRecords} records validated, ${totalErrors} errors found`,
          ),
        );
      }

      if (totalErrors > 0) {
        process.exitCode = 1;
      }
    });
}

import { existsSync } from "node:fs";
import { Command } from "commander";
import chalk from "chalk";
import { getMulchDir, initMulchDir } from "../utils/config.js";

export function registerInitCommand(program: Command): void {
  program
    .command("init")
    .description("Initialize .mulch/ in the current project")
    .action(async () => {
      const mulchDir = getMulchDir();
      const alreadyExists = existsSync(mulchDir);

      await initMulchDir();

      if (alreadyExists) {
        console.log(
          chalk.green("Updated .mulch/ — filled in any missing artifacts."),
        );
      } else {
        console.log(chalk.green(`Initialized .mulch/ in ${process.cwd()}`));
      }
    });
}

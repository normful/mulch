import { Command, Option } from "commander";
import { readConfig, getExpertisePath } from "../utils/config.js";
import { readExpertiseFile, getFileModTime, filterByType } from "../utils/expertise.js";
import { searchRecords } from "../utils/expertise.js";
import { formatDomainExpertise } from "../utils/format.js";

export function registerSearchCommand(program: Command): void {
  program
    .command("search")
    .argument("<query>", "search string (case-insensitive substring match)")
    .description("Search expertise records across domains")
    .option("--domain <domain>", "limit search to a specific domain")
    .addOption(
      new Option("--type <type>", "filter by record type").choices([
        "convention",
        "pattern",
        "failure",
        "decision",
      ]),
    )
    .action(
      async (
        query: string,
        options: { domain?: string; type?: string },
      ) => {
        try {
          const config = await readConfig();

          let domainsToSearch: string[];

          if (options.domain) {
            if (!config.domains.includes(options.domain)) {
              console.error(
                `Error: Domain "${options.domain}" not found in config. Available domains: ${config.domains.join(", ")}`,
              );
              process.exitCode = 1;
              return;
            }
            domainsToSearch = [options.domain];
          } else {
            domainsToSearch = config.domains;
          }

          const sections: string[] = [];
          let totalMatches = 0;

          for (const domain of domainsToSearch) {
            const filePath = getExpertisePath(domain);
            let records = await readExpertiseFile(filePath);
            const lastUpdated = await getFileModTime(filePath);

            if (options.type) {
              records = filterByType(records, options.type);
            }

            const matches = searchRecords(records, query);
            if (matches.length > 0) {
              totalMatches += matches.length;
              sections.push(
                formatDomainExpertise(domain, matches, lastUpdated),
              );
            }
          }

          if (sections.length === 0) {
            console.log(`No records matching "${query}" found.`);
          } else {
            console.log(sections.join("\n\n"));
            console.log(`\n${totalMatches} match${totalMatches === 1 ? "" : "es"} found.`);
          }
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

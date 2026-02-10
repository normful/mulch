import { Command } from "commander";
import chalk from "chalk";
import { readConfig, getExpertisePath } from "../utils/config.js";
import {
  readExpertiseFile,
  writeExpertiseFile,
  generateRecordId,
} from "../utils/expertise.js";
import { recordSchema } from "../schemas/record-schema.js";
import type {
  ExpertiseRecord,
  RecordType,
} from "../schemas/record.js";
import { outputJson, outputJsonError } from "../utils/json-output.js";
import { getRecordSummary } from "../utils/format.js";
import _Ajv from "ajv";
const Ajv = _Ajv.default ?? _Ajv;

interface CompactCandidate {
  domain: string;
  type: RecordType;
  records: Array<{ index: number; id: string | undefined; summary: string; recorded_at: string }>;
}

function findCandidates(
  domain: string,
  records: ExpertiseRecord[],
  now: Date,
  shelfLife: { tactical: number; observational: number },
): CompactCandidate[] {
  // Group records by type
  const byType = new Map<RecordType, Array<{ index: number; record: ExpertiseRecord }>>();
  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    if (!byType.has(r.type)) {
      byType.set(r.type, []);
    }
    byType.get(r.type)!.push({ index: i + 1, record: r });
  }

  const candidates: CompactCandidate[] = [];

  for (const [type, group] of byType) {
    if (group.length < 2) continue;

    // Include groups where at least one record is stale or the group is large (3+)
    const hasStale = group.some((g) => {
      if (g.record.classification === "foundational") return false;
      const ageMs = now.getTime() - new Date(g.record.recorded_at).getTime();
      const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
      if (g.record.classification === "tactical") return ageDays > shelfLife.tactical;
      if (g.record.classification === "observational") return ageDays > shelfLife.observational;
      return false;
    });

    if (hasStale || group.length >= 3) {
      candidates.push({
        domain,
        type,
        records: group.map((g) => ({
          index: g.index,
          id: g.record.id,
          summary: getRecordSummary(g.record),
          recorded_at: g.record.recorded_at,
        })),
      });
    }
  }

  return candidates;
}

function resolveRecordIndices(
  records: ExpertiseRecord[],
  identifiers: string[],
): number[] {
  const indices: number[] = [];
  for (const id of identifiers) {
    if (id.startsWith("mx-")) {
      const found = records.findIndex((r) => r.id === id);
      if (found === -1) {
        throw new Error(`Record with ID "${id}" not found.`);
      }
      indices.push(found);
    } else {
      const idx = parseInt(id, 10);
      if (isNaN(idx) || idx < 1 || idx > records.length) {
        throw new Error(`Invalid index "${id}". Must be 1-${records.length}.`);
      }
      indices.push(idx - 1);
    }
  }
  return indices;
}

export function registerCompactCommand(program: Command): void {
  program
    .command("compact")
    .argument("[domain]", "expertise domain (required for --apply)")
    .description("Compact records: analyze candidates or apply a compaction")
    .option("--analyze", "show compaction candidates")
    .option("--apply", "apply a compaction (replace records with summary)")
    .option("--records <ids>", "comma-separated record IDs or indices to compact")
    .option("--type <type>", "record type for the replacement")
    .option("--name <name>", "name for replacement (pattern/reference/guide)")
    .option("--title <title>", "title for replacement (decision)")
    .option("--description <description>", "description for replacement")
    .option("--content <content>", "content for replacement (convention)")
    .option("--resolution <resolution>", "resolution for replacement (failure)")
    .option("--rationale <rationale>", "rationale for replacement (decision)")
    .action(
      async (
        domain: string | undefined,
        options: Record<string, unknown>,
      ) => {
        const jsonMode = program.opts().json === true;

        if (options.analyze) {
          await handleAnalyze(jsonMode);
        } else if (options.apply) {
          if (!domain) {
            const msg = "Domain is required for --apply.";
            if (jsonMode) {
              outputJsonError("compact", msg);
            } else {
              console.error(chalk.red(`Error: ${msg}`));
            }
            process.exitCode = 1;
            return;
          }
          await handleApply(domain, options, jsonMode);
        } else {
          const msg = "Specify --analyze or --apply.";
          if (jsonMode) {
            outputJsonError("compact", msg);
          } else {
            console.error(chalk.red(`Error: ${msg}`));
          }
          process.exitCode = 1;
        }
      },
    );
}

async function handleAnalyze(jsonMode: boolean): Promise<void> {
  const config = await readConfig();
  const now = new Date();
  const shelfLife = config.classification_defaults.shelf_life;
  const allCandidates: CompactCandidate[] = [];

  for (const domain of config.domains) {
    const filePath = getExpertisePath(domain);
    const records = await readExpertiseFile(filePath);
    if (records.length < 2) continue;
    const candidates = findCandidates(domain, records, now, shelfLife);
    allCandidates.push(...candidates);
  }

  if (jsonMode) {
    outputJson({
      success: true,
      command: "compact",
      action: "analyze",
      candidates: allCandidates,
    });
    return;
  }

  if (allCandidates.length === 0) {
    console.log(chalk.green("No compaction candidates found."));
    return;
  }

  console.log(chalk.bold("Compaction candidates:\n"));
  for (const c of allCandidates) {
    console.log(chalk.cyan(`${c.domain}/${c.type}`) + ` (${c.records.length} records)`);
    for (const r of c.records) {
      const idLabel = r.id ? ` ${r.id}` : "";
      console.log(`  #${r.index}${idLabel}: ${r.summary}`);
    }
    console.log();
  }

  console.log(
    chalk.dim("To compact, run: mulch compact <domain> --apply --records <ids> --type <type> [fields...]"),
  );
}

async function handleApply(
  domain: string,
  options: Record<string, unknown>,
  jsonMode: boolean,
): Promise<void> {
  const config = await readConfig();

  if (!config.domains.includes(domain)) {
    const msg = `Domain "${domain}" not found in config.`;
    if (jsonMode) {
      outputJsonError("compact", msg);
    } else {
      console.error(chalk.red(`Error: ${msg}`));
    }
    process.exitCode = 1;
    return;
  }

  if (typeof options.records !== "string") {
    const msg = "--records is required for --apply.";
    if (jsonMode) {
      outputJsonError("compact", msg);
    } else {
      console.error(chalk.red(`Error: ${msg}`));
    }
    process.exitCode = 1;
    return;
  }

  const filePath = getExpertisePath(domain);
  const records = await readExpertiseFile(filePath);
  const identifiers = (options.records as string).split(",").map((s) => s.trim()).filter(Boolean);

  let indicesToRemove: number[];
  try {
    indicesToRemove = resolveRecordIndices(records, identifiers);
  } catch (err) {
    const msg = (err as Error).message;
    if (jsonMode) {
      outputJsonError("compact", msg);
    } else {
      console.error(chalk.red(`Error: ${msg}`));
    }
    process.exitCode = 1;
    return;
  }

  if (indicesToRemove.length < 2) {
    const msg = "Compaction requires at least 2 records.";
    if (jsonMode) {
      outputJsonError("compact", msg);
    } else {
      console.error(chalk.red(`Error: ${msg}`));
    }
    process.exitCode = 1;
    return;
  }

  // Build replacement record
  const recordType = (options.type as RecordType | undefined) ?? records[indicesToRemove[0]].type;
  const recordedAt = new Date().toISOString();
  const compactedFrom = indicesToRemove.map((i) => records[i].id).filter(Boolean) as string[];

  let replacement: ExpertiseRecord;

  switch (recordType) {
    case "convention": {
      const content = (options.content as string | undefined) ?? (options.description as string | undefined);
      if (!content) {
        const msg = "Replacement convention requires --content or --description.";
        if (jsonMode) { outputJsonError("compact", msg); } else { console.error(chalk.red(`Error: ${msg}`)); }
        process.exitCode = 1;
        return;
      }
      replacement = { type: "convention", content, classification: "foundational", recorded_at: recordedAt };
      break;
    }
    case "pattern": {
      const name = options.name as string | undefined;
      const description = options.description as string | undefined;
      if (!name || !description) {
        const msg = "Replacement pattern requires --name and --description.";
        if (jsonMode) { outputJsonError("compact", msg); } else { console.error(chalk.red(`Error: ${msg}`)); }
        process.exitCode = 1;
        return;
      }
      replacement = { type: "pattern", name, description, classification: "foundational", recorded_at: recordedAt };
      break;
    }
    case "failure": {
      const description = options.description as string | undefined;
      const resolution = options.resolution as string | undefined;
      if (!description || !resolution) {
        const msg = "Replacement failure requires --description and --resolution.";
        if (jsonMode) { outputJsonError("compact", msg); } else { console.error(chalk.red(`Error: ${msg}`)); }
        process.exitCode = 1;
        return;
      }
      replacement = { type: "failure", description, resolution, classification: "foundational", recorded_at: recordedAt };
      break;
    }
    case "decision": {
      const title = options.title as string | undefined;
      const rationale = options.rationale as string | undefined;
      if (!title || !rationale) {
        const msg = "Replacement decision requires --title and --rationale.";
        if (jsonMode) { outputJsonError("compact", msg); } else { console.error(chalk.red(`Error: ${msg}`)); }
        process.exitCode = 1;
        return;
      }
      replacement = { type: "decision", title, rationale, classification: "foundational", recorded_at: recordedAt };
      break;
    }
    case "reference": {
      const name = options.name as string | undefined;
      const description = options.description as string | undefined;
      if (!name || !description) {
        const msg = "Replacement reference requires --name and --description.";
        if (jsonMode) { outputJsonError("compact", msg); } else { console.error(chalk.red(`Error: ${msg}`)); }
        process.exitCode = 1;
        return;
      }
      replacement = { type: "reference", name, description, classification: "foundational", recorded_at: recordedAt };
      break;
    }
    case "guide": {
      const name = options.name as string | undefined;
      const description = options.description as string | undefined;
      if (!name || !description) {
        const msg = "Replacement guide requires --name and --description.";
        if (jsonMode) { outputJsonError("compact", msg); } else { console.error(chalk.red(`Error: ${msg}`)); }
        process.exitCode = 1;
        return;
      }
      replacement = { type: "guide", name, description, classification: "foundational", recorded_at: recordedAt };
      break;
    }
    default: {
      const msg = `Unknown record type "${recordType}".`;
      if (jsonMode) { outputJsonError("compact", msg); } else { console.error(chalk.red(`Error: ${msg}`)); }
      process.exitCode = 1;
      return;
    }
  }

  // Add supersedes links to the compacted-from records
  if (compactedFrom.length > 0) {
    replacement.supersedes = compactedFrom;
  }

  // Validate replacement
  const ajv = new Ajv();
  const validate = ajv.compile(recordSchema);
  replacement.id = generateRecordId(replacement);
  if (!validate(replacement)) {
    const errors = (validate.errors ?? []).map((err) => `${err.instancePath} ${err.message}`);
    const msg = `Replacement record failed validation: ${errors.join("; ")}`;
    if (jsonMode) { outputJsonError("compact", msg); } else { console.error(chalk.red(`Error: ${msg}`)); }
    process.exitCode = 1;
    return;
  }

  // Remove old records and append replacement
  const removeSet = new Set(indicesToRemove);
  const remaining = records.filter((_, i) => !removeSet.has(i));
  remaining.push(replacement);
  await writeExpertiseFile(filePath, remaining);

  if (jsonMode) {
    outputJson({
      success: true,
      command: "compact",
      action: "applied",
      domain,
      removed: indicesToRemove.length,
      replacement,
    });
  } else {
    console.log(
      chalk.green(`\u2714 Compacted ${indicesToRemove.length} ${recordType} records into 1 in ${domain}`),
    );
  }
}

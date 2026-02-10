import { readFile, appendFile, writeFile, stat } from "node:fs/promises";
import type { ExpertiseRecord } from "../schemas/record.js";

export async function readExpertiseFile(
  filePath: string,
): Promise<ExpertiseRecord[]> {
  let content: string;
  try {
    content = await readFile(filePath, "utf-8");
  } catch {
    return [];
  }

  const records: ExpertiseRecord[] = [];
  const lines = content.split("\n").filter((line) => line.trim().length > 0);
  for (const line of lines) {
    records.push(JSON.parse(line) as ExpertiseRecord);
  }
  return records;
}

export async function appendRecord(
  filePath: string,
  record: ExpertiseRecord,
): Promise<void> {
  const line = JSON.stringify(record) + "\n";
  await appendFile(filePath, line, "utf-8");
}

export async function createExpertiseFile(filePath: string): Promise<void> {
  await writeFile(filePath, "", "utf-8");
}

export async function getFileModTime(filePath: string): Promise<Date | null> {
  try {
    const stats = await stat(filePath);
    return stats.mtime;
  } catch {
    return null;
  }
}

export async function writeExpertiseFile(
  filePath: string,
  records: ExpertiseRecord[],
): Promise<void> {
  const content = records.map((r) => JSON.stringify(r)).join("\n") + (records.length > 0 ? "\n" : "");
  await writeFile(filePath, content, "utf-8");
}

export function countRecords(records: ExpertiseRecord[]): number {
  return records.length;
}

export function filterByType(
  records: ExpertiseRecord[],
  type: string,
): ExpertiseRecord[] {
  return records.filter((r) => r.type === type);
}

export function findDuplicate(
  existing: ExpertiseRecord[],
  newRecord: ExpertiseRecord,
): { index: number; record: ExpertiseRecord } | null {
  for (let i = 0; i < existing.length; i++) {
    const record = existing[i];
    if (record.type !== newRecord.type) continue;

    switch (record.type) {
      case "pattern":
        if (
          newRecord.type === "pattern" &&
          record.name === newRecord.name
        ) {
          return { index: i, record };
        }
        break;
      case "decision":
        if (
          newRecord.type === "decision" &&
          record.title === newRecord.title
        ) {
          return { index: i, record };
        }
        break;
      case "convention":
        if (
          newRecord.type === "convention" &&
          record.content === newRecord.content
        ) {
          return { index: i, record };
        }
        break;
      case "failure":
        if (
          newRecord.type === "failure" &&
          record.description === newRecord.description
        ) {
          return { index: i, record };
        }
        break;
      case "reference":
        if (
          newRecord.type === "reference" &&
          record.name === newRecord.name
        ) {
          return { index: i, record };
        }
        break;
      case "guide":
        if (
          newRecord.type === "guide" &&
          record.name === newRecord.name
        ) {
          return { index: i, record };
        }
        break;
    }
  }
  return null;
}

export function searchRecords(
  records: ExpertiseRecord[],
  query: string,
): ExpertiseRecord[] {
  const lowerQuery = query.toLowerCase();
  return records.filter((record) => {
    for (const value of Object.values(record)) {
      if (typeof value === "string" && value.toLowerCase().includes(lowerQuery)) {
        return true;
      }
      if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === "string" && item.toLowerCase().includes(lowerQuery)) {
            return true;
          }
        }
      }
    }
    return false;
  });
}

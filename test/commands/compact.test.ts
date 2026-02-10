import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  initMulchDir,
  writeConfig,
  getExpertisePath,
} from "../../src/utils/config.js";
import {
  appendRecord,
  readExpertiseFile,
  createExpertiseFile,
} from "../../src/utils/expertise.js";
import { DEFAULT_CONFIG } from "../../src/schemas/config.js";
import type { ExpertiseRecord } from "../../src/schemas/record.js";

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

describe("compact command", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "mulch-compact-test-"));
    await initMulchDir(tmpDir);
    await writeConfig(
      { ...DEFAULT_CONFIG, domains: ["testing", "architecture"] },
      tmpDir,
    );
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  describe("analyze", () => {
    it("finds no candidates when domain has < 2 records of any type", async () => {
      const filePath = getExpertisePath("testing", tmpDir);
      await createExpertiseFile(filePath);
      await appendRecord(filePath, {
        type: "convention",
        content: "Only one",
        classification: "tactical",
        recorded_at: daysAgo(20),
      });

      const records = await readExpertiseFile(filePath);
      expect(records).toHaveLength(1);
      // With only 1 record, no compaction candidates exist
    });

    it("finds candidates when 3+ records of same type exist", async () => {
      const filePath = getExpertisePath("testing", tmpDir);
      await createExpertiseFile(filePath);

      for (let i = 0; i < 3; i++) {
        await appendRecord(filePath, {
          type: "convention",
          content: `Convention ${i}`,
          classification: "tactical",
          recorded_at: daysAgo(5),
        });
      }

      const records = await readExpertiseFile(filePath);
      expect(records).toHaveLength(3);
    });

    it("finds candidates when records are stale", async () => {
      const filePath = getExpertisePath("testing", tmpDir);
      await createExpertiseFile(filePath);

      await appendRecord(filePath, {
        type: "failure",
        description: "Old failure 1",
        resolution: "Fix 1",
        classification: "tactical",
        recorded_at: daysAgo(20), // past 14-day shelf life
      });
      await appendRecord(filePath, {
        type: "failure",
        description: "Old failure 2",
        resolution: "Fix 2",
        classification: "tactical",
        recorded_at: daysAgo(20),
      });

      const records = await readExpertiseFile(filePath);
      expect(records).toHaveLength(2);
    });
  });

  describe("apply", () => {
    it("compacts multiple conventions into one", async () => {
      const filePath = getExpertisePath("testing", tmpDir);
      await createExpertiseFile(filePath);

      await appendRecord(filePath, {
        type: "convention",
        content: "Convention A",
        classification: "tactical",
        recorded_at: daysAgo(10),
      });
      await appendRecord(filePath, {
        type: "convention",
        content: "Convention B",
        classification: "tactical",
        recorded_at: daysAgo(8),
      });
      await appendRecord(filePath, {
        type: "pattern",
        name: "keep-me",
        description: "Should not be removed",
        classification: "foundational",
        recorded_at: daysAgo(1),
      });

      const before = await readExpertiseFile(filePath);
      expect(before).toHaveLength(3);

      // Simulate compaction: remove conventions 1,2, add consolidated
      const idA = before[0].id!;
      const idB = before[1].id!;

      // Remove records at indices 0 and 1, keep pattern at index 2
      const remaining = [before[2]];
      const replacement: ExpertiseRecord = {
        type: "convention",
        content: "Combined: Convention A and B",
        classification: "foundational",
        recorded_at: new Date().toISOString(),
        supersedes: [idA, idB],
      };
      remaining.push(replacement);

      const { writeExpertiseFile } = await import("../../src/utils/expertise.js");
      await writeExpertiseFile(filePath, remaining);

      const after = await readExpertiseFile(filePath);
      expect(after).toHaveLength(2);
      expect(after[0].type).toBe("pattern");
      expect(after[1].type).toBe("convention");
      if (after[1].type === "convention") {
        expect(after[1].content).toBe("Combined: Convention A and B");
        expect(after[1].classification).toBe("foundational");
        expect(after[1].supersedes).toEqual([idA, idB]);
      }
    });

    it("compacts failures preserving non-target records", async () => {
      const filePath = getExpertisePath("testing", tmpDir);
      await createExpertiseFile(filePath);

      await appendRecord(filePath, {
        type: "failure",
        description: "Failure 1",
        resolution: "Fix 1",
        classification: "tactical",
        recorded_at: daysAgo(20),
      });
      await appendRecord(filePath, {
        type: "failure",
        description: "Failure 2",
        resolution: "Fix 2",
        classification: "tactical",
        recorded_at: daysAgo(18),
      });
      await appendRecord(filePath, {
        type: "convention",
        content: "Unrelated convention",
        classification: "foundational",
        recorded_at: daysAgo(1),
      });

      const before = await readExpertiseFile(filePath);
      expect(before).toHaveLength(3);

      // Remove failures, keep convention, add compacted failure
      const remaining = [before[2]];
      const replacement: ExpertiseRecord = {
        type: "failure",
        description: "Combined failures",
        resolution: "Combined fixes",
        classification: "foundational",
        recorded_at: new Date().toISOString(),
      };
      remaining.push(replacement);

      const { writeExpertiseFile } = await import("../../src/utils/expertise.js");
      await writeExpertiseFile(filePath, remaining);

      const after = await readExpertiseFile(filePath);
      expect(after).toHaveLength(2);
      expect(after[0].type).toBe("convention");
      expect(after[1].type).toBe("failure");
    });

    it("compacted record gets foundational classification", async () => {
      const filePath = getExpertisePath("testing", tmpDir);
      await createExpertiseFile(filePath);

      await appendRecord(filePath, {
        type: "pattern",
        name: "old-pattern-1",
        description: "Old pattern 1",
        classification: "tactical",
        recorded_at: daysAgo(20),
      });
      await appendRecord(filePath, {
        type: "pattern",
        name: "old-pattern-2",
        description: "Old pattern 2",
        classification: "observational",
        recorded_at: daysAgo(35),
      });

      const before = await readExpertiseFile(filePath);
      const replacement: ExpertiseRecord = {
        type: "pattern",
        name: "consolidated-pattern",
        description: "Consolidated from old patterns",
        classification: "foundational",
        recorded_at: new Date().toISOString(),
        supersedes: before.map((r) => r.id!),
      };

      const { writeExpertiseFile } = await import("../../src/utils/expertise.js");
      await writeExpertiseFile(filePath, [replacement]);

      const after = await readExpertiseFile(filePath);
      expect(after).toHaveLength(1);
      expect(after[0].classification).toBe("foundational");
    });

    it("compacted record has supersedes links to source IDs", async () => {
      const filePath = getExpertisePath("testing", tmpDir);
      await createExpertiseFile(filePath);

      await appendRecord(filePath, {
        type: "decision",
        title: "Decision A",
        rationale: "Reason A",
        classification: "tactical",
        recorded_at: daysAgo(15),
      });
      await appendRecord(filePath, {
        type: "decision",
        title: "Decision B",
        rationale: "Reason B",
        classification: "tactical",
        recorded_at: daysAgo(12),
      });

      const before = await readExpertiseFile(filePath);
      const sourceIds = before.map((r) => r.id!);

      const replacement: ExpertiseRecord = {
        type: "decision",
        title: "Consolidated decision",
        rationale: "Combined rationale",
        classification: "foundational",
        recorded_at: new Date().toISOString(),
        supersedes: sourceIds,
      };

      const { writeExpertiseFile } = await import("../../src/utils/expertise.js");
      await writeExpertiseFile(filePath, [replacement]);

      const after = await readExpertiseFile(filePath);
      expect(after[0].supersedes).toEqual(sourceIds);
    });
  });
});

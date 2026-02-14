// Type exports
export type {
  RecordType,
  Classification,
  Evidence,
  ConventionRecord,
  PatternRecord,
  FailureRecord,
  DecisionRecord,
  ExpertiseRecord,
} from "./schemas/index.js";

export type { MulchConfig } from "./schemas/index.js";
export { DEFAULT_CONFIG } from "./schemas/index.js";

// Schema exports
export { recordSchema } from "./schemas/record-schema.js";

// Config utilities
export { readConfig, getExpertisePath } from "./utils/config.js";

// Expertise utilities
export {
  readExpertiseFile,
  searchRecords,
  appendRecord,
  writeExpertiseFile,
  findDuplicate,
  generateRecordId,
} from "./utils/expertise.js";

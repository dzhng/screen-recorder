export {
  assetSchema,
  streamSchema,
  compositionSchema,
  anchorSchema,
  clipSchema,
  rangeSchema,
  fractionSchema,
  timeValueSchema,
  selectionRangeSchema,
} from "./schema.js";
export type {
  Anchor,
  Asset,
  Clip,
  Composition,
  Fraction,
  Range,
  SelectionRange,
  TimeValue,
  Stream,
} from "./schema.js";
export type { Rational } from "./rational.js";

export {
  validateComposition,
  resolvePlacement,
  projectToSource,
  sourceToProject,
} from "./model.js";
export type {
  ExactRange,
  ResolvedPlacement,
  ValidatedComposition,
  SourceOccurrence,
  ProjectOccurrence,
} from "./model.js";
export { applyBatch, editOperationSchema } from "./edits.js";
export type { EditOperation, EditBatchResult, EditChange } from "./edits.js";

export { CompositionError } from "./errors.js";

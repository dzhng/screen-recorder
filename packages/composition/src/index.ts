export {
  assetSchema,
  streamSchema,
  compositionSchema,
  anchorSchema,
  clipSchema,
  mediaClipSchema,
  silenceClipSchema,
  isMediaClip,
  rangeSchema,
  fractionSchema,
  timeValueSchema,
  selectionRangeSchema,
} from "./schema.js";
export type {
  Anchor,
  Asset,
  Clip,
  MediaClip,
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

export { getProcessing, processingCapabilities } from "./processing.js";
export { processingTargetSchema, processingStepSchema } from "./schema.js";
export type { ProcessingTarget, ProcessingStep } from "./schema.js";

export { createCompiler } from "./compiler.js";
export type { CompiledFrame, CompiledAudio } from "./compiler.js";
export type { ProcessingInstruction } from "./processing-plan.js";
export {
  executionWindowRequestSchema,
  executionWindowManifestSchema,
  processingTapSchema,
  requireWindowReady,
} from "./execution-window.js";
export type { ExecutionWindowManifest, ProcessingTap } from "./execution-window.js";

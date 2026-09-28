export {
  assetSchema,
  acquisitionContextSchema,
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
  AcquisitionContext,
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
export { rational, compare, fromTime, toTime, floor, ceil } from "./rational.js";

export {
  validateComposition,
  sourceAvailability,
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

export {
  getProcessing,
  processingCapabilities,
  type ProcessorImplementations,
} from "./processing.js";
export { processingTargetSchema, processingStepSchema } from "./schema.js";
export type { ProcessingTarget, ProcessingStep } from "./schema.js";

export { createCompiler } from "./compiler.js";
export { compiledFrameSchema, compiledAudioSchema } from "./compiled-records.js";
export type { CompiledFrame, CompiledAudio } from "./compiled-records.js";
export type { ProcessingInstruction } from "./processing-plan.js";
export {
  executionWindowRequestSchema,
  executionWindowManifestSchema,
  processingTapSchema,
  requireWindowReady,
} from "./execution-window.js";
export type { ExecutionWindowManifest, ProcessingTap } from "./execution-window.js";

export { createSourceRangeProjection } from "./source-projection.js";
export type {
  SourceRangeOccurrence,
  SourceWindowOccurrence,
  SourcePointOccurrence,
} from "./source-projection.js";

export { intervalIndex } from "./interval-index.js";

export { createProjectCuts } from "./project-cuts.js";
export type { ProjectCut, ProjectCutSide } from "./project-cuts.js";

export { maximumPointerTrailUs } from "./pointer.js";

export { scalarCurveSchema } from "./schema.js";
export type { ScalarCurve } from "./schema.js";
export type { CompiledScalarCurve } from "./curve.js";
export type { ScalarKernel, SampleScalarPiece, SampleScalarProgram } from "./scalar-program.js";
export type { CompiledProcessingInstruction } from "./temporal-processing.js";

export {
  outputSettingsSchema,
  resolvedOutputSettingsSchema,
  resolveOutputSettings,
  normalizeOutputRequest,
  outputPresets,
} from "./output-settings.js";
export type { OutputSettings, OutputSettingsInput } from "./output-settings.js";
export { outputCapabilities } from "./output-settings.js";

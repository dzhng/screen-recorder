import { z } from "zod";

const id = z.string().min(1);
const time = z.int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const range = z.object({ startUs: time, endUs: time }).strict();
const recording = z.object({ recordingId: id }).strict();
const edit = recording.extend({ requestId: id, expectedRevisionId: id });
const historyCursor = z
  .object({
    recordingId: id,
    afterOrdinal: z.int().min(-1),
    throughOrdinal: z.int().min(-1),
  })
  .strict();

// These are implemented capabilities. Adapters derive their advertised tools from
// the same schemas the service validates, rather than promising future operations.
export const operationSchema = z.discriminatedUnion("operation", [
  z
    .object({ operation: z.literal("service.health"), params: z.object({}).strict() })
    .strict()
    .describe("Read local service readiness without starting capture."),
  z
    .object({ operation: z.literal("recording.latest"), params: z.object({}).strict() })
    .strict()
    .describe("Read the newest discoverable take, including unfinished recordings."),
  z
    .object({ operation: z.literal("recording.get"), params: recording })
    .strict()
    .describe("Read one recording by its stable identity."),
  z
    .object({
      operation: z.literal("revision.get"),
      params: recording.extend({ revisionId: id.optional() }),
    })
    .strict()
    .describe("Read a specified revision, or resolve the current revision once."),
  z
    .object({
      operation: z.literal("revision.history"),
      params: recording.extend({
        cursor: historyCursor.nullable().optional(),
        limit: z.int().min(1).max(500).optional(),
      }),
    })
    .strict()
    .describe("Read a bounded page of history pinned to its initial revision ordinal."),
  z
    .object({ operation: z.literal("edit.trim"), params: edit.extend({ range }) })
    .strict()
    .describe("Keep a range in the expected revision's playback coordinates."),
  z
    .object({
      operation: z.literal("edit.cut"),
      params: edit.extend({ ranges: z.array(range).min(1).max(1000) }),
    })
    .strict()
    .describe("Remove ranges in the expected revision's playback coordinates."),
  z
    .object({ operation: z.literal("edit.undo"), params: edit })
    .strict()
    .describe("Undo the active edit by creating a new revision identity."),
  z
    .object({ operation: z.literal("edit.restore"), params: edit.extend({ targetRevisionId: id }) })
    .strict()
    .describe("Restore retained spans from a historical revision into a new revision."),
]);

export type SupportedOperation = z.infer<typeof operationSchema>;
export const operationNames: ReadonlySet<string> = new Set(
  operationSchema.options.map((option) => option.shape.operation.value),
);

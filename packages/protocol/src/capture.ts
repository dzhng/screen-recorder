import { z } from "zod";

/**
 * The private app channel carries capture control in both directions. These shapes are the
 * boundary between the two owners: the service names a take and a directory, and native
 * answers with what its device actually did. Neither side restates the other's schema.
 */
const id = z.string().min(1);
const absolutePath = z.string().min(1).startsWith("/");
const finite = z.number().finite();

export const captureSourceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("display"), displayId: z.int().nonnegative() }).strict(),
  z.object({ kind: z.literal("window"), windowId: z.int().nonnegative() }).strict(),
  z
    .object({
      kind: z.literal("region"),
      displayId: z.int().nonnegative(),
      x: finite,
      y: finite,
      width: finite.positive(),
      height: finite.positive(),
    })
    .strict(),
]);
export type CaptureSource = z.infer<typeof captureSourceSchema>;

/** What a caller chooses about a take. Audio is off unless it is explicitly selected. */
export const captureSelectionSchema = z.object({
  source: captureSourceSchema,
  microphone: z.boolean().default(false),
  systemAudio: z.boolean().default(false),
  microphoneDeviceId: id.optional(),
});

/** Identity and directory are allocated before native runs, so native never invents either. */
export const nativeStartSchema = captureSelectionSchema.extend({
  recordingId: id,
  sourceId: id,
  outputDirectory: absolutePath,
});

/**
 * Lifecycle sequences below this belong to the native capture journal, which numbers its own
 * records. The service numbers the events it authors itself — a refused start, a cancel, a
 * reconciled interruption — from this value up, so the two producers share one strictly
 * increasing order and a native report can never silently occupy a service-authored number.
 */
export const NATIVE_SEQUENCE_LIMIT = 2 ** 40;

export const captureReportSchema = z
  .object({
    recordingId: id,
    sourceId: id,
    sequence: z
      .int()
      .min(1)
      .max(NATIVE_SEQUENCE_LIMIT - 1),
    state: z.enum(["recording", "paused", "finalizing", "complete", "interrupted"]),
    reason: z.string().min(1).nullish(),
    sourceDurationUs: z.int().nonnegative().nullish(),
  })
  .strict();
export type CaptureReport = z.infer<typeof captureReportSchema>;

/** The device state native owns. The catalog stores what this reports; it derives nothing. */
export const captureDeviceSchema = z
  .object({
    state: z.enum(["idle", "selecting", "recording", "paused", "finalizing"]),
    recordingId: id.nullable(),
    sourceId: id.nullable(),
  })
  .strict();

export const captureSourcesSchema = z
  .object({
    displays: z.array(z.object({ id: z.int(), width: z.int(), height: z.int() }).strict()),
    windows: z.array(
      z.object({ id: z.int(), title: z.string(), application: z.string() }).strict(),
    ),
  })
  .strict();

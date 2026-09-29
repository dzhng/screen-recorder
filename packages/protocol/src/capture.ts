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

/**
 * What a caller chooses about a take. These takes are narrated, so the microphone is on unless a
 * caller refuses it, and what the machine itself plays stays out until it is asked for. This is
 * the one place either default is stated: every peer is told both, explicitly, on every start.
 */
export const captureSelectionSchema = z.object({
  source: captureSourceSchema,
  microphone: z.boolean().default(true),
  systemAudio: z.boolean().default(false),
  microphoneDeviceId: id.optional(),
});
export type CaptureSelection = z.output<typeof captureSelectionSchema>;

/** Identity and directory are allocated before native runs, so native never invents either. */
export const nativeStartSchema = captureSelectionSchema.extend({
  recordingId: id,
  sourceId: id,
  outputDirectory: absolutePath,
});

/**
 * Lifecycle sequences below this belong to the native capture journal, which numbers its own
 * records. The service numbers the events it authors itself — a refused start, a cancel, a
 * reconciled interruption — above this value, so the two producers share one strictly
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
    finalizationError: z
      .object({
        code: z.string().min(1).max(128),
        message: z.string().max(4096),
        retryable: z.boolean(),
      })
      .nullable()
      .optional(),
    sourceDurationUs: z.int().nonnegative().nullish(),
  })
  .strict();
export type CaptureReport = z.infer<typeof captureReportSchema>;

/**
 * Permission is the native session's own fact: it is read without asking for anything, so a
 * status call never prompts. Only an explicit person-initiated request can change either value.
 */
export const capturePermissionsSchema = z
  .object({
    screen: z.boolean(),
    microphone: z.enum(["authorized", "denied", "restricted", "not_determined", "unknown"]),
  })
  .strict();

/**
 * The device state native owns. The catalog stores what this reports; it derives nothing.
 * `elapsedUs` is the running take's playback time, read from the capture clock that writes its
 * media, so it omits paused time and freezes while paused. Nothing else derives elapsed time.
 */
export const captureDeviceSchema = z
  .object({
    state: z.enum(["idle", "selecting", "recording", "paused", "finalizing"]),
    recordingId: id.nullable(),
    sourceId: id.nullable(),
    elapsedUs: z.int().nonnegative().nullable(),
    selection: captureSelectionSchema.nullable(),
    permissions: capturePermissionsSchema,
  })
  .strict();

/**
 * Everything a take can be pointed at. Listing reaches no device and requests no permission;
 * `microphones` names what a narrated take could use, and an empty list is an honest answer.
 */
export const captureSourcesSchema = z
  .object({
    displays: z.array(
      z.object({ id: z.int(), name: z.string(), width: z.int(), height: z.int() }).strict(),
    ),
    windows: z.array(
      z.object({ id: z.int(), title: z.string(), application: z.string() }).strict(),
    ),
    microphones: z.array(z.object({ id: id, name: z.string(), isDefault: z.boolean() }).strict()),
  })
  .strict();

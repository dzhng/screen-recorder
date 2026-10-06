import { mediaProbeSchema } from "./assets.js";
import { CatalogError } from "./catalog.js";
import { signedTimeValueSchema, timeValueSchema } from "@yap/composition";
import { z } from "zod";

const stream = mediaProbeSchema.shape.streams.element;
const color = z.object({
  colorPrimaries: z.string().nullable(),
  transferFunction: z.string().nullable(),
  ycbcrMatrix: z.string().nullable(),
  fullRange: z.boolean().nullable(),
  bitsPerComponent: z.int().positive().nullable(),
  interpretationExtensions: z.array(z.string()),
  invalidColorDeclarations: z.array(z.string()),
});
const compressedInspection = z.object({
  status: z.enum(["complete", "incomplete", "unsupported"]),
  packetCount: z.int().nonnegative(),
  nalTypes: z.array(z.int().min(0).max(63)).max(64),
  configurationNalTypes: z.array(z.int().min(0).max(63)).max(64),
  seiPayloadTypes: z.array(z.int().nonnegative()).max(256),
  refusals: z.array(z.string()).max(256),
});
const videoFacts = stream.safeExtend({
  kind: z.literal("video"),
  startUs: timeValueSchema,
  endUs: timeValueSchema,
  width: z.int().positive(),
  height: z.int().positive(),
  orientedWidth: z.number().finite().positive(),
  orientedHeight: z.number().finite().positive(),
  transform: z.array(z.number().finite()).length(6),
  segments: stream.shape.segments.unwrap(),
  hasAlpha: z.boolean(),
  colorFormats: z.array(color).min(1),
  codecAtomNames: z.array(z.array(z.string())).min(1),
  samples: stream.shape.samples.unwrap().safeExtend({
    firstTimeUs: signedTimeValueSchema,
    lastTimeUs: signedTimeValueSchema,
    lastDurationUs: timeValueSchema,
    presentedTimingSha256: z.string().regex(/^[a-f0-9]{64}$/),
  }),
  compressedVideoInspection: compressedInspection.optional(),
});

function selectedConversionStream(value: unknown, streamId: string, kind: "video" | "audio") {
  const parsed = mediaProbeSchema.safeParse(value);
  if (!parsed.success)
    throw new CatalogError("INVALID_NATIVE_RESPONSE", "Native conversion metadata is malformed");
  const metadata = parsed.data;
  const index = metadata.streams.findIndex((stream) => stream.id === streamId);
  const selected = metadata.streams[index];
  if (!selected || selected.kind !== kind || !selected.decodable)
    throw new CatalogError("UNSUPPORTED_MEDIA", "Selected conversion stream is unavailable");
  // The stable schema validates identities/order but intentionally strips fresh evidence.
  const raw = z.object({ streams: z.array(z.unknown()) }).parse(value).streams[index];
  return { metadata, raw };
}

/** Fresh held native facts are conversion operands; cached asset summaries are not. */
export function readHdrConversionFacts(value: unknown, streamId: string) {
  const { metadata, raw } = selectedConversionStream(value, streamId, "video");
  const facts = videoFacts.safeParse(raw);
  if (!facts.success)
    throw new CatalogError(
      "INVALID_NATIVE_RESPONSE",
      "Native video conversion facts are missing or malformed",
      { streamId },
    );
  return { metadata, video: facts.data };
}

export type HdrConversionFacts = ReturnType<typeof readHdrConversionFacts>;

const frameCount = z.int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const audioFacts = stream.safeExtend({
  kind: z.literal("audio"),
  startUs: timeValueSchema,
  endUs: timeValueSchema,
  sampleRate: z.int().positive().max(192000),
  channels: z.union([z.literal(1), z.literal(2)]),
  segments: stream.shape.segments.unwrap(),
  decodedAudioInspection: z.object({
    sampleRate: z.int().positive().max(192000),
    channels: z.union([z.literal(1), z.literal(2)]),
    frames: frameCount,
    runs: z
      .array(
        z.object({
          startUs: signedTimeValueSchema,
          endUs: signedTimeValueSchema,
          frames: frameCount.positive(),
        }),
      )
      .max(100000),
    pcmSha256: z.string().regex(/^[a-f0-9]{64}$/),
    trimming: z.literal("decoder-output-attachment-free"),
  }),
});

export function readHdrAudioConversionFacts(value: unknown, streamId: string) {
  const { metadata, raw } = selectedConversionStream(value, streamId, "audio");
  const facts = audioFacts.safeParse(raw);
  if (!facts.success)
    throw new CatalogError(
      "INVALID_NATIVE_RESPONSE",
      "Native decoded audio conversion facts are missing or malformed",
      { streamId },
    );
  return { metadata, audio: facts.data };
}
export type HdrAudioConversionFacts = ReturnType<typeof readHdrAudioConversionFacts>;

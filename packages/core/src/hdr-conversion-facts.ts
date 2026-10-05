import { mediaProbeSchema } from "./assets.js";
import { CatalogError } from "./catalog.js";
import { signedTimeValueSchema, timeValueSchema } from "@screenrec/composition";
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

/** Fresh held native facts are conversion operands; cached asset summaries are not. */
export function readHdrConversionFacts(value: unknown, streamId: string) {
  const parsed = mediaProbeSchema.safeParse(value);
  if (!parsed.success)
    throw new CatalogError("INVALID_NATIVE_RESPONSE", "Native conversion metadata is malformed");
  const metadata = parsed.data;
  const index = metadata.streams.findIndex((stream) => stream.id === streamId);
  const selected = metadata.streams[index];
  if (!selected || selected.kind !== "video" || !selected.decodable)
    throw new CatalogError("UNSUPPORTED_MEDIA", "Selected video stream is unavailable");
  // The stable schema validates identities/order but intentionally strips fresh evidence.
  const raw = z.object({ streams: z.array(z.unknown()) }).parse(value).streams[index];
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

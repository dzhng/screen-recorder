import { z } from "zod";

/** Durable structural contracts never depend on the currently registered execution profile. */
export const voiceGenerationSchema = z.strictObject({
  temperature: z.number().finite().nonnegative(),
  top_k: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  top_p: z.number().finite().min(0).max(1),
  repetition_penalty: z.number().finite().positive(),
  max_tokens: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  lang_code: z.string().min(1),
  stream: z.literal(false),
});
export type VoiceGeneration = z.infer<typeof voiceGenerationSchema>;
export const voiceSeedSchema = z
  .string()
  .regex(/^(0|[1-9][0-9]{0,19})$/)
  .pipe(
    z
      .string()
      .refine(
        (value) => BigInt(value) <= 18446744073709551615n,
        "Seed exceeds the unsigned 64-bit range",
      ),
  );
export const voiceFilterModesSchema = z.strictObject({
  sampling: z.enum(["greedy", "categorical"]),
  firstBookTopK: z.enum(["bypassed", "disabled", "enabled"]),
  residualTopK: z.enum(["bypassed", "disabled", "enabled"]),
  nucleus: z.enum(["bypassed", "disabled", "enabled"]),
});
const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const positiveCount = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
/** File is an internal publication path; durable provenance must omit it. */
export const voiceReceiptSchema = z.strictObject({
  file: z.string(),
  sha256,
  sampleRate: positiveCount,
  channels: positiveCount,
  frames: positiveCount,
  durationUs: positiveCount,
  referenceSha256: sha256,
  referenceFrames: positiveCount,
  runtimeRevision: z.string(),
  modelRevision: z.string(),
  profileId: z.string(),
  profileSha256: sha256,
  tokenizerIdentity: z.record(z.string(), sha256),
  iclSourceSha256: sha256,
  generation: voiceGenerationSchema,
  effectiveGeneration: voiceGenerationSchema,
  filterModes: voiceFilterModesSchema,
  seed: voiceSeedSchema,
  prefill: z.strictObject({
    referenceTextTokens: positiveCount,
    targetTextTokens: positiveCount,
    referenceTextTokenSha256: sha256,
    targetTextTokenSha256: sha256,
    referenceCodes: positiveCount,
    inputTokens: positiveCount,
  }),
  stopReason: z.literal("eos"),
  generatedTokens: positiveCount,
  text: z.string(),
  referenceText: z.string(),
  descriptorDigest: sha256,
  runtimeDigest: sha256,
  modelDigest: sha256,
});
export type VoiceReceipt = z.infer<typeof voiceReceiptSchema>;
export const resolvedVoiceSettingsSchema = z.strictObject({
  profileId: z.string(),
  seed: voiceSeedSchema,
  requested: voiceGenerationSchema,
  effective: voiceGenerationSchema,
  filterModes: voiceFilterModesSchema,
});
export type ResolvedVoiceSettings = z.infer<typeof resolvedVoiceSettingsSchema>;

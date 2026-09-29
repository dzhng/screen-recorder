import { z } from "zod";
import {
  voiceGenerationSchema,
  voiceSeedSchema,
  type ResolvedVoiceSettings,
} from "./voice-types.js";
export {
  voiceReceiptSchema,
  resolvedVoiceSettingsSchema,
  type VoiceReceipt,
  type VoiceGeneration,
  type ResolvedVoiceSettings,
} from "./voice-types.js";
import { CatalogError } from "./catalog.js";
import runtimeEntries from "./model-data/voice-runtime.json" with { type: "json" };
import profile from "./model-data/voice-profile-v1.json" with { type: "json" };

/** One registered execution profile; the runtime artifact ships these same profile bytes. */
export const voiceProfile = profile;
const profileFile = runtimeEntries.find((entry) => entry.path === "voice/profile.json");
if (!profileFile || profileFile.kind !== "file" || !("sha256" in profileFile))
  throw new Error("Registered voice profile inventory is missing");
export const voiceProfileSha256 = profileFile.sha256;
const generation = z.strictObject({
  ...voiceGenerationSchema.shape,
  temperature: voiceGenerationSchema.shape.temperature.refine(
    (value) =>
      value === 0 ||
      (value >= profile.temperature.minimumPositive && value <= profile.temperature.maximum),
    "Temperature must be greedy zero or inside the registered numerical interval",
  ),
  top_k: voiceGenerationSchema.shape.top_k.max(profile.topKMaximum),
  repetition_penalty: voiceGenerationSchema.shape.repetition_penalty.max(profile.repetitionMaximum),
  max_tokens: voiceGenerationSchema.shape.max_tokens.max(profile.maximumOutputTokens),
  lang_code: voiceGenerationSchema.shape.lang_code.refine(
    (value) => profile.languages.includes(value),
    "Unsupported language",
  ),
});
const requestGeneration = z.preprocess(
  (value) =>
    value && typeof value === "object" && !Array.isArray(value)
      ? { ...profile.defaults, ...value }
      : value,
  generation,
);
/** Preserve every requested value, including the pinned runtime's repetition clamp. */
export function resolveVoiceSettings(
  input: unknown = {},
  seed: unknown = profile.defaultSeed,
): ResolvedVoiceSettings {
  const options = requestGeneration.safeParse(input),
    parsedSeed = voiceSeedSchema.safeParse(seed);
  if (!options.success || !parsedSeed.success)
    throw new CatalogError(
      "INVALID_REQUEST",
      "Voice settings do not match the registered execution profile",
      {
        profileId: profile.id,
        issues: [
          ...(!options.success ? options.error.issues : []),
          ...(!parsedSeed.success ? parsedSeed.error.issues : []),
        ],
      },
    );
  const requested = {
    ...options.data,
    temperature: options.data.temperature === 0 ? 0 : options.data.temperature,
    top_k: options.data.top_k === 0 ? 0 : options.data.top_k,
    top_p: options.data.top_p === 0 ? 0 : options.data.top_p,
  };
  const greedy = requested.temperature === 0;
  const topK = (vocabulary: number) =>
    greedy
      ? ("bypassed" as const)
      : requested.top_k === 0 || requested.top_k >= vocabulary
        ? ("disabled" as const)
        : ("enabled" as const);
  return {
    profileId: profile.id,
    seed: parsedSeed.data,
    requested,
    filterModes: {
      sampling: greedy ? "greedy" : "categorical",
      firstBookTopK: topK(profile.codebookVocabularies.first),
      residualTopK: topK(profile.codebookVocabularies.residual),
      nucleus: greedy
        ? "bypassed"
        : requested.top_p === 0 || requested.top_p === 1
          ? "disabled"
          : "enabled",
    },
    effective: {
      ...requested,
      repetition_penalty: Math.max(
        requested.repetition_penalty,
        profile.effectiveRepetitionMinimum,
      ),
    },
  };
}

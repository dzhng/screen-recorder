import { z } from "zod";

const bitrate = z.int().positive().max(0xffff_ffff);
const rateControl = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("average"), bitrate: z.int().min(0).max(0x7fff_ffff) }).strict(),
  z.object({ mode: z.literal("constant"), bitrate }).strict(),
  z
    .object({
      mode: z.literal("variable"),
      bitrate,
      maximumBitrate: bitrate.nullable().default(null),
    })
    .strict(),
  z.object({ mode: z.literal("quality"), quality: z.number().min(0).max(1) }).strict(),
]);
const video = z
  .object({
    codec: z.literal("h264"),
    color: z.literal("rec709"),
    rateControl,
    profile: z.enum(["baseline", "constrained-baseline", "main", "high", "constrained-high"]),
    level: z.enum(["auto", "1.3", "3.0", "3.1", "3.2", "4.0", "4.1", "4.2", "5.0", "5.1", "5.2"]),
    keyframeInterval: z.int().min(0).max(0x7fff_ffff),
    keyframeIntervalSeconds: z.number().nonnegative(),
    frameReordering: z.boolean(),
    entropy: z.enum(["cavlc", "cabac"]),
    temporalCompression: z.boolean(),
    openGop: z.boolean(),
    prioritizeSpeed: z.boolean(),
    powerEfficient: z.boolean(),
    dataRateLimits: z
      .array(z.object({ bytes: z.int().positive(), seconds: z.number().positive() }).strict())
      .max(2),
    bufferDurationSeconds: z.number().positive().nullable().default(null),
    initialBufferDelayPercent: z.number().min(0).max(100).nullable().default(null),
    spatialAdaptiveQuantization: z.boolean(),
    lookAheadFrames: z.int().nonnegative().max(0x7fff_ffff).nullable().default(null),
    nonDroppableFrameRate: z.number().positive().nullable().default(null),
    minimumQuantizer: z.int().min(0).max(51).nullable().default(null),
    maximumQuantizer: z.int().min(0).max(51).nullable().default(null),
  })
  .strict();
const audio = z
  .object({
    codec: z.literal("aac"),
    sampleRate: z.int().positive().max(0xffff_ffff),
    layout: z.enum(["mono", "stereo"]),
    rateControl: z.discriminatedUnion("mode", [
      z
        .object({
          mode: z.enum(["constant", "long-term-average", "constrained-variable"]),
          bitrate: z.int().positive().max(0x7fff_ffff),
        })
        .strict(),
      z
        .object({
          mode: z.literal("variable"),
          quality: z.enum(["min", "low", "medium", "high", "max"]),
        })
        .strict(),
    ]),
    quality: z.enum(["min", "low", "medium", "high", "max"]),
  })
  .strict();
export const resolvedOutputSettingsSchema = z
  .object({ container: z.literal("mp4"), video, audio })
  .strict()
  .superRefine((value, context) => {
    const issue = (message: string) => context.addIssue({ code: "custom", message });
    if (
      (value.video.bufferDurationSeconds !== null ||
        value.video.initialBufferDelayPercent !== null) &&
      !["constant", "variable"].includes(value.video.rateControl.mode)
    )
      issue("Buffer controls require constant or variable rate control");
    if (
      value.video.rateControl.mode === "variable" &&
      value.video.rateControl.maximumBitrate !== null &&
      value.video.rateControl.maximumBitrate < value.video.rateControl.bitrate
    )
      issue("Maximum variable bitrate must not be below target bitrate");
    if (
      ["baseline", "constrained-baseline"].includes(value.video.profile) &&
      (value.video.entropy !== "cavlc" || value.video.frameReordering)
    )
      issue("Baseline profile requires CAVLC and no frame reordering");
    if (value.video.openGop && !value.video.frameReordering)
      issue("Open GOP requires frame reordering");
    if (value.video.rateControl.mode !== "average" && value.video.dataRateLimits.length)
      issue("Data rate limits require average rate control");
    if (
      value.video.minimumQuantizer !== null &&
      value.video.maximumQuantizer !== null &&
      value.video.minimumQuantizer > value.video.maximumQuantizer
    )
      issue("Minimum quantizer must not exceed maximum quantizer");
    if (value.video.profile.startsWith("constrained-") && value.video.level !== "auto")
      issue("Constrained profiles require auto level");
    if (value.video.level === "1.3" && value.video.profile !== "baseline")
      issue("Level 1.3 is only available for baseline");
  });
export type OutputSettings = z.infer<typeof resolvedOutputSettingsSchema>;
/** An omitted preset selects balanced; individual overrides remain fully inspectable. */
export const outputSettingsSchema = z
  .object({
    preset: z.enum(["balanced", "compact", "sharp"]).optional(),
    container: z.literal("mp4").optional(),
    video: video.partial().optional(),
    audio: audio.partial().optional(),
  })
  .strict();
export type OutputSettingsInput = z.infer<typeof outputSettingsSchema>;

function preset(bits: number): OutputSettings {
  return {
    container: "mp4",
    video: {
      codec: "h264",
      color: "rec709",
      rateControl: { mode: "average", bitrate: bits },
      profile: "high",
      level: "auto",
      keyframeInterval: 120,
      keyframeIntervalSeconds: 2,
      frameReordering: false,
      entropy: "cabac",
      temporalCompression: true,
      openGop: false,
      prioritizeSpeed: false,
      powerEfficient: false,
      dataRateLimits: [],
      bufferDurationSeconds: null,
      initialBufferDelayPercent: null,
      spatialAdaptiveQuantization: true,
      lookAheadFrames: null,
      nonDroppableFrameRate: null,
      minimumQuantizer: null,
      maximumQuantizer: null,
    },
    audio: {
      codec: "aac",
      sampleRate: 48000,
      layout: "stereo",
      rateControl: { mode: "constant", bitrate: 192_000 },
      quality: "high",
    },
  };
}
export const outputPresets = {
  balanced: preset(8_000_000),
  compact: preset(3_000_000),
  sharp: preset(20_000_000),
};

export function resolveOutputSettings(input?: OutputSettingsInput): OutputSettings {
  const value = outputSettingsSchema.parse(input ?? {});
  const preset = outputPresets[value.preset ?? "balanced"];
  return resolvedOutputSettingsSchema.parse({
    container: value.container ?? preset.container,
    video: { ...preset.video, ...value.video },
    audio: { ...preset.audio, ...value.audio },
  });
}
/** Canonical authored request; deliberately does not expand presets, so retained intent replay is stable. */
export function normalizeOutputRequest(input?: OutputSettingsInput) {
  return outputSettingsSchema.parse(input ?? {});
}

/** Public control names map to documented encoder properties, never arbitrary SDK dictionaries. */
export const outputVideoControls = {
  "rateControl.average": "AverageBitRate",
  "rateControl.constant": "ConstantBitRate",
  "rateControl.variable": "VariableBitRate",
  "rateControl.maximumBitrate": "VBVMaxBitRate",
  bufferDurationSeconds: "VBVBufferDuration",
  initialBufferDelayPercent: "VBVInitialDelayPercentage",
  spatialAdaptiveQuantization: "SpatialAdaptiveQPLevel",
  lookAheadFrames: "LookAheadFrames",
  "rateControl.quality": "Quality",
  profile: "ProfileLevel",
  level: "ProfileLevel",
  keyframeInterval: "MaxKeyFrameInterval",
  keyframeIntervalSeconds: "MaxKeyFrameIntervalDuration",
  frameReordering: "AllowFrameReordering",
  entropy: "H264EntropyMode",
  temporalCompression: "AllowTemporalCompression",
  openGop: "AllowOpenGOP",
  prioritizeSpeed: "PrioritizeEncodingSpeedOverQuality",
  powerEfficient: "MaximizePowerEfficiency",
  dataRateLimits: "DataRateLimits",
  nonDroppableFrameRate: "AverageNonDroppableFrameRate",
  minimumQuantizer: "MinAllowedFrameQP",
  maximumQuantizer: "MaxAllowedFrameQP",
} as const;
export function outputCapabilities(properties: Record<string, unknown>) {
  return {
    target: "project",
    container: ["mp4"],
    videoCodecs: ["h264"],
    color: ["rec709"],
    audioCodecs: ["aac"],
    internalAudio: { sampleRate: 48000, channels: 2 },
    encodedAudio: {
      sampleRates: "Queried and validated against the selected native AAC converter",
      resampling: {
        exposed: false,
        publicAlgorithms: ["normal", "mastering", "minimum-phase"],
        reason:
          "The writer rejects explicit algorithm selection during encoding; a separate conversion stage is required",
      },
      layouts: ["mono", "stereo"],
      bitrateStrategies: ["constant", "long-term-average", "constrained-variable", "variable"],
    },
    presets: outputPresets,
    video: Object.fromEntries(
      Object.entries(outputVideoControls).map(([name, property]) => [
        name,
        {
          backendSupported:
            (properties[property] as { ReadWriteStatus?: string } | undefined)?.ReadWriteStatus ===
            "ReadWrite",
        },
      ]),
    ),
    semantics: {
      bitrate:
        "Requested encoder rate, not measured file bitrate; static content may be much smaller.",
      keyframes: "Maximum frame and time spacing; scene changes may add keyframes.",
      quality: "Codec quality target, not lossless or a guaranteed pixel error.",
      audio:
        "Encoded AAC conversion follows internal 48000 Hz stereo composition mixing; AAC packet padding is distinct from project duration.",
      geometry: "Canvas dimensions and rational frame rate belong to the composition.",
      backend:
        "Availability describes this host. Incompatible combinations are rejected by encoder preflight; no substitution.",
    },
    conditionalVideo: Object.fromEntries(
      Object.entries({
        maxSliceBytes: "MaxH264SliceBytes",
        maxFrameDelayCount: "MaxFrameDelayCount",
        referenceBufferCount: "ReferenceBufferCount",
        baseLayerFrameRate: "BaseLayerFrameRate",
        baseLayerFrameRateFraction: "BaseLayerFrameRateFraction",
        baseLayerBitRateFraction: "BaseLayerBitRateFraction",
      }).map(([name, property]) => [
        name,
        {
          property,
          exposed: false,
          backendSupported:
            (properties[property] as { ReadWriteStatus?: string } | undefined)?.ReadWriteStatus ===
            "ReadWrite",
          reason:
            "Requires a supporting encoder and a verified authored control; unavailable in this output path",
        },
      ]),
    ),
    encoderSelection: {
      exposed: false,
      publicProperties: [
        "EnableHardwareAcceleratedVideoEncoder",
        "RequireHardwareAcceleratedVideoEncoder",
        "PreferredEncoderGPURegistryID",
        "RequiredEncoderGPURegistryID",
      ],
      reason: "Requires verified selection in the actual writer, not only its preflight session",
    },
    unavailable: [
      "HDR and other color transforms",
      "additional video/audio codecs and containers",
      "output resizing or frame-rate conversion",
      "private encoder properties",
      "read-only statistics",
      "capture/real-time controls",
      "multipass encoding",
      "per-frame metadata and reference-frame controls",
    ],
  };
}

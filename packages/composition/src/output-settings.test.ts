import { expect, test } from "vitest";
import {
  normalizeOutputRequest,
  resolveAudioOutputSettings,
  outputPresets,
  outputCapabilities,
  outputSettingsSchema,
  resolveOutputSettings,
} from "./output-settings.js";

test("HEVC selects SDR Main defaults without inheriting H264 controls", () => {
  const output = resolveOutputSettings({ video: { codec: "hevc" } });
  expect(output.video).toMatchObject({ codec: "hevc", profile: "main", color: "rec709" });
  expect(output.video).not.toHaveProperty("entropy");
  expect(output.video).not.toHaveProperty("level");
  expect(resolveOutputSettings(output)).toEqual(output);
  expect(resolveOutputSettings().video.codec).toBe("h264");
});

test("HEVC discovery reports native readiness separately and exposes no H264 controls", () => {
  const inventory = {
    properties: {},
    encoders: [],
    audio: { sampleRates: [], formats: [] },
    hevc: { ready: false, probeStatus: -1, properties: {}, encoders: [] },
  };
  const unavailable = outputCapabilities(inventory);
  expect(unavailable.videoCodecs).toContain("hevc");
  expect(unavailable.hevc).toMatchObject({ ready: false, probeStatus: -1 });
  expect(unavailable.hevc.video).not.toHaveProperty("entropy");
  expect(unavailable.hevc.video).not.toHaveProperty("level");
  const ready = outputCapabilities({
    ...inventory,
    hevc: { ...inventory.hevc, ready: true, probeStatus: 0 },
  });
  expect(ready.hevc.ready).toBe(true);
});

test("HEVC requests refuse H264 profile, entropy and level rather than ignoring them", () => {
  for (const video of [
    { codec: "hevc", profile: "high" },
    { codec: "hevc", entropy: "cabac" },
    { codec: "hevc", level: "auto" },
    { codec: "hevc", profile: "main10" },
  ])
    expect(() => resolveOutputSettings({ video } as never)).toThrow();
});

test("omission, preset defaults and fully explicit output canonicalize identically", () => {
  const output = resolveOutputSettings();
  expect(resolveOutputSettings({ preset: "balanced" })).toEqual(output);
  expect(resolveOutputSettings(output)).toEqual(output);
  expect(
    resolveOutputSettings({ preset: "compact", video: { rateControl: output.video.rateControl } }),
  ).toEqual(output);
  expect(resolveOutputSettings({ video: { keyframeInterval: 12 } }).video.keyframeInterval).toBe(
    12,
  );
});
test("unknown, contradictory and unsupported settings fail instead of being substituted", () => {
  expect(outputSettingsSchema.safeParse({ video: { bitrate: 123 } }).success).toBe(false);
  for (const input of [
    { video: { profile: "baseline" } },
    { video: { openGop: true } },
    { video: { minimumQuantizer: 40, maximumQuantizer: 20 } },
    {
      video: {
        rateControl: { mode: "constant", bitrate: 4000000 },
        dataRateLimits: [{ bytes: 1000000, seconds: 1 }],
      },
    },
  ])
    expect(() => resolveOutputSettings(input as never)).toThrow();
});
test("authored replay identity is stable when a preset changes", () => {
  const input = { preset: "balanced" as const, video: { keyframeInterval: 40 } };
  const request = normalizeOutputRequest(input);
  const frozen = resolveOutputSettings(input);
  const before = outputPresets.balanced.video.rateControl;
  try {
    outputPresets.balanced.video.rateControl = { mode: "average", bitrate: 7000000 };
    expect(normalizeOutputRequest(input)).toEqual(request);
    expect(resolveOutputSettings(input)).not.toEqual(frozen);
    expect(resolveOutputSettings(frozen)).toEqual(frozen);
  } finally {
    outputPresets.balanced.video.rateControl = before;
  }
});

test("automatic encoder guidance and low-rate AAC remain authored choices", () => {
  const request = {
    video: {
      keyframeInterval: 0,
      keyframeIntervalSeconds: 0,
      lookAheadFrames: 8,
      rateControl: { mode: "average" as const, bitrate: 0 },
    },
    audio: {
      sampleRate: 16000,
      layout: "mono" as const,
      rateControl: { mode: "constant" as const, bitrate: 192000 },
    },
  };
  const resolved = resolveOutputSettings(request);
  expect(resolved.video).toMatchObject(request.video);
  expect(resolved.audio).toMatchObject(request.audio);
  expect(resolveOutputSettings(resolved)).toEqual(resolved);
});

test("encoder selection keeps 64-bit GPU identity and rejects conflicting hardware policy", () => {
  expect(
    resolveOutputSettings({ video: { encoder: { hardware: "required" } } }).video.encoder,
  ).toEqual({ hardware: "required", id: null, gpu: null });
  const encoder = {
    hardware: "required" as const,
    id: "test.encoder",
    gpu: { policy: "required" as const, registryId: "18446744073709551615" },
  };
  expect(resolveOutputSettings({ video: { encoder } }).video.encoder).toEqual(encoder);
  expect(() =>
    resolveOutputSettings({ video: { encoder: { ...encoder, hardware: "disabled" } } }),
  ).toThrow(/GPU/);
  expect(() =>
    resolveOutputSettings({
      video: {
        encoder: { ...encoder, gpu: { ...encoder.gpu, registryId: "18446744073709551616" } },
      },
    }),
  ).toThrow();
});

test("look-ahead intent is refused when the SDK would ignore it", () => {
  expect(() =>
    resolveOutputSettings({
      video: { rateControl: { mode: "quality", quality: 1 }, lookAheadFrames: 8 },
    }),
  ).toThrow(/Look-ahead/);
});

test("audio settings resolve independently and refuse video or unsupported PCM renditions", () => {
  expect(resolveAudioOutputSettings()).toEqual({
    container: "wav",
    audio: { codec: "pcm-f32", sampleRate: 48000, layout: "stereo" },
  });
  expect(resolveAudioOutputSettings({ container: "m4a" }).audio.codec).toBe("aac");
  for (const input of [
    { video: {} },
    { preset: "balanced" },
    { container: "mp3" },
    { container: "wav", audio: { sampleRate: 44100 } },
    { container: "wav", audio: { layout: "mono" } },
  ])
    expect(() => resolveAudioOutputSettings(input as never)).toThrow();
});

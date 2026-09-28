import { expect, test } from "vitest";
import {
  normalizeOutputRequest,
  outputPresets,
  outputSettingsSchema,
  resolveOutputSettings,
} from "./output-settings.js";

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
    { audio: { layout: "mono" } },
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

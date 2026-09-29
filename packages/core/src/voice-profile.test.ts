import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { resolveVoiceSettings, voiceProfileSha256, voiceReceiptSchema } from "./voice-profile.js";

test("the frozen recipe retains requested repetition and exact seed while exposing its effective clamp", () => {
  const result = resolveVoiceSettings();
  expect(result.seed).toBe("18");
  expect(result.requested).toMatchObject({
    temperature: 0.9,
    repetition_penalty: 1.05,
    max_tokens: 256,
  });
  expect(result.effective.repetition_penalty).toBe(1.5);
  const full = resolveVoiceSettings(
    {
      max_tokens: 512,
      temperature: 0,
      top_k: 0,
      top_p: 0.8,
      repetition_penalty: 1.8,
      lang_code: "auto",
    },
    "18446744073709551615",
  );
  expect(full.seed).toBe("18446744073709551615");
  expect(full.effective).toEqual(full.requested);
  expect(full.effective).toMatchObject({
    temperature: 0,
    top_k: 0,
    top_p: 0.8,
    repetition_penalty: 1.8,
    max_tokens: 512,
    lang_code: "auto",
  });
});

test("unsupported controls and numerically unusable inputs refuse rather than silently falling back", () => {
  for (const input of [
    { speed: 1 },
    { stream: true },
    { temperature: 1e-38 },
    { temperature: Infinity },
    { temperature: true },

    { top_p: -1 },
    { top_k: -1 },
    { top_k: 1.5 },
    { lang_code: "unknown" },
    { repetition_penalty: 0 },
    { repetition_penalty: 1e308 },
    { max_tokens: 513 },
  ])
    expect(() => resolveVoiceSettings(input)).toThrow(
      expect.objectContaining({ code: "INVALID_REQUEST" }),
    );
  for (const seed of [18, true, "01", "-1", "1.0", "18446744073709551616"])
    expect(() => resolveVoiceSettings({}, seed)).toThrow(
      expect.objectContaining({ code: "INVALID_REQUEST" }),
    );
});

test("the registered artifact carries the exact discoverable profile bytes", () => {
  expect(
    createHash("sha256")
      .update(readFileSync(new URL("./model-data/voice-profile-v1.json", import.meta.url)))
      .digest("hex"),
  ).toBe(voiceProfileSha256);
});

test("admitted signed zero retains JSON-wire receipt equality", () => {
  const result = resolveVoiceSettings({ temperature: -0, top_k: -0 });
  expect(Object.is(result.requested.temperature, -0)).toBe(false);
  expect(Object.is(result.requested.top_k, -0)).toBe(false);
});

test("filter modes report greedy bypass and independent codebook top-k disabling", () => {
  expect(resolveVoiceSettings({ temperature: 0, top_k: 1, top_p: 0.8 }).filterModes).toEqual({
    sampling: "greedy",
    firstBookTopK: "bypassed",
    residualTopK: "bypassed",
    nucleus: "bypassed",
  });
  expect(resolveVoiceSettings({ top_k: 2048 }).filterModes).toEqual({
    sampling: "categorical",
    firstBookTopK: "enabled",
    residualTopK: "disabled",
    nucleus: "disabled",
  });
  expect(resolveVoiceSettings({ top_k: 0, top_p: 0.8 }).filterModes).toEqual({
    sampling: "categorical",
    firstBookTopK: "disabled",
    residualTopK: "disabled",
    nucleus: "enabled",
  });
});

test("the repaired profile admits the complete positive binary64 top-p domain", () => {
  for (const top_p of [Number.MIN_VALUE, 2 ** -9, 0.01, 1])
    expect(resolveVoiceSettings({ top_p }).requested.top_p).toBe(top_p);
});

test("nucleus boundaries preserve wire zeros and distinguish disabling from filtering", () => {
  for (const top_p of [0, -0, Number.MIN_VALUE, 1 - Number.EPSILON / 2, 1]) {
    const result = resolveVoiceSettings({ top_p });
    expect(Object.is(result.requested.top_p, -0)).toBe(false);
    expect(result.filterModes.nucleus).toBe(top_p === 0 || top_p === 1 ? "disabled" : "enabled");
  }
});

test("receipt settings never invent omitted worker fields from request defaults", () => {
  const settings = resolveVoiceSettings().requested;
  const { top_p, ...incomplete } = settings;
  expect(voiceReceiptSchema.shape.generation.safeParse(incomplete).success).toBe(false);
  expect(voiceReceiptSchema.shape.generation.parse(settings)).toEqual(settings);
});

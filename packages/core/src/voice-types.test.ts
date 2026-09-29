import { expect, test } from "vitest";
import { voiceGenerationSchema, voiceReceiptSchema, voiceSeedSchema } from "./voice-types.js";

const settings = {
  temperature: 0.9,
  top_k: 50,
  top_p: 1,
  repetition_penalty: 1.05,
  max_tokens: 4096,
  lang_code: "historical-language",
  stream: false,
};

test("historical provenance has structural validation independent of current execution limits", () => {
  expect(voiceGenerationSchema.parse(settings)).toEqual(settings);
  const context = {
    referenceTextTokens: 4000,
    targetTextTokens: 8000,
    referenceCodes: 500,
    inputTokens: 12500,
    referenceTextTokenSha256: "a".repeat(64),
    targetTextTokenSha256: "b".repeat(64),
  };
  expect(voiceReceiptSchema.shape.prefill.parse(context)).toEqual(context);
});

test("durable receipt fields are explicit and never silently discard unknown metadata", () => {
  const { top_p, ...missing } = settings;
  expect(voiceGenerationSchema.safeParse(missing).success).toBe(false);
  expect(
    voiceGenerationSchema.safeParse({ ...settings, futureMetadata: "retained-or-refused" }).success,
  ).toBe(false);
  expect(voiceGenerationSchema.safeParse({ ...settings, temperature: Infinity }).success).toBe(
    false,
  );
});

test("canonical unsigned seeds preserve every bit and refuse malformed decimal input", () => {
  expect(voiceSeedSchema.parse("18446744073709551615")).toBe("18446744073709551615");
  for (const value of [
    18,
    "01",
    "-0",
    "1.0",
    "1\n",
    "1\r",
    "1\u2028",
    "1\u2029",
    "18446744073709551616",
  ])
    expect(voiceSeedSchema.safeParse(value).success).toBe(false);
});

test("content hashes reject trailing line terminators", () => {
  for (const ending of ["\n", "\r", "\u2028", "\u2029"])
    expect(voiceReceiptSchema.shape.sha256.safeParse("a".repeat(64) + ending).success).toBe(false);
});

import { z } from "zod";
export type TimeRange = Readonly<{ startUs: number; endUs: number }>;
export type RenderSpan = Readonly<{ source: TimeRange; playback: TimeRange }>;
export function renderPlan(
  input: Readonly<{ spans: readonly TimeRange[] }>,
): readonly RenderSpan[] {
  let atUs = 0;
  return input.spans.map((source) => {
    const playback = { startUs: atUs, endUs: atUs + (source.endUs - source.startUs) };
    atUs = playback.endUs;
    return { source, playback };
  });
}

const integer = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const presentationTimeSchema = z.strictObject({
  value: z
    .string()
    .regex(/^(0|[1-9]\d{0,18})$/)
    .refine((v) => BigInt(v) <= 9_223_372_036_854_775_807n),
  timescale: integer.min(1).max(2_147_483_647),
});
export type PresentationTime = z.infer<typeof presentationTimeSchema>;
/** Runtime comparisons also accept exact compiler instants beyond physical clock scales. */
export type PresentationInstant = Omit<PresentationTime, "timescale"> & {
  timescale: number | bigint;
};
export function comparePresentationTimes(a: PresentationInstant, b: PresentationInstant) {
  const delta = BigInt(a.value) * BigInt(b.timescale) - BigInt(b.value) * BigInt(a.timescale);
  return delta < 0n ? -1 : delta > 0n ? 1 : 0;
}
export const microsecondTime = (value: number): PresentationTime => ({
  value: String(value),
  timescale: 1_000_000,
});
export const roundedMicroseconds = (time: PresentationInstant) =>
  Number(
    (BigInt(time.value) * 2_000_000n + BigInt(time.timescale)) / (2n * BigInt(time.timescale)),
  );

export const floorMicroseconds = (time: PresentationInstant) =>
  Number((BigInt(time.value) * 1_000_000n) / BigInt(time.timescale));
export const ceilMicroseconds = (time: PresentationInstant) =>
  Number((BigInt(time.value) * 1_000_000n + BigInt(time.timescale) - 1n) / BigInt(time.timescale));

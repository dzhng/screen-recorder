import { z } from "zod";
const integer = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const presentationTimeSchema = z.strictObject({
  value: z
    .string()
    .regex(/^(0|[1-9]\d{0,18})$/)
    .refine((v) => BigInt(v) <= 9_223_372_036_854_775_807n),
  timescale: integer.min(1).max(2_147_483_647),
});
export type PresentationTime = z.infer<typeof presentationTimeSchema>;
export function comparePresentationTimes(a: PresentationTime, b: PresentationTime) {
  const delta = BigInt(a.value) * BigInt(b.timescale) - BigInt(b.value) * BigInt(a.timescale);
  return delta < 0n ? -1 : delta > 0n ? 1 : 0;
}
export const microsecondTime = (value: number): PresentationTime => ({
  value: String(value),
  timescale: 1_000_000,
});
export const roundedMicroseconds = (time: PresentationTime) =>
  Number(
    (BigInt(time.value) * 2_000_000n + BigInt(time.timescale)) / (2n * BigInt(time.timescale)),
  );

export const floorMicroseconds = (time: PresentationTime) =>
  Number((BigInt(time.value) * 1_000_000n) / BigInt(time.timescale));
export const ceilMicroseconds = (time: PresentationTime) =>
  Number((BigInt(time.value) * 1_000_000n + BigInt(time.timescale) - 1n) / BigInt(time.timescale));

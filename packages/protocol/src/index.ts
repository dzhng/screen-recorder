import { z } from "zod";

export const requestSchema = z
  .object({
    id: z.string().min(1),
    operation: z.string().min(1),
    params: z.record(z.string(), z.unknown()),
  })
  .strict();

export type OperationRequest = z.infer<typeof requestSchema>;

export function parseRequest(value: unknown): OperationRequest {
  return requestSchema.parse(value);
}

const operationErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string(),
  retryable: z.boolean(),
  details: z.record(z.string(), z.unknown()),
});
const successSchema = z.object({ ok: z.literal(true), data: z.unknown() });
const failureSchema = z.object({ ok: z.literal(false), error: operationErrorSchema });
export const resultSchema = z.discriminatedUnion("ok", [successSchema, failureSchema]);
export const responseSchema = z.discriminatedUnion("ok", [
  successSchema.extend({ id: requestSchema.shape.id }),
  failureSchema.extend({ id: requestSchema.shape.id }),
]);
export type OperationResult = z.infer<typeof resultSchema>;
export type OperationResponse = z.infer<typeof responseSchema>;
export * from "./framing.js";

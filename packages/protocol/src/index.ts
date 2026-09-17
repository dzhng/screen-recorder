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

export const operationErrorSchema = z.object({
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
export type OperationFailure = Extract<OperationResult, { ok: false }>;

/** The one shape every peer refuses an operation with. */
export function operationError(
  code: string,
  message: string,
  retryable = false,
  details: Record<string, unknown> = {},
): OperationFailure {
  return { ok: false, error: { code, message, retryable, details } };
}

// The app's inherited pipe carries many frames from one trusted peer, so an
// unparsable request has no trustworthy correlation ID and answers with a null one
// instead of closing the channel the way a single-request socket does.
export const controlResponseSchema = z.discriminatedUnion("ok", [
  successSchema.extend({ id: requestSchema.shape.id }),
  failureSchema.extend({ id: requestSchema.shape.id.nullable() }),
]);
export const controlMessageSchema = z.discriminatedUnion("event", [
  z
    .object({
      event: z.literal("started"),
      pid: z.int().positive(),
      socketPath: z.string().min(1),
    })
    .strict(),
  z.object({ event: z.literal("failed"), error: operationErrorSchema }).strict(),
  z.object({ event: z.literal("result"), response: controlResponseSchema }).strict(),
  z.object({ event: z.literal("call"), request: requestSchema }).strict(),
]);

// The same channel the other way round. Both peers issue calls and both answer them, so each
// direction carries one labelled message kind rather than a shape the reader has to guess at.
export const appMessageSchema = z.discriminatedUnion("event", [
  z.object({ event: z.literal("request"), request: requestSchema }).strict(),
  z.object({ event: z.literal("result"), response: controlResponseSchema }).strict(),
]);
export type ControlResponse = z.infer<typeof controlResponseSchema>;
export type ControlMessage = z.infer<typeof controlMessageSchema>;

export * from "./capture.js";
export * from "./framing.js";
export * from "./operations.js";

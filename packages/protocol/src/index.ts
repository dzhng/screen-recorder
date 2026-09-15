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

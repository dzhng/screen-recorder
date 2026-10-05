import { z } from "zod";

/** Stable reasons name lifetime owners, never inferred permission to cancel their work. */
export const updateBlockerSchema = z.enum([
  "requests",
  "transport",
  "jobs",
  "capture",
  "publication",
  "deletion",
  "packages",
  "delivery",
  "models",
  "storage",
  "startup",
]);
export const updateStatusSchema = z.strictObject({
  state: z.enum([
    "unavailable",
    "disabled",
    "idle",
    "checking",
    "downloading",
    "waiting",
    "installing",
    "failed",
  ]),
  availableVersion: z.string().min(1).nullable(),
  blockers: z.array(z.string().min(1)),
  error: z
    .strictObject({ code: z.string().min(1), message: z.string(), retryable: z.boolean() })
    .nullable(),
});
export type UpdateStatus = z.infer<typeof updateStatusSchema>;
export type UpdateBlocker = z.infer<typeof updateBlockerSchema>;
export const updateControlSchema = z.discriminatedUnion("operation", [
  z.strictObject({ operation: z.literal("update.prepare"), params: z.strictObject({}) }),
  z.strictObject({
    operation: z.literal("update.commit"),
    params: z.strictObject({ permitId: z.string().min(1) }),
  }),
  z.strictObject({
    operation: z.literal("update.release"),
    params: z.strictObject({ permitId: z.string().min(1) }),
  }),
  z.strictObject({
    operation: z.literal("update.report"),
    params: z.strictObject({ update: updateStatusSchema }),
  }),
]);
export const updatePreparationSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("blocked"), blockers: z.array(updateBlockerSchema) }),
  z.strictObject({ kind: z.literal("prepared"), permitId: z.string().min(1) }),
]);
export const updateControlOperations: ReadonlySet<string> = new Set(
  updateControlSchema.options.map((schema) => schema.shape.operation.value),
);

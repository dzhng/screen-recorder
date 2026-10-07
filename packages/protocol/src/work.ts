import { z } from "zod";

/** Retained publication identity is separate from a replacement job's attempt. */
export function publishedOutputSchema<T extends z.ZodType>(output: T) {
  return z.object({
    generation: z.union([z.int().positive().max(Number.MAX_SAFE_INTEGER), z.string().min(1)]),
    attemptId: z.string().min(1).optional(),
    output,
  });
}

/** Expose one domain payload without leaking a queue recipe or serialized worker result. */
export function publishedOutput<
  Publication extends { generation: number | string; attemptId?: string },
  Output,
>(publication: Publication | null, output: (publication: Publication) => Output) {
  return publication
    ? {
        generation: publication.generation,
        ...(publication.attemptId === undefined ? {} : { attemptId: publication.attemptId }),
        output: output(publication),
      }
    : null;
}

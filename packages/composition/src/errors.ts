export class CompositionError extends Error {
  constructor(
    readonly code:
      | "INVALID_COMPOSITION"
      | "INVALID_TIME"
      | "UNKNOWN_CLIP"
      | "UNKNOWN_SOURCE"
      | "INVALID_EDIT"
      | "NOT_READY"
      | "LIMIT_EXCEEDED"
      | "UNSUPPORTED_FORMAT",
    message: string,
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "CompositionError";
  }
}

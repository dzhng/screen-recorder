/** Selected-app tool evidence; inventory does not imply core operation support. */
export type FFmpegToolAvailability =
  | { available: false; code: "FFMPEG_UNAVAILABLE"; message: string }
  | {
      available: true;
      directory: string;
      receiptSha256: string;
      version: string;
      configuration: string;
      recipeSha256: string;
      sourceSha256: string;
      executables: Record<"ffmpeg" | "ffprobe", { path: string; sha256: string }>;
    };

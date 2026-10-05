import { CatalogError } from "@screenrec/core/catalog";
import { CONTROL_FRAME_BYTES, encodeJsonLine, personalHome } from "@screenrec/protocol";
import { startProjectService } from "./project-service.js";
import { StartupFailure } from "./startup.js";
import { readFileSync } from "node:fs";

// Release packaging may add the running release to the adjacent runtime manifest.
// Missing metadata is the ordinary standalone/personal-build path.
let version: string | null = null;
try {
  const metadata = JSON.parse(readFileSync(new URL("./runtime.json", import.meta.url), "utf8"));
  if (typeof metadata.version === "string" && metadata.version.length) version = metadata.version;
} catch {}

try {
  const service = await startProjectService({
    home: personalHome(),
    ffmpeg: process.env.SCREENREC_FFMPEG_DIRECTORY
      ? {
          directory: process.env.SCREENREC_FFMPEG_DIRECTORY,
          receiptSha256: process.env.SCREENREC_FFMPEG_RECEIPT_SHA256 ?? "",
        }
      : undefined,
    version,
    control: { input: process.stdin, output: process.stdout },
  });
  for (const signal of ["SIGTERM", "SIGINT", "SIGHUP"] as const)
    process.on(signal, () => {
      void service.close();
    });
} catch (error) {
  const typed = error instanceof CatalogError || error instanceof StartupFailure;
  process.stdout.write(
    encodeJsonLine(
      {
        event: "failed",
        error: {
          code: typed ? error.code : "SERVICE_UNAVAILABLE",
          message: (error instanceof Error ? error.message : String(error)).slice(0, 2_000),
          retryable: error instanceof CatalogError ? error.retryable : false,
          details: error instanceof CatalogError ? error.details : {},
        },
      },
      CONTROL_FRAME_BYTES,
    ),
  );
  process.exitCode = 1;
}

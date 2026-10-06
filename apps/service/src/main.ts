import { CatalogError } from "@yap/core/catalog";
import { CONTROL_FRAME_BYTES, encodeJsonLine, personalHome } from "@yap/protocol";
import { startProjectService } from "./project-service.js";
import { StartupFailure } from "./startup.js";
import { readFileSync } from "node:fs";
import appManifest from "../../macos/package.json" with { type: "json" };

// Installed runtime metadata records the assembled app; standalone builds use its manifest.
let version = appManifest.version;
try {
  const metadata = JSON.parse(readFileSync(new URL("./runtime.json", import.meta.url), "utf8"));
  if (typeof metadata.version === "string" && metadata.version.length) version = metadata.version;
} catch {}

try {
  const service = await startProjectService({
    home: personalHome(),
    ffmpeg: process.env.YAP_FFMPEG_DIRECTORY
      ? {
          directory: process.env.YAP_FFMPEG_DIRECTORY,
          receiptSha256: process.env.YAP_FFMPEG_RECEIPT_SHA256 ?? "",
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

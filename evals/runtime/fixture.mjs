import { createServer } from "node:net";
import { appendFile } from "node:fs/promises";

export async function failedJobFixture() {
  const server = createServer((socket) => {
    let bytes = "";
    socket.on("data", async (chunk) => {
      bytes += chunk;
      if (!bytes.includes("\n")) return;
      const request = JSON.parse(bytes.slice(0, bytes.indexOf("\n")));
      await appendFile("/sandbox/service-calls.jsonl", JSON.stringify(request) + "\n");
      const response =
        request.operation === "job.get" && request.params.jobId === "audit-job"
          ? {
              id: request.id,
              ok: true,
              data: {
                jobId: "audit-job",
                attemptId: "audit-attempt",
                target: { kind: "asset", assetId: "audit-asset" },
                artifact: "audio",
                lane: "heavy",
                state: "failed",
                reason: "The scripted preparation attempt failed.",
                errorCode: "AUDIT_FIXTURE_FAILURE",
                errorDetails: null,
                retryable: false,
                generation: 1,
                inputSha256: "0".repeat(64),
                result: null,
              },
            }
          : {
              id: request.id,
              ok: false,
              error: {
                code: "UNSUPPORTED",
                message: "This read-only fixture supplies only job.get for audit-job.",
                retryable: false,
              },
            };
      socket.end(JSON.stringify(response) + "\n");
    });
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen("/sandbox/service.sock", resolve);
  });
  return () => new Promise((resolve) => server.close(resolve));
}

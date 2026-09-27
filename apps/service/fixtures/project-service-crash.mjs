import { startProjectService } from "../dist/project-service.js";

const service = await startProjectService({
  home: process.argv[2],
  worker: async (_operation, _params, options) => {
    process.send({ phase: "owned-copy-probing" });
    await new Promise((resolve) =>
      options.signal.addEventListener("abort", resolve, { once: true }),
    );
    return {
      ok: false,
      error: { code: "CANCELED", message: "closed", retryable: true, details: {} },
    };
  },
});
process.send({ socketPath: service.socketPath });
process.on("message", async (message) => {
  if (message === "close") {
    await service.close();
    process.disconnect();
  }
});

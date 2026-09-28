import { startProjectService } from "../../../apps/service/dist/project-service.js";
try {
  const service = await startProjectService({ home: process.argv[2] });
  let closing;
  const close = () =>
    (closing ??= (async () => {
      await service.close();
      if (process.connected) process.disconnect();
    })());
  const shutdown = () => {
    void close().catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
  };
  process.send({ socketPath: service.socketPath });
  process.on("message", (message) => {
    if (message === "close") shutdown();
  });
  process.on("disconnect", shutdown);
} catch (error) {
  process.send({ error: { code: error.code, message: error.message, retryable: error.retryable } });
  process.disconnect();
  process.exitCode = 1;
}

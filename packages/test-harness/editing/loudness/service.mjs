import { startProjectService } from "../../../../apps/service/dist/project-service.js";
import { mediaWorker } from "../../../../apps/service/dist/worker.js";
const service = await startProjectService({
  home: process.argv[2],
  worker: mediaWorker(),
  ffmpeg: JSON.parse(process.env.SCREENREC_TEST_FFMPEG),
});
let closing;
const close = () => (closing ??= service.close().then(() => process.disconnect()));
process.on("message", (message) => {
  if (message === "close") void close();
});
process.on("disconnect", () => {
  void close();
});
process.send({ socketPath: service.socketPath });

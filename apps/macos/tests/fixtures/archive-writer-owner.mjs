import { open, readFile } from "node:fs/promises";
import { join } from "node:path";
import { writeArchive } from "../../../service/dist/archive-write.js";
import { mediaWorker } from "../../../service/dist/worker.js";
const [root, binary, library, marker] = process.argv.slice(2);
const worker = mediaWorker({ YAP_NATIVE: binary });
const wrapped = (operation, params, options) => {
  if (operation !== "archive.write") return worker(operation, params, options);
  const environment = {
    DYLD_INSERT_LIBRARIES: library,
    YAP_TEST_COPY_BARRIER: marker,
    YAP_TEST_COPY_PARTIAL: "1",
    YAP_TEST_COPY_MIN_FD: "6",
  };
  Object.assign(process.env, environment);
  try {
    return worker(operation, params, options);
  } finally {
    for (const key of Object.keys(environment)) delete process.env[key];
  }
};
const plan = await open(join(root, "plan"));
const members = JSON.parse(await readFile(join(root, "plan"), "utf8"));
await writeArchive(
  {
    handle: await open(join(root, "input")),
    plan,
    bytes: members.reduce((total, member) => total + member.bytes, 0),
  },
  { directory: join(root, "scratch"), handle: await open(join(root, "scratch")) },
  wrapped,
);
throw new Error("Stopped writer unexpectedly completed");

import { spawn } from "node:child_process";
import { once } from "node:events";
import { open, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { provisionPackageWorkspace } from "../../dist/package-workspace.js";
import { mediaWorker } from "../../dist/worker.js";
const directory = process.argv[2];
const native = process.env.SCREENREC_NATIVE;
const parent = { directory, handle: await open(directory) };
const owner = await provisionPackageWorkspace(parent, mediaWorker({ SCREENREC_NATIVE: native }));
await writeFile(join(owner.directory, "data"), "held by inherited native descriptor");
const child = spawn(native, [], { stdio: ["pipe", "ignore", "inherit", owner.handle.fd] });
const childClosed = once(child, "close");
await once(child, "spawn");
child.kill("SIGSTOP");
process.send({ pid: child.pid, name: owner.name });
process.on("message", () => {});

await new Promise((resolve) => process.once("disconnect", resolve));
try {
  child.kill("SIGKILL");
  await childClosed;
} finally {
  await Promise.all([owner.handle.close(), parent.handle.close()]);
}

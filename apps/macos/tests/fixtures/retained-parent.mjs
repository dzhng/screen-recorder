import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { constants } from "node:fs";
import { open } from "node:fs/promises";
import { openPackageArchive } from "../../../service/dist/package-archive.js";
import { mediaWorker } from "../../../service/dist/worker.js";

const [archive, directory, native] = process.argv.slice(2);
const handle = await open(
  directory,
  constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
);
const run = mediaWorker({ SCREENREC_NATIVE: native });
const worker = async (operation, params, options) => {
  const pending = run(operation, params, options);
  if (operation !== "media.frame") return pending;
  const rows = execFileSync("/bin/ps", ["-axo", "pid=,ppid=,command="], { encoding: "utf8" }).split(
    "\n",
  );
  const owned = rows
    .map((row) => row.trim().match(/^(\d+)\s+(\d+)\s+(.+)$/))
    .find((row) => row && Number(row[2]) === process.pid && row[3] === native);
  assert.ok(owned, "native worker must be alive before killing its parent");
  const pid = Number(owned[1]);
  process.kill(pid, "SIGSTOP");
  assert.match(
    execFileSync("/bin/ps", ["-p", String(pid), "-o", "state="], { encoding: "utf8" }).trim(),
    /^T/,
  );
  process.send({ nativePid: pid });
  return pending;
};
const context = await openPackageArchive(archive, { directory, handle }, worker);
await context.run("media.frame", {
  source: "source/video.mov",
  output: "held",
  atSourceUs: 1_100_000,
  kept: { startUs: 0, endUs: 4_000_000 },
  overlay: null,
});
throw new Error("Native worker unexpectedly escaped the stopped-parent barrier");

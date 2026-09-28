import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { JourneyService } from "./source-evidence-fixture.mjs";

const directory = await mkdtemp(join(tmpdir(), "sr-svc-"));
const invalidHome = join(directory, "not-a-directory");
await writeFile(invalidHome, "authored startup failure");
const failed = new JourneyService(invalidHome, { trace: [] });
let service;
try {
  await assert.rejects(
    async () => {
      try {
        await failed.start();
      } finally {
        await failed.stop();
      }
    },
    /ENOTDIR/,
    "Cleanup must preserve the startup diagnostic",
  );
  assert.notEqual(
    failed.child.exitCode,
    null,
    "Failed startup left a child running",
  );
  const home = join(directory, "healthy");
  await mkdir(home);
  service = new JourneyService(home, { trace: [] });
  for (const crash of [false, true, false]) {
    await service.start();
    await service.call("project.list", {}, { transport: crash ? "mcp" : "cli" });
    await service.stop(crash);
    assert.equal(service.child.connected, false);
    await service.stop(crash);
  }
  console.log(
    "Startup failure diagnostic, graceful stop, crash and restart passed",
  );
} finally {
  await service?.stop();
  await rm(directory, { recursive: true, force: true });
}

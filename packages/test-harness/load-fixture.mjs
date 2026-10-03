// Admit the retained take without changing its media or authoring an editing project.
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import {
  startPublicService,
  importAcquisition,
} from "../../apps/macos/tests/fixtures/public-service.mjs";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const { values } = parseArgs({
  options: {
    home: { type: "string" },
    fixture: { type: "string", default: join(root, "fixtures/narrated-workbench") },
  },
});
const home = values.home ? resolve(values.home) : await mkdtemp("/tmp/screenrec-fixture-home-");
const service = await startPublicService(home, process.env.SCREENREC_NATIVE);
try {
  const before = await service.call("project.list", {});
  assert.equal(before.ok, true, JSON.stringify(before));
  const { acquisition } = await importAcquisition(service, resolve(values.fixture));
  const projects = await service.call("project.list", {});
  assert.equal(projects.ok, true, JSON.stringify(projects));
  assert.deepEqual(projects.data.projects, before.data.projects);
  console.log(
    JSON.stringify(
      { home, acquisitionId: acquisition.id, bindings: acquisition.bindings },
      null,
      2,
    ),
  );
} finally {
  await service.close();
}

// Puts the checked-in narrated take into a library of its own, so a check can run the real
// journey without touching a person's own recordings.
//
//   node packages/test-harness/load-fixture.mjs [--home <directory>] [--fixture <directory>]
//
// It prints the home and recording ID it created. Transcription, scenes and the screenshot index
// are derived, so they are not stored here: the service prepares them from this source media.
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { mkdtempSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { RevisionStore } from "@screenrec/core/library";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const { values } = parseArgs({
  options: {
    home: { type: "string" },
    fixture: { type: "string", default: join(root, "fixtures/narrated-workbench") },
  },
});
const home = values.home ?? mkdtempSync("/tmp/screenrec-fixture-home-");
const described = JSON.parse(readFileSync(join(values.fixture, "recording.json"), "utf8"));

const store = new RevisionStore(join(home, "library.sqlite"), {
  now: () => new Date().toISOString(),
  newId: randomUUID,
});
const take = store.allocate().recording;
for (const [index, state] of ["recording", "finalizing"].entries())
  store.ingestLifecycle(take.recordingId, { sourceId: take.sourceId, sequence: index + 1, state });
store.ingestLifecycle(take.recordingId, {
  sourceId: take.sourceId,
  sequence: 3,
  state: described.state,
  sourceDurationUs: described.sourceDurationUs,
  ...(described.state === "interrupted" ? { reason: "fixture" } : {}),
});
store.close();

// The journal names the session that wrote it, and the catalog must agree with that name.
const source = join(home, "recordings", take.recordingId, "source");
await mkdir(source, { recursive: true, mode: 0o700 });
for (const name of ["video.mov", "narration.mov"])
  await copyFile(join(values.fixture, name), join(source, name));
const journal = readFileSync(join(values.fixture, "capture.journal.jsonl"), "utf8").replaceAll(
  described.sourceId,
  take.sourceId,
);
await writeFile(join(source, "capture.journal.jsonl"), journal);

console.log(JSON.stringify({ home, recordingId: take.recordingId }, null, 2));

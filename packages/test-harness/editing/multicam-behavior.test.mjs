import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const root = new URL("../../../", import.meta.url).pathname;
const fixtures = join(root, "fixtures/video-editing-feedback/synchronization");
const recipe = join(root, "specs/video-editing-feedback/assets/01-corpus-multicam/behavior-recipe.json");
const identity = join(
  root,
  "specs/video-editing-feedback/assets/01-corpus-multicam/behavior-recipe.identity.json",
);

test("replays caller-authored multicam source choices over physical audio and picture evidence", async () => {
  const { verifyMulticamBehavior } = await import("./multicam-behavior.mjs");
  const report = await verifyMulticamBehavior(fixtures, recipe, identity);
  assert.equal(report.ok, true);
  assert.equal(report.synchronization, "not-established");
  assert.equal(report.cameraChoice, "caller-authored");
  assert.equal(report.selectionCount, 9);
  assert.deepEqual(report.sources, ["grahamRaw", "lilyRawP1", "madisonRaw"]);
  assert.ok(report.selections.every((selection) => selection.audioPcmSha256.length === 64));
  assert.ok(report.selections.every((selection) => selection.pictureSha256.length === 64));
});

test("refuses a recipe that assigns a picture from another source", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "yap-multicam-behavior-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const sourceRecipe = JSON.parse(await readFile(recipe, "utf8"));
  sourceRecipe.selections[0].pictureSource = "lilyRawP1";
  const bytes = Buffer.from(JSON.stringify(sourceRecipe, null, 2) + "\n");
  await writeFile(join(directory, "recipe.json"), bytes);
  await writeFile(
    join(directory, "identity.json"),
    JSON.stringify({ recipeSha256: createHash("sha256").update(bytes).digest("hex") }),
  );
  const { verifyMulticamBehavior } = await import("./multicam-behavior.mjs");
  await assert.rejects(
    verifyMulticamBehavior(fixtures, join(directory, "recipe.json"), join(directory, "identity.json")),
    { code: "PICTURE_SELECTION" },
  );
});

test("refuses a recipe with duplicate or missing source windows", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "yap-multicam-behavior-shape-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const sourceRecipe = JSON.parse(await readFile(recipe, "utf8"));
  sourceRecipe.selections.pop();
  const bytes = Buffer.from(JSON.stringify(sourceRecipe, null, 2) + "\n");
  await writeFile(join(directory, "recipe.json"), bytes);
  await writeFile(
    join(directory, "identity.json"),
    JSON.stringify({ recipeSha256: createHash("sha256").update(bytes).digest("hex") }),
  );
  const { verifyMulticamBehavior } = await import("./multicam-behavior.mjs");
  await assert.rejects(
    verifyMulticamBehavior(fixtures, join(directory, "recipe.json"), join(directory, "identity.json")),
    { code: "SELECTION_COVERAGE" },
  );
});

import assert from "node:assert/strict";
import { constants } from "node:fs";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { rational, toTime } from "../../composition/dist/index.js";
import { realCaptureFixture } from "./capture-evidence-fixture.mjs";
import { hash, poll, root } from "./source-evidence-fixture.mjs";

/** Retained input clocks are the oracle; public identities and generations are freshly admitted. */
export async function sourceEventDurationFixture({ mode, home, out, call }) {
  await mkdir(out, { recursive: true });
  const sourceRange =
    mode === "events" ? { startUs: 350000, endUs: 450000 } : { startUs: 49814, endUs: 100658 };
  let directory, sourceRows, normalization;
  const files = {};
  if (mode === "events") {
    const retained = join(root, "specs/agent-editing/assets/10d-public-scenes");
    const movie = await readFile(join(retained, "authored-source.mov"));
    assert.equal(hash(movie), "491d34c0c2bff15f01d8be032bafa4ca1a96f6244ddc4ba2738bf7673678b49e");
    const journal = await readFile(join(retained, "journal.json"));
    assert.equal(hash(journal), "652c24a9ed9fc1b15847c6ea4142099ef49294343a415967b2ab4217f72fb7c4");
    directory = join(home, "scene-donor");
    await mkdir(directory);
    await copyFile(
      join(retained, "authored-source.mov"),
      join(directory, "video.mov"),
      constants.COPYFILE_FICLONE,
    );
    await writeFile(
      join(directory, "capture.journal.jsonl"),
      JSON.parse(journal).map(JSON.stringify).join("\n") + "\n",
    );
    files["journal.json"] = hash(journal);
    sourceRows = [
      {
        kind: "pause",
        sourceAtUs: 400000,
        captureAtUs: 650000,
        sourceSequence: 1,
        observation: { atSourceUs: 650000, elapsedPauseUs: 17 },
      },
      {
        kind: "scene",
        sourceAtUs: 400000,
        sourceOrdinal: 1,
        observation: {
          sample: {
            value: "6656",
            timescale: 10240,
            endValue: "7680",
            endTimescale: 10240,
            originUs: 250000,
          },
        },
      },
    ];
  } else {
    const fixture = await realCaptureFixture(home, out);
    directory = fixture.directory;
    assert.equal(
      fixture.journalSha256,
      "d44ff9028b14c533b78db6bf944b63cfc46e84b5f8d8e92299a36d4e1d986698",
    );
    const journal = (await readFile(join(directory, "capture.journal.jsonl"), "utf8"))
      .trim()
      .split("\n")
      .map(JSON.parse);
    const times = [49814, 67253, 83514, 100658];
    const original = journal
      .flatMap((row) => (row.event === "cursorSamples" ? row.data.samples : []))
      .filter((row) => times.includes(row.sourceUs));
    assert.deepEqual(
      original.map((row) => row.sourceUs),
      times,
    );
    const selected = fixture.normalized.flatMap((row, index) =>
      row.event === "cursorSample" && times.includes(row.data.sourceUs)
        ? [{ observation: row.data, sourceSequence: index + 1 }]
        : [],
    );
    // A shared normalizer must not make altered coordinates or buttons look correct on both arms.
    assert.deepEqual(
      selected.map((row) => row.observation),
      original,
    );
    sourceRows = selected.slice(0, 3).map(({ observation, sourceSequence }) => ({
      kind: "cursor",
      sourceAtUs: observation.sourceUs,
      captureAtUs: observation.sourceUs,
      sourceSequence,
      observation,
    }));
    normalization = { sha256: fixture.normalizedSha256, receipt: fixture.receipt, selected };
  }
  for (const file of mode === "events"
    ? ["video.mov", "capture.journal.jsonl"]
    : ["video.mov", "narration.mov", "capture.journal.jsonl"])
    files[file] = hash(await readFile(join(directory, file)));
  if (mode === "cursor") {
    assert.equal(
      files["video.mov"],
      "ade26eacf8dce118e4fe16dcf261e7d3445d115e2b92721f0a01b8a4511de17a",
    );
    assert.equal(
      files["narration.mov"],
      "2bf4af51122816d6e4c4a6731ddd1a73375be3ed61d82d8cd66bec824638962c",
    );
  }
  const imported = await call("acquisition.import", { path: directory, requestId: "source" });
  const job = await poll(
    () => call("job.get", { jobId: imported.jobId }),
    (value) => value.state === "ready",
    "source acquisition",
  );
  const acquisition = await call("acquisition.get", { acquisitionId: job.target.acquisitionId });
  assert.equal(acquisition.journal.sha256, files["capture.journal.jsonl"]);
  if (normalization)
    assert.equal(hash(await readFile(acquisition.evidence.receipt.file)), normalization.sha256);
  const binding = acquisition.bindings.find((value) => value.sourceRoles.includes("video"));
  assert(binding);
  assert.equal(binding.assetId, files["video.mov"]);
  assert.equal(binding.sourceToAssetOffsetUs, mode === "events" ? -250000 : 0);
  const asset = await call("asset.get", { assetId: binding.assetId });
  assert.equal(asset.originUs, mode === "events" ? 250000 : 0);
  const selection = {
    assetId: binding.assetId,
    streamId: binding.streamId,
    acquisitionId: acquisition.id,
  };
  const operation = mode === "events" ? "timeline.events" : "cursor.raw";
  const source = await poll(
    () => call(operation, { ...selection, sourceRange, limit: 500 }),
    (value) => value.state === "ready",
    "source event preparation",
  );
  assert.deepEqual(source.page.rows, sourceRows);
  assert.equal(source.page.nextCursor, null);
  const record = {
    files,
    normalization,
    acquisition,
    asset,
    sourceRange,
    source,
    sourceOracle: sourceRows,
  };
  await writeFile(join(out, "fixture.json"), JSON.stringify(record, null, 2));
  return {
    asset,
    selection,
    sourceRange,
    operation,
    record,
    expected({ starts, clipIds, trackId, durationUs, clipUs, limit }) {
      const rows = [];
      const common = { ...selection, trackId, trackRank: 0 };
      for (let index = 0; rows.length < limit; index++) {
        const start = starts[index],
          clipId = clipIds[index];
        const cut = (at, entering) => ({
          kind: "cut",
          projectAtUs: at,
          trackId,
          trackRank: 0,
          mediaKind: "video",
          before: entering
            ? null
            : { clipId, kind: "range", ...selection, sourceAtUs: sourceRange.endUs, rate: 1 },
          after: entering
            ? { clipId, kind: "range", ...selection, sourceAtUs: sourceRange.startUs, rate: 1 }
            : null,
        });
        if (mode === "events" && start > 0) rows.push(cut(start, true));
        rows.push(
          ...sourceRows.map((row) => ({
            ...row,
            ...common,
            clipId,
            generation:
              row.kind === "scene"
                ? source.context.scene.evidence.generation
                : acquisition.evidence.generation,
            projectAtUs: toTime(
              rational(
                BigInt(start) * BigInt(sourceRange.endUs - sourceRange.startUs) +
                  BigInt(row.sourceAtUs - sourceRange.startUs) * BigInt(clipUs),
                BigInt(sourceRange.endUs - sourceRange.startUs),
              ),
            ),
          })),
        );
        if (mode === "events" && start + clipUs < durationUs) rows.push(cut(start + clipUs, false));
      }
      return rows.slice(0, limit);
    },
  };
}

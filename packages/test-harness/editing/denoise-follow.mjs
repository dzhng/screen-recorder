import assert from "node:assert/strict";
import { readFile, writeFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { hash, poll, root } from "./source-evidence-fixture.mjs";
import { waveHeader } from "./audio-project-fixture.mjs";

/** The accepted public follow snapshot supplies a frozen input to the learned oracle. */
export async function denoiseFollow({
  call,
  prepare,
  inspect,
  projectAudio,
  denoise,
  report,
  out,
}) {
  const packet = join(root, "specs/agent-editing/assets/15a3e-follow-learned-public");
  const earlier = join(root, "specs/agent-editing/assets/14e-public-retiming");
  const inputs = JSON.parse(await readFile(join(packet, "inputs.json"), "utf8"));
  const verification = JSON.parse(await readFile(join(earlier, "root-verification.json"), "utf8"));
  const reportBytes = gunzipSync(await readFile(join(earlier, "root-report.json.gz")));
  assert.equal(hash(reportBytes), verification.rootReportSha256);
  assert.equal(hash(reportBytes), inputs.reportSha256);
  const frozenReport = JSON.parse(reportBytes);
  const receipt = frozenReport.receipts["independent-follow-audio"];
  assert.equal(receipt.revisionId, inputs.revisionId);
  const frozenRevision = frozenReport.exchanges
    .map((exchange) => (exchange.response.structuredContent ?? exchange.response).data?.revision)
    .find((revision) => revision?.id === inputs.revisionId);
  assert(frozenRevision);
  // The package head has output gain; the authenticated follow revision does not.
  assert(
    frozenRevision.document.processing.every((entry) =>
      entry.steps.every((step) => step.processor.type === "geometry"),
    ),
  );
  const packagePath = join(packet, "retained-package.zip");
  assert.equal(hash(await readFile(packagePath)), inputs.packageSha256);
  const frozenWave = gunzipSync(await readFile(join(packet, "follow-dry.wav.gz")));
  assert.equal(hash(frozenWave), inputs.dryFileSha256);
  const header = waveHeader(frozenWave, frozenWave.length);
  const frozen = frozenWave.subarray(header.offset, header.offset + header.bytes);
  assert.equal(hash(frozen), receipt.pcmSha256);
  assert.equal(header.frames, 216000);
  const record = (report.follow = {
    inputs,
    harnessSha256: hash(await readFile(import.meta.filename)),
    frozenPCM: receipt.pcmSha256,
    frozenRevision,
  });
  const opened = await call("package.open", { path: packagePath });
  const ready = await poll(
    () => call("package.status", { admissionId: opened.id }),
    (value) => value.state === "ready",
    "follow package",
  );
  const adopted = await poll(
    () =>
      call("package.adopt", {
        packageHandle: ready.packageHandle,
        requestId: "follow-adopt",
      }),
    (value) => value.state === "ready",
    "follow adoption",
  );
  await call("package.close", { admissionId: opened.id });
  const projectId = adopted.result.projectId;
  const history = await call("revision.history", { projectId });
  assert.equal(history.nextCursor, null);
  const historical = history.revisions.find(
    (revision) => revision.ordinal === frozenRevision.ordinal,
  );
  assert(historical);
  assert.deepEqual(historical.document, frozenRevision.document);
  const restored = await call(
    "edit.restore",
    {
      projectId,
      expectedRevisionId: adopted.result.revisionId,
      targetRevisionId: historical.id,
      requestId: "follow-restore",
    },
    { transport: "mcp" },
  );
  assert.deepEqual(restored.document, frozenRevision.document);
  const drySelection = { projectId, revisionId: restored.id };
  const target = { kind: "output" };
  const tap = { target, point: { kind: "processed" } };
  const range = { startUs: 0, endUs: 4500000 };
  await projectAudio(drySelection, tap, "follow-dry", frozen, 2, range);
  assert.equal(report.checks["follow-dry"].ready.published.audio.preparedResourceId, null);
  const expected = denoise("follow-expected", frozen, 2);
  await writeFile(join(out, "follow-expected.f32"), expected);
  const reset = denoise("follow-reset-control", frozen.subarray(180000 * 8), 2);
  assert(!reset.subarray(0, 24000 * 8).equals(expected.subarray(180000 * 8, 204000 * 8)));
  record.resetAtLateDiffers = true;
  const changed = await call(
    "edit.apply",
    {
      projectId,
      expectedRevisionId: restored.id,
      requestId: "follow-learned",
      operations: [
        {
          operation: "processing.set",
          target,
          steps: [{ processor: { type: "rnnoise", mix: 1 } }],
        },
      ],
    },
    { transport: "mcp" },
  );
  const selection = { projectId, revisionId: changed.revision.id };
  const stack = await call("processing.get", { ...selection, target });
  record.stack = stack;
  const lateRange = { startUs: 3750000, endUs: 4250000 };
  await projectAudio(selection, tap, "follow-late-before-full", expected, 2, lateRange);
  assert.equal(
    report.checks["follow-late-before-full"].ready.published.audio.preparedResourceId,
    null,
  );
  await call("audio.get", report.checks["follow-late-before-full"].params, { transport: "mcp" });
  const attachment = report.exchanges.at(-1).response.content.find((item) => item.type === "audio");
  assert(attachment);
  assert.equal(
    hash(Buffer.from(attachment.data, "base64")),
    report.checks["follow-late-before-full"].sha256,
  );
  await projectAudio(selection, tap, "follow-full", expected, 2, range);
  const prepared = await prepare(selection);
  await inspect(prepared, 3250000, 4250000, "follow-prepared-excerpt", 1, expected, 2);
  const followClip = restored.document.clips.find((clip) => clip.pitch === "follow");
  assert(followClip);
  let witness;
  for (const file of (await readdir(join(out, "native"))).filter((name) =>
    name.startsWith("mix-"),
  )) {
    const mix = JSON.parse(await readFile(join(out, "native", file), "utf8"));
    if (mix.request.range.start === 180000 && mix.request.range.end === 204000) {
      assert(!mix.request.clips.some((clip) => clip.clipId === followClip.id));
      assert(mix.request.state.clips.some((clip) => clip.clipId === followClip.id));
      assert.equal(mix.response.data.sourceWork.preparedRetimeRuns, 1);
      witness = { file, followOnlyInState: true, preparedRetimeRuns: 1 };
    }
  }
  assert(witness);
  record.selection = selection;
  record.prepared = prepared;
  record.lateState = witness;
  record.lateMCPMatchesCLI = true;
}

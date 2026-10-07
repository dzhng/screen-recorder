import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { gunzipSync } from "node:zlib";
import { rational, toTime } from "../../composition/src/index.ts";
import { Catalog } from "../../core/src/catalog.ts";
import { AlignmentEvidenceStore } from "../../core/src/alignment-evidence.ts";
import {
  alignmentCorrespondenceInput,
  alignmentDigest,
} from "../../core/src/alignment-operands.ts";
import { SourceAlignmentRead } from "../../core/src/alignment-read.ts";

const [binary, controlled, reference] = process.argv.slice(2);
if (!binary || !controlled || !reference || process.argv.length !== 5) {
  console.error(
    "Usage: bun alignment-evidence-parity.mjs <yap-native> <existing-controlled-parity-directory> <frozen09-reference>",
  );
  process.exit(2);
}
const json = (path) => {
  try {
    return JSON.parse(readFileSync(path));
  } catch {
    return JSON.parse(gunzipSync(readFileSync(path + ".gz")));
  }
};
const catalog = new Catalog(":memory:"),
  records = new AlignmentEvidenceStore(catalog, () => {}),
  proof = [];
try {
  for (const name of readdirSync(controlled).sort()) {
    const at = name.lastIndexOf("-"),
      caseId = name.slice(0, at),
      candidate = Number(name.slice(at + 1));
    const nativeReceipt = readFileSync(
        join(controlled, name, "result.json.native-unverified.json"),
        "utf8",
      ),
      report = readFileSync(join(controlled, name, "result.json"), "utf8");
    const native = JSON.parse(nativeReceipt),
      input = alignmentCorrespondenceInput({ nativeReceipt, report });
    const processResult = spawnSync(resolve(binary), [], {
      input: JSON.stringify({ id: name, operation: "speech.correspond", params: input }) + "\n",
      encoding: "utf8",
      maxBuffer: 1024 * 1024,
      timeout: 10000,
    });
    assert.equal(processResult.status, 0, processResult.stderr);
    const response = JSON.parse(processResult.stdout);
    assert.equal(response.ok, true, JSON.stringify(response.error));
    const operands = { nativeReceipt, report, correspondence: JSON.stringify(response.data) },
      identity = {
        owner: { kind: "asset", assetId: alignmentDigest(name) },
        generation: name,
        policy: "alignment-v1",
      };
    const hash = alignmentDigest("parity");
    const source = {
      streamId: "selected",
      acquisitionId: null,
      supportDigest: hash,
      channel: 0,
      originUs: 0,
      durationUs: toTime(rational(BigInt(native.sourceFrames) * 1000000n, 16000n)),
      observationRange: {
        startUs: 0,
        endUs: toTime(rational(BigInt(native.sourceFrames) * 1000000n, 16000n)),
      },
      text: native.text,
      pcm: { sha256: native.pcmSha256, sampleRate: 16000, frames: native.sourceFrames },
      decoder: {
        recipe: "source-selected-span-avfoundation-f32-16k-v1",
        workerSha256: hash,
        osBuild: "controlled-provider-parity",
      },
      engine: {
        modelId: "ctc-parity",
        descriptorDigest: hash,
        modelDigest: hash,
        modelSha256: native.modelSha256,
        runtimeDigest: hash,
        workerSha256: hash,
        recipe: "nemo-auxiliary-ctc110-v1",
      },
    };
    const staged = records.stage(identity, source, operands);
    catalog.transaction(() => staged.publish());
    const page = new SourceAlignmentRead(records, staged.metadata).page({
      view: "words",
      limit: 1000,
    });
    assert.ok("rows" in page);
    const expected = json(join(reference, "nemo-ctc110-correspondence", caseId + ".json"))
      .candidates[candidate];
    for (const [kind, referenceRows] of [
      ["supplied", expected.requested],
      ["observed", expected.observed],
    ]) {
      const rows = page.rows.filter((row) => row.kind === kind);
      assert.equal(rows.length, referenceRows.length, name + kind);
      rows.forEach((row, index) => {
        const frozen = referenceRows[index];
        assert.equal(row.text, frozen.text, name + kind + index);
        assert.equal(row.correspondence, frozen.status, name + kind + index);
        assert.deepEqual(
          row.possibleIndices,
          kind === "supplied" ? frozen.observedIndices : frozen.suppliedIndices,
        );
        assert.equal(
          row.omissionPossible,
          kind === "supplied" ? frozen.omissionPossible : frozen.extraPossible,
        );
        const timing = row.timing;
        assert.ok(timing, name + kind + index);
        assert.equal(
          timing.startFrame,
          kind === "supplied" ? frozen.estimatedBounds.startFrame : frozen.startFrame,
        );
        assert.equal(
          timing.endFrame,
          kind === "supplied" ? frozen.estimatedBounds.endFrame : frozen.endFrame,
        );
        assert.equal(timing.physicalAdmission, frozen.physicalAdmission);
        assert.equal(row.lexicalIdentity, "unknown");
        assert.equal(row.assignmentConfidence, null);
        if (timing.physicalAdmission === "refused_unowned_support")
          assert.equal(timing.sourceRange, null);
      });
    }
    assert.deepEqual(records.operands(identity), operands);
    proof.push({
      case: caseId,
      candidate,
      generation: name,
      rows: page.rows.length,
      matrixSha256: staged.metadata.matrixSha256,
      completeCorrespondenceParity: true,
      conditionalBoundsParity: true,
      rawOperandHashes: {
        nativeReceipt: staged.metadata.nativeReceiptSha256,
        report: staged.metadata.reportSha256,
        correspondence: staged.metadata.correspondenceSha256,
      },
    });
  }
  assert.equal(proof.length, 23);
  console.log(JSON.stringify({ inferenceRuns: 0, proof }, null, 2));
} finally {
  catalog.close();
}

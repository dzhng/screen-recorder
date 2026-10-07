// Verify the retained data-only AHC threshold probe. Never acquire, infer or write.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const read = (name) => readFileSync(join(here, name));
const protocol = JSON.parse(read('protocol.json'));
for (const key of ['preparedObservations', 'thresholdResults']) {
  const a = protocol.artifacts[key];
  const compressed = read(a.path);
  assert.equal(hash(compressed), a.sha256, a.path);
  assert.equal(hash(gunzipSync(compressed)), a.uncompressedSha256, a.path);
}
assert.equal(hash(read(protocol.artifacts.source.path)), protocol.artifacts.source.sha256);
assert.equal(hash(read(protocol.artifacts.package.path)), protocol.artifacts.package.sha256);
const prepared = JSON.parse(gunzipSync(read('prepared-observations.json.gz')));
const results = JSON.parse(gunzipSync(read('threshold-results.json.gz')));
const segmentDigest = (segments) => hash(Buffer.from(JSON.stringify(segments.map((x) => ({end: x.end, speaker: x.speaker, start: x.start})))));
assert.deepEqual(Object.keys(prepared).sort(), ['bspxd30', 'returns-overlap-silence']);
for (const [id, embeddings] of Object.entries(prepared)) {
  assert(embeddings.length > 0);
  for (const e of embeddings) {
    assert.equal(e.embedding256.length, 256);
    assert.equal(e.rho128.length, 128);
    assert(e.embedding256.every(Number.isFinite));
    assert(e.rho128.every(Number.isFinite));
    assert(Number.isInteger(e.chunkIndex) && Number.isInteger(e.speakerIndex));
    assert(Number.isFinite(e.startTimeSeconds) && Number.isFinite(e.endTimeSeconds));
  }
}
assert.equal(results.length, protocol.thresholds.length * protocol.calibrationCases.length);
for (const threshold of protocol.thresholds) {
  const rows = results.filter((x) => x.threshold === threshold);
  assert.deepEqual(rows.map((x) => x.id).sort(), [...protocol.calibrationCases].sort());
  for (const row of rows) {
    assert.equal(row.segments.length, row.segmentCount);
    assert.deepEqual(row.observedSpeakerIds, [...new Set(row.segments.map((x) => x.speaker))].sort());
    assert.equal(row.segmentsSha256, segmentDigest(row.segments));
    assert.equal(row.chunkEmbeddings === undefined, true);
  }
}
for (const id of protocol.calibrationCases) {
  const rows = results.filter((x) => x.id === id);
  assert.equal(new Set(rows.map((x) => x.segmentsSha256)).size, 1, `${id} changed across thresholds`);
  assert.equal(new Set(rows.map((x) => JSON.stringify(x.observedSpeakerIds))).size, 1);
}
const bsp = results.find((x) => x.id === 'bspxd30');
const ret = results.find((x) => x.id === 'returns-overlap-silence');
assert.equal(bsp.observedSpeakerIds.length, 2);
assert.equal(ret.observedSpeakerIds.length, 3);
assert(ret.segments.some((x) => x.end > ret.audioSeconds));
console.log(JSON.stringify({verified: true, passed: false, promoted: false, thresholds: protocol.thresholds, identicalAssignments: true, calibration: {bspxd30: {observedSpeakerCount: 2, requiredSpeakerCount: 3}, returnsOverlapSilence: {observedSpeakerCount: 3, supportRefusal: true}}, heldOutOpened: false}, null, 2));

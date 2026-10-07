import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {diarizationScore} from '../../../../../packages/test-harness/speech/feasibility/score.mjs';

const root = new URL('.', import.meta.url);
const protocol = JSON.parse(await readFile(new URL('protocol.json', root), 'utf8'));
const hash = data => createHash('sha256').update(data).digest('hex');
const expected = new Map(protocol.cases.map(c => [c.id, c]));
function overlapRecall(ref, pred, duration) {
  const points = [...new Set([0, duration, ...ref.flatMap(x => [x.start, x.end]), ...pred.flatMap(x => [x.start, x.end])])].sort((a, b) => a - b);
  let total = 0;
  let retained = 0;
  for (let i = 1; i < points.length; i += 1) {
    const at = (points[i] + points[i - 1]) / 2;
    const speakers = ref.filter(x => x.start <= at && x.end > at).length;
    if (speakers < 2) continue;
    const seconds = points[i] - points[i - 1];
    total += seconds;
    if (new Set(pred.filter(x => x.start <= at && x.end > at).map(x => x.speaker)).size >= 2) retained += seconds;
  }
  return total ? retained / total : null;
}
for (const id of expected.keys()) {
  const c = expected.get(id);
  const compressed = await readFile(new URL(c.fixture, root));
  assert.equal(hash(compressed), c.fixtureSha256, `${id}: fixture hash`);
  const raw = JSON.parse(gunzipSync(compressed));
  const metrics = diarizationScore(c.reference, raw.segments, raw.audioSeconds);
  assert.equal(metrics.der, c.der, `${id}: DER`);
  assert.equal(metrics.confusedSpeakerSeconds / metrics.referenceSpeakerSeconds, c.identityConfusionRatio, `${id}: confusion`);
  assert.equal(overlapRecall(c.reference, raw.segments, raw.audioSeconds), c.overlapRecall, `${id}: overlap recall`);
  assert.equal(new Set(raw.segments.map(x => x.speaker)).size, new Set(c.reference.map(x => x.speaker)).size, `${id}: speaker count`);
  assert.equal(raw.inferenceSeconds, c.inferenceSeconds, `${id}: inference timing`);
  assert.equal(raw.peakProcessRSSBytes, c.peakProcessRSSBytes, `${id}: RSS`);
}
console.log(JSON.stringify({ok: true, status: protocol.status, shortCasesPassed: protocol.qualityGate.shortCasesPassed, shortCasesRequired: protocol.qualityGate.shortCasesRequired}));

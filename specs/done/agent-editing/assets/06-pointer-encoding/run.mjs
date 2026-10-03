import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { resolve, join } from 'node:path';
const [repo, worker, out] = process.argv.slice(2, 5).map(value => resolve(value));
const factor = process.argv[5];
assert.ok(['all-intra', '40mbps'].includes(factor), 'Pass all-intra or 40mbps after paths');
const parent = join(repo, 'specs/agent-editing/assets/06-pointer-writer');
const input = join(parent, 'input');
const hash = x => createHash('sha256').update(x).digest('hex');
const run = (program, args, stdin, env = {}) => {
  const r = spawnSync(program, args, {
    input: stdin,
    encoding: 'utf8',
    timeout: 60000,
    maxBuffer: 8 * 1024 ** 2,
    env: { ...process.env, ...env },
  });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout;
};
await mkdir(out);
const reference = join(out, 'reference'),
  pixels = join(out, 'pixels');
for (const [source, tool] of [
  ['FrameColorReference.swift', reference],
  ['FrameImagePixels.swift', pixels],
])
  run('swiftc', [
    '-parse-as-library',
    join(repo, 'packages/test-harness/editing', source),
    '-o',
    tool,
  ]);
const cohorts = [
    ['full', 0, 2000000],
    ['range', 1050001, 1250001],
  ],
  decoded = {},
  checks = [],
  movies = [];
const diff = (a, b) => {
  assert.equal(a.length, b.length);
  let changed = 0,
    max = 0;
  for (let i = 0; i < a.length; i++) {
    let d = Math.abs(a[i] - b[i]);
    changed += d > 0;
    max = Math.max(max, d);
  }
  return { changedChannels: changed, maximum: max };
};
for (const [id, startUs, endUs] of cohorts) {
  const dir = join(out, id);
  await mkdir(dir);
  const framesFile = join(input, id + '.frames.jsonl'),
    pointersFile = join(input, id + '.pointers.jsonl');
  const frames = (await readFile(framesFile, 'utf8')).trim().split('\n').map(JSON.parse),
    pointerBytes = await readFile(pointersFile);
  const original = JSON.parse(
    await readFile(join(parent, 'results/instrumented-' + id, 'request.json'), 'utf8'),
  );
  const request = {
    ...original,
    output: join(dir, 'movie.mp4'),
    frames: framesFile,
    assets: original.assets.map(a => ({ ...a, path: join(input, 'source.mov') })),
    pointers: { ...original.pointers, file: pointersFile },
  };
  assert.equal(hash(pointerBytes), request.pointers.sha256);
  await writeFile(join(dir, 'request.json'), JSON.stringify(request, null, 2));
  const result = JSON.parse(
    run(
      worker,
      [],
      JSON.stringify({
        id: 'all-intra',
        operation: 'media.renderCompositionVideo',
        params: request,
      }) + '\n',
      { SCREENREC_WRITER_TRACE: dir },
    ),
  );
  assert.ok(result.ok, JSON.stringify(result));
  await writeFile(join(dir, 'receipt.json'), JSON.stringify(result.data, null, 2));
  const imageDir = join(dir, 'decoded');
  await mkdir(imageDir);
  const refRequest = join(dir, 'reference.json');
  await writeFile(
    refRequest,
    JSON.stringify({
      movie: request.output,
      output: imageDir,
      timesUs: frames.map(f => f.visibleRange.startUs - startUs),
    }),
  );
  const refs = JSON.parse(run(reference, [refRequest]));
  assert.equal(refs.length, frames.length);
  decoded[id] = new Map();
  for (let i = 0; i < frames.length; i++) {
    const raw = refs[i].file + '.rgba';
    run(pixels, [refs[i].file, raw]);
    decoded[id].set(frames[i].index, await readFile(raw));
  }
  for (const index of [10, 11, 12]) {
    const trace = JSON.parse(await readFile(join(dir, `frame-${index}.json`), 'utf8')),
      oldTrace = JSON.parse(
        await readFile(join(parent, 'results/instrumented-' + id, `frame-${index}.json`), 'utf8'),
      );
    const bytes = await readFile(join(dir, `frame-${index}.bgra`)),
      oldBytes = gunzipSync(
        await readFile(join(parent, 'results/instrumented-' + id, `frame-${index}.bgra.gz`)),
      );
    assert.deepEqual(trace, oldTrace);
    assert.deepEqual(bytes, oldBytes);
    checks.push({
      cohort: id,
      index,
      writerTraceExact: true,
      writerPixels: diff(bytes, oldBytes),
      sha256: hash(bytes),
    });
  }
  const probe = JSON.parse(
    run('ffprobe', [
      '-v',
      'error',
      '-select_streams',
      'v:0',
      '-show_frames',
      '-show_entries',
      'frame=key_frame,pict_type,best_effort_timestamp_time,pkt_duration_time',
      '-of',
      'json',
      request.output,
    ]),
  );
  await writeFile(join(dir, 'frames.json'), JSON.stringify(probe, null, 2));
  assert.equal(probe.frames.length, frames.length);
  if (factor === 'all-intra')
    assert.ok(probe.frames.every(f => f.key_frame === 1 && f.pict_type === 'I'));
  const movieBytes = await readFile(request.output),
    parentBytes = await readFile(join(parent, 'results/instrumented-' + id, 'movie.mp4'));
  movies.push({
    cohort: id,
    bytes: movieBytes.length,
    parentBytes: parentBytes.length,
    ratio: movieBytes.length / parentBytes.length,
    sha256: hash(movieBytes),
    frames: frames.length,
    allIntra: probe.frames.every(f => f.key_frame === 1 && f.pict_type === 'I'),
  });
}
const mask = (raw, t) => {
  const points = new Set();
  let sx = 0,
    sy = 0;
  for (let y = 0; y < 160; y++)
    for (let x = 0; x < 256; x++) {
      const i = (y * 256 + x) * 4;
      if (raw[i] > raw[i + 1] + t && raw[i + 2] > raw[i + 1] + 10) {
        points.add(y * 256 + x);
        sx += x;
        sy += y;
      }
    }
  return { points, count: points.size, centroid: [sx / points.size, sy / points.size] };
};
const trail = [];
for (const index of [10, 11, 12])
  for (const threshold of [19, 20, 21]) {
    const a = mask(decoded.full.get(index), threshold),
      b = mask(decoded.range.get(index), threshold);
    let intersection = 0;
    for (const p of a.points) if (b.points.has(p)) intersection++;
    trail.push({
      index,
      threshold,
      fullCount: a.count,
      rangeCount: b.count,
      fullCentroid: a.centroid,
      rangeCentroid: b.centroid,
      centroidDelta: a.centroid.map((v, i) => b.centroid[i] - v),
      fullOnly: a.count - intersection,
      rangeOnly: b.count - intersection,
      iou: intersection / (a.count + b.count - intersection),
      decodedDifference: diff(decoded.full.get(index), decoded.range.get(index)),
    });
  }
const report = {
  workerSHA256: hash(await readFile(worker)),
  sourceSHA256: hash(await readFile(join(input, 'source.mov'))),
  factor,
  writerInputChecks: checks,
  movies,
  trail,
  originalMagentaCriterionPassed: trail
    .filter(v => v.threshold === 20)
    .every(v => v.fullCount > 0 && v.rangeCount > 0 && v.centroidDelta.every(d => Math.abs(d) < 1)),
};
await writeFile(join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(
  JSON.stringify(
    {
      movies,
      trail: trail.filter(v => v.threshold === 20),
      originalMagentaCriterionPassed: report.originalMagentaCriterionPassed,
    },
    null,
    2,
  ),
);

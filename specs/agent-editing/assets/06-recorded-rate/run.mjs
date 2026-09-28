import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const [repo, out, parentWorker, candidateWorker] = process.argv.slice(2).map(x => resolve(x));
assert.ok(
  repo && out && parentWorker && candidateWorker,
  'Pass repository, fresh output, parent worker, candidate worker',
);
const { createCompiler, validateComposition } = await import(
  pathToFileURL(join(repo, 'packages/composition/dist/index.js')).href
);
await mkdir(out);
const source = join(repo, 'fixtures/narrated-workbench/video.mov'),
  hash = b => createHash('sha256').update(b).digest('hex');
const workers = { parent: parentWorker, candidate: candidateWorker };
const run = (p, args, stdin, env = {}) => {
  const r = spawnSync(p, args, {
    input: stdin,
    encoding: 'utf8',
    timeout: 60000,
    maxBuffer: 64 * 1024 ** 2,
    env: { ...process.env, ...env },
  });
  assert.ifError(r.error);
  assert.equal(r.status, 0, r.stderr);
  return r.stdout;
};
const call = (worker, op, params, trace) => {
  const r = JSON.parse(
    run(
      worker,
      [],
      JSON.stringify({ id: 'recorded-rate', operation: op, params }) + '\n',
      trace ? { SCREENREC_WRITER_TRACE: trace } : {},
    ),
  );
  assert.ok(r.ok, JSON.stringify(r));
  return r.data;
};
const probe = call(workers.parent, 'media.probe', { path: source }),
  stream = probe.streams.find(s => s.kind === 'video');
const canvas = {
  width: stream.orientedWidth,
  height: stream.orientedHeight,
  fps: { numerator: 20, denominator: 1 },
  background: '#000000ff',
};
assert.deepEqual([canvas.width, canvas.height], [3120, 1970]);
const binding = {
  assetId: 'recorded',
  streamId: stream.id,
  path: source,
  originUs: probe.originUs,
};
const model = validateComposition(
  {
    canvas,
    tracks: [{ id: 'v', kind: 'video', order: 0 }],
    groups: [],
    syncGroups: [],
    captions: [],
    processing: [],
    clips: [
      {
        id: 'recorded',
        assetId: 'recorded',
        streamId: stream.id,
        trackId: 'v',
        source: { kind: 'range', range: { startUs: 0, endUs: 1000000 } },
        placement: { kind: 'project', range: { startUs: 0, endUs: 1000000 } },
      },
    ],
  },
  [
    {
      id: 'recorded',
      streams: [
        {
          id: stream.id,
          kind: 'video',
          width: stream.orientedWidth,
          height: stream.orientedHeight,
          bounds: { startUs: stream.startUs, endUs: stream.endUs },
          available: stream.segments
            ?.filter(s => !s.empty)
            .map(({ startUs, endUs }) => ({ startUs, endUs })) ?? [
            { startUs: stream.startUs, endUs: stream.endUs },
          ],
        },
      ],
    },
  ],
);
const compiler = createCompiler(model, 'recorded-rate'),
  reference = join(out, 'reference'),
  pixels = join(out, 'pixels');
for (const [file, tool] of [
  ['FrameColorReference.swift', reference],
  ['FrameImagePixels.swift', pixels],
])
  run('swiftc', [
    '-parse-as-library',
    join(repo, 'packages/test-harness/editing', file),
    '-o',
    tool,
  ]);
const sampleIndices = [0, 10, 12],
  direct = new Map(),
  decoded = {},
  movies = [],
  writerChecks = [];
const ranges = { full: { startUs: 0, endUs: 1000000 }, range: { startUs: 450001, endUs: 650001 } };
for (const [id, range] of Object.entries(ranges)) {
  const window = compiler.window({
    range,
    rendition: { sampleRate: 48000, channels: 2 },
    tap: { target: { kind: 'output' }, point: { kind: 'processed' } },
  });
  const frames = [...window.frames()];
  const file = join(out, id + '.frames.jsonl');
  await writeFile(file, frames.map(f => JSON.stringify(f) + '\n').join(''));
  if (id === 'full')
    for (const index of sampleIndices) {
      const params = {
        output: join(out, `direct-${index}.png`),
        frame: frames.find(f => f.index === index),
        canvas,
        profile: 'h264-rec709',
        processing: window.manifest.processing,
        assets: [binding],
        maxLongEdge: 8192,
      };
      const receipt = call(workers.parent, 'media.renderCompositionFrame', params);
      await writeFile(
        join(out, `direct-${index}.json`),
        JSON.stringify({ params, receipt }, null, 2),
      );
      const raw = params.output + '.rgba';
      run(pixels, [params.output, raw]);
      direct.set(index, await readFile(raw));
    }
  for (const [name, worker] of Object.entries(workers)) {
    const dir = join(out, name + '-' + id);
    await mkdir(dir);
    const params = {
      output: join(dir, 'movie.mp4'),
      frames: file,
      range,
      canvas,
      profile: 'h264-rec709',
      processing: window.manifest.processing,
      assets: [binding],
    };
    await writeFile(join(dir, 'request.json'), JSON.stringify(params, null, 2));
    const t = Date.now(),
      receipt = call(worker, 'media.renderCompositionVideo', params, dir);
    await writeFile(join(dir, 'receipt.json'), JSON.stringify(receipt, null, 2));
    movies.push({
      name,
      id,
      bytes: (await readFile(params.output)).length,
      elapsedMs: Date.now() - t,
      receipt,
    });
    const selected = frames.filter(f => sampleIndices.includes(f.index));
    const images = join(dir, 'decoded');
    await mkdir(images);
    const request = join(dir, 'reference.json');
    await writeFile(
      request,
      JSON.stringify({
        movie: params.output,
        output: images,
        timesUs: selected.map(f => f.visibleRange.startUs - range.startUs),
      }),
    );
    const refs = JSON.parse(run(reference, [request]));
    await writeFile(join(dir, 'references.json'), JSON.stringify(refs, null, 2));
    decoded[name + '-' + id] = new Map();
    for (let i = 0; i < selected.length; i++) {
      const raw = refs[i].file + '.rgba';
      run(pixels, [refs[i].file, raw]);
      decoded[name + '-' + id].set(selected[i].index, await readFile(raw));
    }
  }
  for (const index of [10, 11, 12]) {
    const a = await readFile(join(out, 'parent-' + id, `frame-${index}.bgra`)),
      b = await readFile(join(out, 'candidate-' + id, `frame-${index}.bgra`));
    assert.deepEqual(a, b);
    const ta = JSON.parse(await readFile(join(out, 'parent-' + id, `frame-${index}.json`))),
      tb = JSON.parse(await readFile(join(out, 'candidate-' + id, `frame-${index}.json`)));
    assert.deepEqual(ta, tb);
    writerChecks.push({ id, index, sha256: hash(a), exactTrace: true });
  }
}
function compare(a, b) {
  assert.equal(a.length, b.length);
  let sum = 0,
    max = 0,
    over = 0;
  for (let i = 0; i < a.length; i++) {
    if (i % 4 === 3) continue;
    let d = Math.abs(a[i] - b[i]);
    sum += d;
    max = Math.max(max, d);
    over += d > 4;
  }
  const patches = [];
  for (const y of [0.1, 0.3, 0.5, 0.7, 0.9])
    for (const x of [0.1, 0.3, 0.5, 0.7, 0.9]) {
      const px = Math.floor(x * canvas.width),
        py = Math.floor(y * canvas.height),
        i = (py * canvas.width + px) * 4;
      patches.push({
        x: px,
        y: py,
        maximum: Math.max(...[0, 1, 2].map(c => Math.abs(a[i + c] - b[i + c]))),
      });
    }
  return {
    channelMAE: sum / ((a.length / 4) * 3),
    maximum: max,
    channelFractionOver4: over / ((a.length / 4) * 3),
    allPixelsWithin4: max <= 4,
    patches,
    selectedPixelsWithin4: patches.every(p => p.maximum <= 4),
  };
}
const measurements = [];
for (const [id, map] of Object.entries(decoded))
  for (const [index, bytes] of map)
    measurements.push({
      id,
      index,
      decodedRGBAHash: hash(bytes),
      againstDirect: compare(direct.get(index), bytes),
    });
const rangeParity = [];
for (const name of Object.keys(workers))
  for (const index of [10, 12])
    rangeParity.push({
      name,
      index,
      ...compare(decoded[name + '-full'].get(index), decoded[name + '-range'].get(index)),
    });
const report = {
  source: { path: source, sha256: hash(await readFile(source)), probe },
  workers: Object.fromEntries(
    await Promise.all(
      Object.entries(workers).map(async ([name, path]) => [
        name,
        { path, sha256: hash(await readFile(path)) },
      ]),
    ),
  ),
  canvas,
  movies,
  writerChecks,
  measurements,
  rangeParity,
};
await writeFile(join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(
  JSON.stringify(
    {
      movies: movies.map(({ receipt, ...rest }) => rest),
      measurements: measurements.map(({ againstDirect, ...rest }) => ({
        ...rest,
        ...againstDirect,
        patches: undefined,
      })),
      rangeParity: rangeParity.map(({ patches, ...rest }) => rest),
    },
    null,
    2,
  ),
);

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
const { values } = parseArgs({ options: { out: { type: 'string' } } });
assert.ok(values.out);
const root = new URL('../../../', import.meta.url).pathname,
  out = resolve(values.out);
mkdirSync(out, { recursive: true });
assert.deepEqual(readdirSync(out), []);
const save = (p, v) => writeFileSync(p, JSON.stringify(v, null, 2));
const read = p => JSON.parse(readFileSync(p));
const hash = b => createHash('sha256').update(b).digest('hex');
function run(exe, args, options = {}) {
  const r = spawnSync(exe, args, {
    cwd: root,
    timeout: 180000,
    maxBuffer: 8 * 1024 * 1024,
    ...options,
  });
  assert.ifError(r.error);
  assert.equal(r.status, 0, r.stderr?.toString());
  return r.stdout;
}
for (const p of ['ScreenRecorderCaptureTests', 'CameraReproduction'])
  writeFileSync(
    join(out, p + '-build.log'),
    run('swift', ['build', '--package-path', 'helpers/mac', '--product', p]),
  );
const worker = join(root, 'helpers/mac/.build/debug/ScreenRecorderCaptureTests'),
  storage = join(root, 'helpers/mac/.build/debug/CameraReproduction');
const pcm = p => run('ffmpeg', ['-v', 'error', '-i', p, '-f', 'f32le', '-']);
const report = {
  scope:
    'offline admitted phase100001us; native and actual project resampling/window consumers; no writer rollout',
  workerSha256: hash(readFileSync(worker)),
  storageWorkerSha256: hash(readFileSync(storage)),
  cases: [],
};
for (const rate of [44100, 48000]) {
  const payload = join(
    root,
    `specs/agent-editing/assets/20a-sparse-storage/run/continuous-${rate}.mov`,
  );
  const canonical = join(out, `${rate}-canonical`),
    consumer = join(out, `${rate}-consumer`),
    request = join(out, `${rate}.request.json`);
  save(request, {
    payload,
    output: canonical,
    rate,
    runs: [{ firstFrame: 0, frames: rate * 2, sourceStart: { value: 100001, timescale: 1000000 } }],
  });
  run(storage, ['--sparse-storage', request]);
  run(worker, [], {
    env: {
      ...process.env,
      SCREENREC_PCM_WINDOWS_OUTPUT: consumer,
      SCREENREC_PCM_WINDOWS_CANONICAL: join(canonical, 'canonical.mov'),
    },
  });
  const input = pcm(payload),
    full = pcm(join(consumer, 'native-full.wav')),
    window = pcm(join(consumer, 'native-window.wav'));
  const bounds = read(join(consumer, 'native-window.json')).sampleRange;
  assert.equal(input.length, rate * 2 * 4);
  const expected = Buffer.concat([Buffer.alloc(Math.floor((100001 * rate) / 1000000) * 4), input]);
  assert.ok(
    full.equals(expected),
    'Native full must preserve all original PCM sample identities and declared placement',
  );
  assert.equal(window.length, (bounds.end - bounds.start) * 4);
  const projectFull = pcm(join(consumer, 'project-full.wav')),
    projectWindow = pcm(join(consumer, 'project-window.wav'));
  assert.equal(projectFull.length, 100800 * 8);
  assert.equal(projectWindow.length, (62379 - 57601) * 8);
  const nativeParity = window.equals(expected.subarray(bounds.start * 4, bounds.end * 4));
  const projectParity = projectWindow.equals(projectFull.subarray(57601 * 8, 62379 * 8));
  report.cases.push({
    rate,
    inputSha256: hash(readFileSync(payload)),
    canonicalSha256: hash(readFileSync(join(canonical, 'canonical.mov'))),
    owner: read(join(consumer, 'report.json')),
    nativeFullOriginalPCMExact: true,
    nativeWindowParity: nativeParity,
    nativeWindowMatchesMinusOne: window.equals(
      expected.subarray((bounds.start - 1) * 4, (bounds.end - 1) * 4),
    ),
    projectWindowParity: projectParity,
    projectWindowMatchesMinusOne: projectWindow.equals(projectFull.subarray(57600 * 8, 62378 * 8)),
  });
}
report.windowGatePassed = report.cases.every(c => c.nativeWindowParity && c.projectWindowParity);
save(join(out, 'report.json'), report);
console.log(JSON.stringify(report, null, 2));

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { signalSupport } from './stretch-measurements.mjs';

assert.equal(
  process.argv.length,
  5,
  'verified endpoint evidence, alternative evidence, fresh output',
);
const [reference, candidateRoot, out] = process.argv.slice(2).map(p => resolve(p));
assert.ok(!existsSync(out));
mkdirSync(out, { recursive: true });
const hash = b => createHash('sha256').update(b).digest('hex');
const baseline = JSON.parse(readFileSync(join(reference, 'evidence.json')));
const candidate = JSON.parse(readFileSync(join(candidateRoot, 'report.json'))),
  executable = join(candidateRoot, 'rubberband');
assert.equal(hash(readFileSync(executable)), candidate.executableSha256);
const report = {
  runnerSha256: hash(readFileSync(fileURLToPath(import.meta.url))),
  candidateSha256: hash(readFileSync(join(candidateRoot, 'report.json'))),
  baselineSha256: hash(readFileSync(join(reference, 'evidence.json'))),
  listening: 'UNVERIFIED; impulse peak/support diagnostics are not protected speech acceptance',
  results: [],
};
for (const row of baseline.endpoints) {
  const bytes = readFileSync(row.input);
  assert.equal(hash(bytes), baseline.loaded.find(x => x.path === row.input).sha256);
  const output = join(out, `phase${row.phase}-${row.side}-${row.speed}.f32`);
  const metadata = JSON.parse(
    execFileSync(
      executable,
      [row.input, output, '0', '72000', String(row.wanted), candidate.window],
      { timeout: 60000 },
    ),
  );
  const rendered = readFileSync(output);
  assert.equal(rendered.length, row.wanted * 4);
  if (row.wanted === 72000) assert.deepEqual(rendered, bytes);
  report.results.push({
    phase: row.phase,
    side: row.side,
    speed: row.speed,
    inputSha256: hash(bytes),
    outputSha256: hash(rendered),
    file: output,
    metadata,
    support: signalSupport(rendered, { nominal: row.sourceFrame / row.speed }),
  });
}
writeFileSync(join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(
  JSON.stringify({
    out,
    results: report.results.length,
    maxPeakOffset: Math.max(...report.results.map(row => Math.abs(row.support.offsetFrames))),
  }),
);

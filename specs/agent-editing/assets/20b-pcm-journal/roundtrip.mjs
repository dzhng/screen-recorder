import fs from 'node:fs';
import assert from 'node:assert/strict';
const root = process.argv[2];
for (const name of ['capture.journal.jsonl', 'integer-boundaries.json']) {
  for (const line of fs.readFileSync(`${root}/${name}`, 'utf8').trim().split('\n')) {
    const value = JSON.parse(line);
    assert.deepEqual(JSON.parse(JSON.stringify(value)), value);
  }
}
const value = JSON.parse(fs.readFileSync(`${root}/integer-boundaries.json`, 'utf8'));
assert.equal(value.physicalFirstFrame, '9223372036854775806');
assert.equal(value.rawPTS.value, '-9223372036854775808');
assert.equal(value.rawPTS.epoch, '9223372036854775807');
assert.equal(value.removedPauseUs, '9007199254740993');
console.log(JSON.stringify({ passed: true, boundaries: value }, null, 2));

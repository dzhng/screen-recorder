import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { readFile } from "node:fs/promises";

// Only the decoder recipe identity changes; the configured frozen/actual inference mode stays fixed.
const target = new URL("../../../packages/core/dist/transcript-processing.js", import.meta.url)
  .href;
const declaration = /const decoderExecution = "[^"]+";/g;
const after = 'const decoderExecution = "native-audio-generation-journey";';
let replaced = false;
registerHooks({
  load(url, context, nextLoad) {
    const loaded = nextLoad(url, context);
    if (url !== target) return loaded;
    assert.equal(loaded.format, "module");
    const source = Buffer.isBuffer(loaded.source)
      ? loaded.source.toString("utf8")
      : String(loaded.source);
    const matches = source.match(declaration);
    assert.equal(matches?.length, 1, "Expected one transcript decoder identity declaration");
    assert.notEqual(matches[0], after, "Simulated release must change the decoder identity");
    replaced = true;
    return { ...loaded, source: source.replace(declaration, after) };
  },
});
const fixture = JSON.parse(await readFile(process.argv[3], "utf8"));
await import(fixture.engine ? "./transcript-fixture-service.mjs" : "./evidence-service.mjs");
assert.ok(replaced, "Expected the isolated transcript module to pass through the release fixture");

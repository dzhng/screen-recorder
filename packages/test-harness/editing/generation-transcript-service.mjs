import assert from "node:assert/strict";
import { registerHooks } from "node:module";

// Only the decoder recipe identity changes; ASR responses remain the existing frozen fixture.
const target = new URL("../../../packages/core/dist/transcript-processing.js", import.meta.url)
  .href;
const before = 'const decoderExecution = "native-audio-v3";';
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
    assert.equal(source.split(before).length, 2, "Expected one known transcript recipe literal");
    replaced = true;
    return { ...loaded, source: source.replace(before, after) };
  },
});
await import("./evidence-service.mjs");
assert.ok(replaced, "Expected the isolated transcript module to pass through the release fixture");

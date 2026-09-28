import assert from "node:assert/strict";
import { registerHooks } from "node:module";

// Simulate a release's recipe identity in one child process; never alter product files or rows.
const target = new URL("../../../apps/service/dist/project-service.js", import.meta.url).href;
const before = 'implementationId: "native-source-scenes-v3"';
const after = 'implementationId: "native-source-scenes-generation-journey"';
let replaced = false;
registerHooks({
  load(url, context, nextLoad) {
    const loaded = nextLoad(url, context);
    if (url !== target) return loaded;
    assert.equal(loaded.format, "module");
    const source = Buffer.isBuffer(loaded.source)
      ? loaded.source.toString("utf8")
      : String(loaded.source);
    assert.equal(source.split(before).length, 2, "Expected one known scene recipe literal");
    replaced = true;
    return { ...loaded, source: source.replace(before, after) };
  },
});
await import("./source-acquisition-service.mjs");
assert.ok(replaced, "Expected the isolated service module to pass through the release fixture");

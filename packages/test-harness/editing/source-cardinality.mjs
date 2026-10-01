import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, realpath, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
import { parseArgs } from "node:util";
import { setTimeout as delay } from "node:timers/promises";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { STDIO_DEFAULT_MAX_BUFFER_SIZE } from "@modelcontextprotocol/sdk/shared/stdio.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { JourneyService, hash, root, run } from "./source-evidence-fixture.mjs";
import {
  cardinalityOracle,
  leadingEmpty,
  occurrences,
  prepareCardinality,
  range,
  rowLimit,
} from "./source-cardinality-fixture.mjs";

const { values } = parseArgs({
  options: {
    out: { type: "string" },
    phase: { type: "string", default: "verify" },
    "wrong-clock": { type: "boolean", default: false },
  },
});
assert(values.out, "Use one retained output directory for prepare, verify and measure phases");
assert(["prepare", "verify", "measure"].includes(values.phase));
assert(!values["wrong-clock"] || values.phase === "verify");
const out = resolve(values.out);
await mkdir(out, { recursive: true });
const report = {
  passed: false,
  phase: values.phase,
  wrongClock: values["wrong-clock"],
  scope:
    "Diagnostic source-cardinality dimension only; default-client large edit receipts and final production acceptance remain open",
  controls: {
    occurrences,
    leadingEmpty,
    rowLimit,
    range,
    cardinalities: [512, 1024],
    warmCollectionsPerArm: 20,
    p95BudgetMs: 250,
    coldMeaning:
      "First collection per arm after service restart; retained manifests may already exist from correctness verification",
  },
  trace: [],
  collections: [],
};
const name = values["wrong-clock"] ? "wrong-clock" : values.phase;
const save = () => writeFile(join(out, `${name}-report.json`), JSON.stringify(report, null, 2));
const fixtureFile = join(out, "fixture.json");
const configuration = join(out, `${name}-service.json`);
const operationsFile = join(out, `${name}-native.jsonl`);
const prepared =
  values.phase === "prepare" ? null : JSON.parse(await readFile(fixtureFile, "utf8"));
const home = prepared?.home ?? (await realpath(await mkdtemp("/tmp/sr-source-cardinality-")));
report.home = home;
await writeFile(operationsFile, "");
await writeFile(
  configuration,
  JSON.stringify({
    sources: [],
    allowedOperations:
      values.phase === "prepare"
        ? ["media.probe", "media.sourceEvidence", "storage.clearRenderWorkspace"]
        : ["storage.clearRenderWorkspace"],
    operationsFile,
  }),
);
const service = new JourneyService(
  home,
  report,
  configuration,
  new URL("./evidence-service.mjs", import.meta.url),
);
const call = (operation, params, options = {}) =>
  service.call(operation, params, { transport: "mcp", ...options });
let client;
try {
  assert.equal(
    hash(await readFile(process.env.SCREENREC_NATIVE)),
    "45cbe7b92819efa15a1b5d4a974cdcbd26cac6301c041bf6e5818e50f7cf5773",
  );
  report.runtime = {
    node: process.version,
    nativeSha256: hash(await readFile(process.env.SCREENREC_NATIVE)),
    gitHead: (await run("git", ["rev-parse", "HEAD"], { cwd: root })).stdout.trim(),
    files: {},
  };
  for (const file of [
    "packages/core/dist/project-evidence.js",
    "packages/core/dist/capture-source-read.js",
    "packages/core/dist/source-selection.js",
    "packages/core/dist/project-events.js",
    "packages/test-harness/editing/source-cardinality.mjs",
    "packages/test-harness/editing/source-cardinality-fixture.mjs",
  ])
    report.runtime.files[file] = hash(await readFile(join(root, file)));
  report.runtime.resolvedModules = [];
  for (const [importer, specifier, expected] of [
    [
      "apps/service/dist/project-service.js",
      "@screenrec/core/project-evidence",
      "packages/core/dist/project-evidence.js",
    ],
    ["apps/service/dist/worker.js", "@screenrec/protocol", "packages/protocol/dist/index.js"],
    [
      "packages/core/dist/project-evidence.js",
      "@screenrec/composition",
      "packages/composition/dist/index.js",
    ],
    ["apps/cli/dist/main.js", "@screenrec/client", "packages/client/dist/index.js"],
    ["packages/client/dist/index.js", "@screenrec/protocol", "packages/protocol/dist/index.js"],
    [
      "packages/test-harness/editing/source-evidence-fixture.mjs",
      "@screenrec/protocol",
      "packages/protocol/dist/index.js",
    ],
  ]) {
    const path = await realpath(createRequire(join(root, importer)).resolve(specifier));
    assert.equal(
      path,
      await realpath(join(root, expected)),
      "A workspace import escaped the isolated build",
    );
    report.runtime.resolvedModules.push({
      importer,
      specifier,
      path,
      sha256: hash(await readFile(path)),
    });
  }
  await service.start();
  if (values.phase === "prepare") {
    const started = performance.now();
    const fixture = await prepareCardinality(home, out, call);
    report.setupMs = performance.now() - started;
    await writeFile(fixtureFile, JSON.stringify({ home, ...fixture }, null, 2));
    report.passed = true;
  } else {
    // This separate client intentionally uses the SDK's unconfigured default receive bound.
    client = new Client({ name: "source-cardinality-default-client", version: "1" });
    await client.connect(
      new StdioClientTransport({
        command: process.execPath,
        args: [join(root, "apps/cli/dist/main.js"), "mcp", "--socket", service.socketPath],
        stderr: "pipe",
      }),
    );
    const sdk = await readFile(
      new URL(import.meta.resolve("@modelcontextprotocol/sdk/shared/stdio.js")),
      "utf8",
    );
    report.defaultClient = {
      configured: false,
      maxBufferBytes: STDIO_DEFAULT_MAX_BUFFER_SIZE,
      sdkReadBufferSha256: hash(sdk),
    };
    const rss = async () => {
      const bytes =
        Number((await run("ps", ["-o", "rss=", "-p", String(service.child.pid)])).stdout.trim()) *
        1024;
      assert(Number.isFinite(bytes) && bytes > 0);
      return bytes;
    };
    report.baselineRssBytes = await rss();
    const expected = new Map(
      prepared.arms.map((arm) => [arm.cardinality, cardinalityOracle(prepared, arm)]),
    );
    if (values["wrong-clock"]) expected.get(512).rows[0].projectAtUs++;
    const collect = async (arm, label, transport = "mcp") => {
      const oracle = expected.get(arm.cardinality),
        rows = [],
        pages = [],
        seen = new Set();
      let cursor;
      const started = performance.now();
      do {
        const params = {
          projectId: arm.projectId,
          revisionId: arm.revisionId,
          range,
          limit: rowLimit - rows.length,
          ...(cursor ? { cursor } : {}),
        };
        const pageAt = performance.now();
        let response, delivered;
        const deadline = pageAt + 180000;
        let requests = 0;
        for (;;) {
          if (transport === "mcp") {
            delivered = await client.callTool({ name: "cursor.raw", arguments: params });
            assert.equal(
              delivered.structuredContent?.ok,
              true,
              delivered.isError ? JSON.stringify(delivered) : "MCP success required",
            );
            response = delivered.structuredContent.data;
          } else response = await call("cursor.raw", params, { transport });
          requests++;
          if (response.state === "ready") break;
          assert(
            ["queued", "processing"].includes(response.state),
            `Evidence preparation: ${response.state} (${response.reason})`,
          );
          assert(performance.now() < deadline, "Project evidence preparation deadline");
          await delay(100);
        }
        const next = response.page.nextCursor;
        assert(next, "The first 250 of 1024 occurrences must retain a continuation");
        assert(!seen.has(next.checkpointId), "A continuation repeated its checkpoint");
        seen.add(next.checkpointId);
        if (cursor)
          assert.deepEqual(
            { ...next, checkpointId: cursor.checkpointId },
            cursor,
            "Continuation changed its pinned query",
          );
        rows.push(...response.page.rows);
        pages.push({
          params,
          response,
          requests,
          latencyMs: performance.now() - pageAt,
          delivered,
        });
        cursor = next;
        assert(pages.length <= occurrences, "Continuation exceeded one checkpoint per occurrence");
      } while (rows.length < rowLimit);
      const totalMs = performance.now() - started;
      // Time delivery of the whole prefix; oracle comparisons, serialization telemetry and file IO are outside it.
      for (const page of pages) {
        const { response, delivered, params } = page;
        assert.equal(response.projectId, arm.projectId);
        assert.equal(response.revisionId, arm.revisionId);
        assert.deepEqual(response.dependencies, oracle.dependencies);
        assert.deepEqual(
          response.coverage,
          params.cursor
            ? { manifestId: response.page.nextCursor.manifestId }
            : { manifestId: response.page.nextCursor.manifestId, occurrences: oracle.coverage },
        );
        page.dataBytes = Buffer.byteLength(JSON.stringify(response));
        if (delivered) {
          assert.equal(delivered.content.length, 1);
          assert.equal(delivered.content[0].type, "text");
          assert.deepEqual(
            JSON.parse(delivered.content[0].text),
            delivered.structuredContent,
            "MCP text and structured bodies must agree",
          );
          page.mcpResultBytes = Buffer.byteLength(JSON.stringify(delivered));
        }
        delete page.delivered;
        if (label === "warm")
          assert.equal(page.requests, 1, "A warm collection must use already prepared evidence");
      }
      if (values["wrong-clock"])
        await writeFile(
          join(out, "wrong-clock-rows.json"),
          JSON.stringify({ actual: rows, expected: oracle.rows }),
        );
      assert.deepEqual(
        rows,
        oracle.rows,
        "Authored source and project clocks, observations and occurrence identities must match",
      );
      assert(
        pages.some(({ response }) => response.page.rows.length === 0),
        "Leading empty occurrences must exercise an empty continuation",
      );
      const result = {
        cardinality: arm.cardinality,
        label,
        transport,
        totalMs,
        pageCount: pages.length,
        rowsSha256: hash(JSON.stringify(rows)),
        nextCursor: cursor,
        pages: pages.map(({ response, ...page }) => ({
          ...page,
          rows: response.page.rows.length,
          cursor: response.page.nextCursor,
        })),
        rssBytes: await rss(),
      };
      // Count only dependency validation on warm ready reads, not cold revision/catalog loading.
      if (pages.every((page) => page.requests === 1)) {
        const resolves = arm.cardinality * (1 + 2 * pages.length);
        result.staticDependencyWork = {
          basis:
            "ProjectEvidenceInspection.request resolves N; read validates N twice per nonterminal page. CaptureSourceRead.resolve performs two acquisition.get, one asset.get and one asset.path per resolve. Other catalog work excluded.",
          sourceResolutions: resolves,
          acquisitionMetadataGets: 2 * resolves,
          assetMetadataGets: resolves,
          assetPathHeaderReads: resolves,
        };
      }
      report.collections.push(result);
      if (label !== "warm") {
        await writeFile(
          join(out, `${name}-${arm.cardinality}-${label}-${transport}-pages.json`),
          JSON.stringify(pages),
        );
        const files = new Set(
          pages.flatMap(({ response }) => [
            response.page.nextCursor.manifestId,
            response.page.nextCursor.checkpointId,
          ]),
        );
        const checkpoints = [];
        for (const id of files) {
          const bytes = await readFile(join(home, "library/cache/derived", `${id}.cache`));
          await writeFile(join(out, `${id}.cache.json`), bytes);
          checkpoints.push({ id, bytes: bytes.length, sha256: hash(bytes) });
        }
        result.cacheFiles = checkpoints;
        // A fresh UUID alone is not progress: persisted traversal state must also change.
        const positions = await Promise.all(
          pages.map(({ response }) =>
            readFile(
              join(home, "library/cache/derived", `${response.page.nextCursor.checkpointId}.cache`),
              "utf8",
            ),
          ),
        );
        assert.equal(
          new Set(positions.map(hash)).size,
          positions.length,
          "Checkpoint traversal repeated without progress",
        );
      }
      return { result, rows, pages };
    };
    const cold = new Map();
    for (const arm of prepared.arms) cold.set(arm.cardinality, await collect(arm, "cold"));
    if (values.phase === "measure") {
      for (let repeat = 0; repeat < report.controls.warmCollectionsPerArm; repeat++) {
        const order = repeat % 2 ? [...prepared.arms].reverse() : prepared.arms;
        for (const arm of order) {
          const { result } = await collect(arm, "warm");
          result.repeat = repeat;
        }
        console.log(`Completed warm pair ${repeat + 1}/${report.controls.warmCollectionsPerArm}`);
        await save();
      }
      report.arms = prepared.arms.map(({ cardinality }) => {
        const collections = report.collections.filter(
          (c) => c.cardinality === cardinality && c.label === "warm",
        );
        const times = collections.map((c) => c.totalMs).sort((a, b) => a - b);
        return {
          cardinality,
          p95Ms: times[Math.ceil(times.length * 0.95) - 1],
          minMs: times[0],
          maxMs: times.at(-1),
          sampledRssBytes: collections.map((c) => c.rssBytes),
          memoryMeaning:
            "Descriptive post-collection service RSS in one shared process; no duration ratio gate or per-arm attribution",
        };
      });
    } else {
      for (const arm of prepared.arms) {
        const mcp = cold.get(arm.cardinality);
        const cli = await collect(arm, "parity", "cli");
        assert.deepEqual(cli.rows, mcp.rows);
        // Manifest identity is stable; newly published continuation checkpoint IDs are intentionally fresh.
        const comparable = (pages) =>
          pages.map(({ response }) => ({
            ...response,
            page: {
              ...response.page,
              nextCursor: { ...response.page.nextCursor, checkpointId: "fresh" },
            },
          }));
        assert.deepEqual(comparable(cli.pages), comparable(mcp.pages));
        const cursor = mcp.pages[0].response.page.nextCursor;
        const refusal = await call(
          "cursor.raw",
          {
            projectId: arm.projectId,
            revisionId: arm.revisionId,
            range: { ...range, startUs: 1 },
            cursor,
          },
          { error: true },
        );
        assert.equal(refusal.code, "ARTIFACT_CHANGED");
      }
      report.pinnedRefusal = "ARTIFACT_CHANGED for changed full-window query";
    }
    report.passed = report.arms ? report.arms.every((arm) => arm.p95Ms <= 250) : true;
    if (!report.passed)
      throw new Error(
        "Complete cached 250-row collection exceeded unchanged 250ms p95 budget; retain and profile existing owner",
      );
  }
} catch (error) {
  report.error = { message: error.message, stack: error.stack };
  throw error;
} finally {
  await client?.close();
  await service.stop();
  report.nativeOperations = (await readFile(operationsFile, "utf8"))
    .trim()
    .split("\n")
    .filter(Boolean)
    .map(JSON.parse);
  if (values.phase !== "prepare")
    assert.deepEqual(
      report.nativeOperations.filter(
        ({ operation }) => operation !== "storage.clearRenderWorkspace",
      ),
      [],
      "No query-time native work",
    );
  await writeFile(join(out, `${name}-service.log`), service.logs.join(""));
  await save();
}
console.log(out);

import assert from "node:assert/strict";

/** Public consumption across a simulated recipe release; production queue/store publication stays real. */
export async function changedSceneGeneration({
  service,
  query,
  selected,
  baseline,
  source,
  pages,
}) {
  const call = service.call.bind(service);
  const originalJob = await call("job.get", { jobId: source.first.context.scene.jobId });
  assert.equal(originalJob.state, "ready");
  assert.deepEqual(
    await call("job.retry", { jobId: originalJob.jobId }, { transport: "mcp" }),
    originalJob,
  );
  const originalGeneration = source.first.context.scene.evidence.generation;
  assert.equal(originalGeneration, originalJob.attemptId);
  const cursor = baseline.first.page.nextCursor;
  assert.ok(cursor);
  const document = await call("revision.get", query);
  await service.stop();
  service.serviceModule = new URL("./generation-scene-service.mjs", import.meta.url);
  await service.start();
  const refusals = [];
  const refuse = async (phase) => {
    for (const transport of ["cli", "mcp"]) {
      const error = await call(
        "timeline.events",
        { ...query, cursor, limit: 1 },
        { transport, error: true },
      );
      assert.equal(error.code, "ARTIFACT_CHANGED");
      refusals.push({ phase, transport, error });
    }
  };
  await refuse("before replacement publication");
  const replacementSource = await pages(selected, 1);
  const replacementJob = await call("job.get", {
    jobId: replacementSource.first.context.scene.jobId,
  });
  const replacementGeneration = replacementSource.first.context.scene.evidence.generation;
  assert.notEqual(replacementJob.jobId, originalJob.jobId);
  assert.notEqual(replacementGeneration, originalGeneration);
  assert.equal(replacementGeneration, replacementJob.attemptId);
  const oldRecipe = JSON.parse(originalJob.input),
    newRecipe = JSON.parse(replacementJob.input);
  assert.notEqual(oldRecipe.implementationId, newRecipe.implementationId);
  assert.deepEqual({ ...newRecipe, implementationId: oldRecipe.implementationId }, oldRecipe);
  assert.deepEqual(replacementSource.rows, source.rows);
  await refuse("after replacement publication");
  const fresh = await pages(query, 1);
  assert.equal(fresh.first.revisionId, query.revisionId);
  const normalize = (rows) =>
    rows.map((row) => (row.kind === "scene" ? { ...row, generation: originalGeneration } : row));
  assert.deepEqual(normalize(fresh.rows), baseline.rows);
  assert.deepEqual(
    fresh.rows.filter((row) => row.kind === "cut"),
    baseline.rows.filter((row) => row.kind === "cut"),
  );
  assert.ok(
    fresh.rows
      .filter((row) => row.kind === "scene")
      .every((row) => row.generation === replacementGeneration),
  );
  assert.deepEqual(await call("revision.get", query), document);
  assert.deepEqual(await call("job.get", { jobId: originalJob.jobId }), originalJob);
  assert.deepEqual(await call("job.retry", { jobId: replacementJob.jobId }), replacementJob);
  return {
    boundary:
      "Simulated service release changes only scene sampler recipe identity. Actual frozen native sampler, queue, ingestion and CLI/MCP execute; no shipped second binary or cache eviction is claimed.",
    originalJob,
    replacementJob,
    originalGeneration,
    replacementGeneration,
    oldRecipe,
    newRecipe,
    refusals,
    replacementSource,
    fresh,
  };
}

/** Distinct transcript dependency pins and phrase consumers, with the established frozen ASR boundary. */
export async function changedTranscriptGeneration({ service, query, text, poll }) {
  const call = service.call.bind(service);
  const requests = [
    { operation: "transcript.get", params: query, field: "rows" },
    { operation: "transcript.search", params: { ...query, text }, field: "entries" },
  ];
  const baseline = [];
  for (const request of requests) {
    const full = await poll(
      () => call(request.operation, { ...request.params, limit: 500 }),
      (v) => v.state === "ready",
      "transcript baseline",
    );
    const first = await call(request.operation, { ...request.params, limit: 1 });
    assert.ok(first.page.nextCursor);
    baseline.push({ request, full, cursor: first.page.nextCursor });
  }
  const dependencies = baseline[0].full.dependencies;
  const originalJobs = [];
  for (const dependency of dependencies) {
    const job = await call("job.get", { jobId: dependency.jobId });
    assert.equal(job.state, "ready");
    assert.equal(job.attemptId, dependency.transcript.generation);
    assert.deepEqual(await call("job.retry", { jobId: job.jobId }, { transport: "mcp" }), job);
    originalJobs.push(job);
  }
  const document = await call("revision.get", query);
  await service.stop();
  service.serviceModule = new URL("./generation-transcript-service.mjs", import.meta.url);
  await service.start();
  const refusals = [];
  const refuse = async (phase) => {
    for (const { request, cursor } of baseline)
      for (const transport of ["cli", "mcp"]) {
        const error = await call(
          request.operation,
          { ...request.params, cursor, limit: 1 },
          { transport, error: true },
        );
        assert.equal(error.code, "ARTIFACT_CHANGED");
        refusals.push({ phase, operation: request.operation, transport, error });
      }
  };
  await refuse("before replacement publication");
  const replacements = [],
    previousGeneration = new Map();
  for (const dependency of dependencies) {
    const replacement = await poll(
      () => call("transcript.get", { ...dependency.selection, limit: 1 }),
      (v) => v.state === "ready",
      "replacement transcript",
    );
    assert.notEqual(replacement.generation, dependency.transcript.generation);
    previousGeneration.set(replacement.generation, dependency.transcript.generation);
    replacements.push(replacement);
  }
  await refuse("after replacement publication");
  const normalize = (value) =>
    Array.isArray(value)
      ? value.map(normalize)
      : value && typeof value === "object"
        ? Object.fromEntries(
            Object.entries(value).map(([key, item]) => {
              if (key === "generation") {
                assert.ok(previousGeneration.has(item));
                return [key, previousGeneration.get(item)];
              }
              return [key, normalize(item)];
            }),
          )
        : value;
  const fresh = [];
  for (const { request, full } of baseline) {
    let page = await poll(
      () => call(request.operation, { ...request.params, limit: 1 }),
      (v) => v.state === "ready",
      "fresh project transcript",
    );
    const first = page,
      rows = [];
    for (let i = 0; ; i++) {
      assert.ok(i < 1000, "Fresh transcript continuation terminates");
      assert.equal(page.revisionId, query.revisionId);
      rows.push(...page.page[request.field]);
      if (!page.page.nextCursor) break;
      page = await call(
        request.operation,
        { ...request.params, limit: 1, cursor: page.page.nextCursor },
        { transport: i % 2 ? "cli" : "mcp" },
      );
      assert.equal(page.state, "ready");
    }
    assert.deepEqual(normalize(rows), full.page[request.field]);
    fresh.push({ operation: request.operation, first, rows });
  }
  const replacementJobs = [];
  for (let i = 0; i < dependencies.length; i++) {
    const dependency = fresh[0].first.dependencies[i];
    assert.deepEqual(dependency.selection, dependencies[i].selection);
    const job = await call("job.get", { jobId: dependency.jobId });
    assert.notEqual(job.jobId, originalJobs[i].jobId);
    assert.equal(job.attemptId, dependency.transcript.generation);
    const before = JSON.parse(originalJobs[i].input),
      after = JSON.parse(job.input);
    assert.notEqual(after.decoderExecution, before.decoderExecution);
    assert.deepEqual({ ...after, decoderExecution: before.decoderExecution }, before);
    assert.deepEqual(await call("job.get", { jobId: originalJobs[i].jobId }), originalJobs[i]);
    assert.deepEqual(await call("job.retry", { jobId: job.jobId }), job);
    replacementJobs.push(job);
  }
  assert.deepEqual(await call("revision.get", query), document);
  return {
    boundary:
      "Simulated decoder recipe release. Native ASR responses are frozen; actual queue, raw ingestion and CLI/MCP transcript/phrase consumers execute. No fresh native ASR, shipped second binary or cache eviction is claimed.",
    baseline,
    originalJobs,
    replacementJobs,
    replacements,
    refusals,
    fresh,
  };
}

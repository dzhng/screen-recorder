import { afterEach, expect, test } from "vitest";
import { chmod, mkdtemp, mkdir, open, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileIdentity } from "@screenrec/core/files";
import { MAX_MEDIA_TIMEOUT_MS } from "./worker.js";
import { sourceExporter } from "./source-export.js";

const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});

test("source exporter preserves retryable access failures and definitive identity conflicts", async () => {
  const root = await mkdtemp(join(tmpdir(), "source-export-access-"));
  roots.push(root);
  const source = join(root, "source");
  await mkdir(source);
  const path = join(source, "narration.mov");
  await writeFile(path, "immutable input");
  const file = await open(path);
  const stat = await file.stat({ bigint: true });
  await file.close();
  const canonical = { narration: { path, bytes: Number(stat.size), identity: fileIdentity(stat) } };
  const exportSource = sourceExporter(async () => ({ ok: true, data: { marker: "verified" } }));
  const run = () =>
    exportSource(source, join(root, "out.jsonl"), new AbortController().signal, canonical);
  await chmod(path, 0);
  try {
    await expect(run()).rejects.toMatchObject({ code: "MEDIA_UNAVAILABLE", retryable: true });
  } finally {
    await chmod(path, 0o600);
  }
  // chmod changes ctime: an already admitted descriptor identity must still refuse it.
  await expect(run()).rejects.toMatchObject({ code: "SOURCE_CHANGED", retryable: false });
  const restored = await open(path);
  canonical.narration.identity = fileIdentity(await restored.stat({ bigint: true }));
  await restored.close();
  await expect(run()).resolves.toMatchObject({ marker: "verified" });
  await writeFile(path, "changed identity");
  await expect(run()).rejects.toMatchObject({ code: "SOURCE_CHANGED", retryable: false });
});

test("video-only capture authority receives bounded byte-scaled verification time", async () => {
  const root = await mkdtemp(join(tmpdir(), "source-export-authority-"));
  roots.push(root);
  const directory = join(root, "source");
  await mkdir(directory);
  await writeFile(join(directory, "capture.journal.jsonl"), "journal");
  const path = join(directory, "video.mov");
  const sourceAuthority = {
    source: {
      kind: "primary" as const,
      sourceId: "source",
      sourceDurationUs: 1000000,
      originHostUs: 0,
      diagnostic: { code: "CAPTURE_RECOVERED", message: "Recovered" },
      journal: {
        file: "source.journal.jsonl" as const,
        bytes: 7,
        sha256: "a".repeat(64),
        lastSequence: 1,
        layout: 2 as const,
      },
      members: { "video.mov": { bytes: "0", sha256: "b".repeat(64) } },
    },
    receipt: { bytes: "100", sha256: "c".repeat(64) },
  };
  const budgets: number[] = [];
  const exportSource = sourceExporter(async (_operation, params, options) => {
    const budget = options?.timeoutMs ?? 30000;
    // Simulated verification needs one minute. No wall-clock delay or throughput claim.
    if (budget < 60000)
      return {
        ok: false,
        error: {
          code: "TIMEOUT",
          message: "Verification work exhausted its budget",
          details: {},
          retryable: true,
        },
      };
    if (params.sourceAuthority) budgets.push(budget);
    expect(budget).toBeLessThanOrEqual(MAX_MEDIA_TIMEOUT_MS);
    return { ok: true, data: { marker: "verified" } };
  });
  for (const bytes of [4096, 2 ** 30]) {
    const file = await open(path, "w+");
    // Sparse bytes expose scaling without allocating or decoding a large fixture.
    await file.truncate(bytes);
    const stat = await file.stat({ bigint: true });
    await file.close();
    const canonical = { video: { path, bytes, identity: fileIdentity(stat) } };
    sourceAuthority.source.members["video.mov"].bytes = String(bytes);
    await expect(
      exportSource(directory, join(root, "legacy.jsonl"), new AbortController().signal, canonical),
    ).rejects.toMatchObject({ code: "TIMEOUT" });
    await expect(
      exportSource(
        directory,
        join(root, "capture.jsonl"),
        new AbortController().signal,
        canonical,
        [],
        sourceAuthority,
      ),
    ).resolves.toMatchObject({ marker: "verified" });
  }
  expect(budgets[1]).toBeGreaterThan(budgets[0]!);
});

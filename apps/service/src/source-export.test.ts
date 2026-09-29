import { afterEach, expect, test } from "vitest";
import { chmod, mkdtemp, mkdir, open, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileIdentity } from "@screenrec/core/files";
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

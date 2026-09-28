import { selectSource } from "./source-selection.js";
import { ProjectStore } from "./projects.js";
import { compositionAsset } from "./assets.js";
import { createSourceRangeProjection, validateComposition } from "@screenrec/composition";
import { afterEach, expect, test } from "vitest";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { Catalog, CatalogError } from "./catalog.js";
import { AssetStore } from "./assets.js";
import { SourceEvidenceStore } from "./evidence.js";
import { AcquisitionStore, AcquisitionImporter } from "./acquisitions.js";
import type { SourceExporter } from "./processing.js";

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const dispose of cleanup.splice(0).reverse()) await dispose();
});
const signal = () => new AbortController().signal;
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "acquisition-"));
  cleanup.push(() => rm(root, { recursive: true, force: true }));
  const catalog = new Catalog(join(root, "catalog.sqlite"));
  cleanup.push(async () => catalog.close());
  const assets = new AssetStore(catalog, root);
  await assets.recover();
  const acquisitions = new AcquisitionStore(catalog);
  const evidence = new SourceEvidenceStore(catalog, (identity) => {
    if (identity.owner.kind !== "acquisition") throw new CatalogError("NOT_FOUND", "Wrong domain");
    acquisitions.intent(identity.owner.acquisitionId);
  });
  const importer = new AcquisitionImporter(catalog, acquisitions, assets, evidence, root);
  await importer.recover(signal());
  const donor = join(root, "donor");
  await mkdir(donor);
  const journal = JSON.stringify({
    sessionID: "capture-session",
    intervals: [
      { startUs: 100, endUs: 140 },
      { startUs: 160, endUs: 200 },
    ],
  });
  await writeFile(join(donor, "capture.journal.jsonl"), journal);
  await writeFile(join(donor, "video.mov"), "video");
  await writeFile(join(donor, "narration.mov"), "narration");
  const exportSource: SourceExporter = async (directory, output) => {
    // Native boundary fixture: parsing/capture acceptance belongs to the live native journey.
    const input = JSON.parse(await readFile(join(directory, "capture.journal.jsonl"), "utf8"));
    const body = input.intervals
      .map(
        (interval: { startUs: number; endUs: number }) =>
          JSON.stringify({ event: "audioAcquired", data: { role: "narration", ...interval } }) +
          "\n",
      )
      .join("");
    await writeFile(output, body);
    return {
      file: output,
      journal: "capture.journal.jsonl",
      header: { sessionID: input.sessionID },
      cursorSamples: 0,
      geometryRecords: 0,
      displaySpaces: 0,
      pauseEvents: 0,
      audioIntervals: input.intervals.length,
      lastSequence: input.intervals.length,
      incompleteTail: false,
      finished: true,
      bytes: Buffer.byteLength(body),
    };
  };
  const probe = async (path: string) => {
    const kind = (await readFile(path, "utf8")) === "video" ? "video" : "audio";
    return {
      originUs: 100,
      streams: [
        {
          id: "track:1",
          kind,
          codec: "fixture",
          decodable: true,
          startUs: 0,
          endUs: 100,
          segments: [{ startUs: 0, endUs: 100, empty: false }],
        },
      ],
    };
  };
  return {
    root,
    catalog,
    assets,
    evidence,
    acquisitions,
    importer,
    donor,
    journal,
    native: { probe, exportSource },
    admit: async (requestId = "import") => {
      const prepared = await importer.prepareImport(requestId, donor);
      return catalog.transaction(() => acquisitions.admitImport(prepared));
    },
  };
}

test("adoption retains raw clock evidence, normalized masks and owned bytes after donor deletion", async () => {
  const f = await fixture();
  const intent = await f.admit();
  const value = await f.importer.executeImport(
    intent.acquisitionId,
    "attempt-1",
    f.native,
    signal(),
  );
  await rm(f.donor, { recursive: true });
  expect(await readFile(f.importer.journalPath(value.id), "utf8")).toBe(f.journal);
  expect(value.journal.sha256).toBe(createHash("sha256").update(f.journal).digest("hex"));
  expect(
    value.bindings.map(({ sourceRoles, available, sourceToAssetOffsetUs, supportBasis }) => ({
      sourceRoles,
      available,
      sourceToAssetOffsetUs,
      supportBasis,
    })),
  ).toEqual([
    {
      sourceRoles: ["video"],
      available: [{ startUs: 0, endUs: 100 }],
      sourceToAssetOffsetUs: -100,
      supportBasis: "physical",
    },
    {
      sourceRoles: ["narration"],
      available: [
        { startUs: 0, endUs: 40 },
        { startUs: 60, endUs: 100 },
      ],
      sourceToAssetOffsetUs: -100,
      supportBasis: "captured-audio",
    },
  ]);
  expect(f.evidence.audio(value.evidence, "narration", { startUs: 0, endUs: 300 })).toEqual([
    { startUs: 100, endUs: 140 },
    { startUs: 160, endUs: 200 },
  ]);
  for (const binding of value.bindings) {
    expect(await readFile(f.assets.path(binding.assetId), "utf8")).toBe(binding.sourceRoles[0]);
    expect(f.assets.references(binding.assetId)).toEqual([{ kind: "acquisition", id: value.id }]);
  }
  expect(await f.importer.prepareImport("import", f.donor)).toEqual(intent);
  expect(await f.importer.executeImport(value.id, "attempt-2", f.native, signal())).toEqual(value);
  await f.importer.recover(signal());
  expect(f.acquisitions.get(value.id)).toEqual(value);
});

test("same media keeps explicit contexts through project replay, replacement, undo and reopening", async () => {
  const f = await fixture();
  const first = await f.admit();
  const a = await f.importer.executeImport(first.acquisitionId, "a", f.native, signal());
  await writeFile(
    join(f.donor, "capture.journal.jsonl"),
    JSON.stringify({ sessionID: "capture-session", intervals: [{ startUs: 100, endUs: 200 }] }),
  );
  const second = await f.admit("second");
  const b = await f.importer.executeImport(second.acquisitionId, "b", f.native, signal());
  const assetId = a.bindings.find((binding) => binding.sourceRoles.includes("narration"))!.assetId;
  expect(b.bindings.find((binding) => binding.sourceRoles.includes("narration"))!.assetId).toBe(
    assetId,
  );
  const projects = new ProjectStore(f.catalog, f.assets, f.acquisitions);
  const created = projects.create({
    requestId: "project",
    canvas: {
      width: 160,
      height: 90,
      fps: { numerator: 30, denominator: 1 },
      background: "#000000ff",
    },
  });
  const projectId = created.project.projectId;
  const request = {
    requestId: "place",
    expectedRevisionId: created.revision.id,
    operations: [
      { operation: "track.add", label: "audio", track: { kind: "audio", order: 0 } },
      ...[a.id, b.id, undefined].map((acquisitionId, index) => ({
        operation: "place",
        label: `clip-${index}`,
        clip: {
          assetId,
          streamId: "track:1",
          ...(acquisitionId ? { acquisitionId } : {}),
          trackId: { label: "audio" },
          source: { kind: "range", range: { startUs: 0, endUs: 100 } },
          placement: { kind: "project", range: { startUs: index * 100, endUs: (index + 1) * 100 } },
        },
      })),
    ],
  };
  const placed = projects.apply(projectId, request);
  expect(projects.apply(projectId, request)).toEqual(placed);
  const completeness = (revisionId: string) => {
    const revision = projects.revision(projectId, revisionId);
    return createSourceRangeProjection(
      validateComposition(
        revision.document,
        [compositionAsset(f.assets.get(assetId))],
        projects.contexts(revision.document),
      ),
    )
      .all({ assetId, streamId: "track:1", range: { startUs: 30, endUs: 70 } })
      .map((row) => row.completeness);
  };
  expect(completeness(placed.revision.id)).toEqual(["partial", "whole", "whole"]);
  const replaced = projects.apply(projectId, {
    requestId: "replace",
    expectedRevisionId: placed.revision.id,
    operations: [
      {
        operation: "replace",
        clipId: placed.edit.labels["clip-0"],
        kind: "audio",
        media: {
          assetId,
          streamId: "track:1",
          source: { kind: "range", range: { startUs: 0, endUs: 100 } },
        },
      },
    ],
  });
  expect(completeness(replaced.revision.id)).toEqual(["whole", "whole", "whole"]);
  expect(completeness(placed.revision.id)).toEqual(["partial", "whole", "whole"]);
  const undone = projects.undo(projectId, {
    requestId: "undo",
    expectedRevisionId: replaced.revision.id,
  });
  expect(completeness(undone.id)).toEqual(["partial", "whole", "whole"]);
  expect(f.acquisitions.references(a.id)).toEqual(
    expect.arrayContaining([
      { kind: "revision", id: placed.revision.id },
      { kind: "revision", id: undone.id },
    ]),
  );
  const reopenedCatalog = new Catalog(join(f.root, "catalog.sqlite"));
  cleanup.push(async () => reopenedCatalog.close());
  const reopened = new ProjectStore(reopenedCatalog, new AssetStore(reopenedCatalog, f.root));
  expect(reopened.apply(projectId, request)).toEqual(placed);
  expect(reopened.contexts(reopened.revision(projectId).document)).toEqual([
    f.acquisitions.context(a.id),
    f.acquisitions.context(b.id),
  ]);
});

test("changed frozen members refuse publication and canceled adoption releases partial dependencies", async () => {
  const f = await fixture();
  const changed = await f.admit();
  await writeFile(join(f.donor, "capture.journal.jsonl"), f.journal + "\n");
  await expect(
    f.importer.executeImport(changed.acquisitionId, "changed", f.native, signal()),
  ).rejects.toMatchObject({ code: "SOURCE_CHANGED" });
  expect(() => f.acquisitions.get(changed.acquisitionId)).toThrow(
    expect.objectContaining({ code: "NOT_READY" }),
  );
  const fresh = await f.admit("fresh");
  const controller = new AbortController();
  let probes = 0;
  await expect(
    f.importer.executeImport(
      fresh.acquisitionId,
      "canceled",
      {
        ...f.native,
        probe: async (path, probeSignal) => {
          const value = await f.native.probe(path);
          if (++probes === 2) controller.abort(new Error("cancel import"));
          probeSignal.throwIfAborted();
          return value;
        },
      },
      controller.signal,
    ),
  ).rejects.toThrow("cancel import");
  expect(probes).toBe(2);
  expect(() => f.acquisitions.get(fresh.acquisitionId)).toThrow(
    expect.objectContaining({ code: "NOT_READY" }),
  );
  for (const asset of f.assets.list().assets) expect(f.assets.references(asset.id)).toEqual([]);
  expect(() =>
    f.evidence.audio(
      {
        owner: { kind: "acquisition", acquisitionId: fresh.acquisitionId },
        sourceId: "capture-session",
        generation: "canceled",
      },
      "narration",
      { startUs: 0, endUs: 300 },
    ),
  ).toThrow(expect.objectContaining({ code: "NOT_READY" }));
  await f.importer.recover(signal());
  const value = await f.importer.executeImport(fresh.acquisitionId, "retried", f.native, signal());
  expect(value.evidence.generation).toBe("retried");
  expect(value.bindings.map((row) => row.sourceRoles)).toEqual([["video"], ["narration"]]);
});

test("identical captured role files share one usable binding only when their support agrees", async () => {
  const f = await fixture();
  await writeFile(join(f.donor, "system.mov"), "narration");
  for (const conflict of [false, true]) {
    await writeFile(
      join(f.donor, "capture.journal.jsonl"),
      JSON.stringify({
        sessionID: "capture-session",
        intervals: [
          { role: "narration", startUs: 100, endUs: 200 },
          { role: "system", startUs: 100, endUs: conflict ? 190 : 200 },
        ],
      }),
    );
    const intent = await f.admit(conflict ? "conflict" : "equal");
    const result = f.importer.executeImport(
      intent.acquisitionId,
      conflict ? "different" : "same",
      f.native,
      signal(),
    );
    if (conflict) {
      await expect(result).rejects.toMatchObject({ code: "UNSUPPORTED_MEDIA" });
      expect(() => f.acquisitions.get(intent.acquisitionId)).toThrow(
        expect.objectContaining({ code: "NOT_READY" }),
      );
    } else {
      const value = await result;
      expect(value.bindings.map((row) => row.sourceRoles)).toEqual([
        ["video"],
        ["narration", "system"],
      ]);
      expect(f.acquisitions.context(value.id).bindings).toHaveLength(2);
      expect(value.bindings[1]!.available).toEqual([{ startUs: 0, endUs: 100 }]);
    }
  }
});

test("unacquired audio remains empty and ambiguous capture streams refuse publication", async () => {
  const f = await fixture();
  await writeFile(
    join(f.donor, "capture.journal.jsonl"),
    JSON.stringify({ sessionID: "capture-session", intervals: [] }),
  );
  const empty = await f.admit();
  const value = await f.importer.executeImport(empty.acquisitionId, "empty", f.native, signal());
  expect(value.bindings.find((row) => row.sourceRoles.includes("narration"))!.available).toEqual(
    [],
  );
  const ambiguous = await f.admit("ambiguous");
  // Distinct media bytes force a new native probe rather than immutable-asset deduplication.
  await writeFile(join(f.donor, "narration.mov"), "different audio");
  const fresh = await f.admit("fresh-multiple");
  await expect(
    f.importer.executeImport(
      fresh.acquisitionId,
      "multiple",
      {
        ...f.native,
        probe: async (path) => {
          const result = await f.native.probe(path);
          if (result.streams[0]!.kind === "audio")
            result.streams.push({ ...result.streams[0]!, id: "track:2" });
          return result;
        },
      },
      signal(),
    ),
  ).rejects.toMatchObject({ code: "UNSUPPORTED_MEDIA" });
  expect(() => f.acquisitions.get(fresh.acquisitionId)).toThrow(
    expect.objectContaining({ code: "NOT_READY" }),
  );
  await expect(
    f.importer.executeImport(ambiguous.acquisitionId, "changed", f.native, signal()),
  ).rejects.toMatchObject({ code: "SOURCE_CHANGED" });
});

test("source inspection uses the same physical/context support and asset clock as composition", async () => {
  const f = await fixture();
  const admitted = await f.admit();
  const acquisition = await f.importer.executeImport(
    admitted.acquisitionId,
    "selected",
    f.native,
    signal(),
  );
  const binding = acquisition.bindings.find((value) => value.sourceRoles.includes("narration"))!;
  const selector = { assetId: binding.assetId, streamId: binding.streamId };
  const physical = selectSource(f.assets, f.acquisitions, selector);
  const captured = selectSource(f.assets, f.acquisitions, {
    ...selector,
    acquisitionId: acquisition.id,
  });
  expect(physical.track).toEqual({
    source: f.assets.path(binding.assetId),
    streamId: binding.streamId,
    sourceOffsetUs: -100,
    available: [{ startUs: 0, endUs: 100 }],
  });
  expect(captured.track).toEqual({
    ...physical.track,
    available: [
      { startUs: 0, endUs: 40 },
      { startUs: 60, endUs: 100 },
    ],
  });
  expect(captured.durationUs).toBe(100);
  expect(captured.supportDigest).not.toBe(physical.supportDigest);
  expect(selectSource(f.assets, f.acquisitions, selector)).toEqual(physical);
  const unrelated = await f.assets.import(
    join(f.donor, "capture.journal.jsonl"),
    { kind: "import" },
    f.native.probe,
  );
  expect(() =>
    selectSource(f.assets, f.acquisitions, {
      ...selector,
      assetId: unrelated.id,
      acquisitionId: acquisition.id,
    }),
  ).toThrow(expect.objectContaining({ code: "INVALID_PARAMS" }));
  expect(() =>
    selectSource(f.assets, f.acquisitions, { ...selector, streamId: "missing" }),
  ).toThrow(expect.objectContaining({ code: "UNSUPPORTED_MEDIA" }));
});

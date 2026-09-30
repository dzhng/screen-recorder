import { createHash } from "node:crypto";
import { archiveLimits, projectJsonBytes } from "./package-archive.js";
import {
  projectPackageManifest,
  validateProjectPackage,
  resourceMetadataMember,
  parseProjectPackageManifest,
} from "./project-package.js";
import type { ProjectSnapshot } from "./projects.js";

import { test, expect } from "vitest";
import {
  collectPortableResources,
  resourceIdentity,
  type PortableResource,
} from "./project-package.js";

test("portable inventory follows generated reference chains and rejects missing dependencies within a bound", () => {
  const records = new Map([
    ["speech", { asset: { id: "speech" }, dependencies: ["reference"] }],
    ["reference", { asset: { id: "reference" }, dependencies: ["original"] }],
    ["original", { asset: { id: "original" }, dependencies: [] }],
  ]);
  const read = ({ id }: { id: string }): PortableResource => {
    const value = records.get(id);
    if (!value) throw new Error("missing reference");
    return {
      kind: "asset",
      asset: {
        ...value.asset,
        bytes: 0,
        fileName: id,
        createdAt: "fixture",
        originUs: 0,
        streams: [],
      },
      origins: [],
      dependencies: value.dependencies.map((id) => ({ kind: "asset", id })),
    };
  };
  const roots = (...ids: string[]) => ids.map((id) => ({ kind: "asset" as const, id }));
  expect(
    collectPortableResources(roots("speech", "original"), read).map(
      (item) => resourceIdentity(item).id,
    ),
  ).toEqual(["original", "reference", "speech"]);
  expect(() => collectPortableResources(roots("speech"), read, 2)).toThrow(/limit/);
  records.delete("reference");
  expect(() => collectPortableResources(roots("speech"), read)).toThrow("missing reference");
});

function snapshotFixture(): ProjectSnapshot {
  return {
    project: { projectId: "donor", title: "Editable", createdAt: "now", currentRevisionId: "r0" },
    revisions: [
      {
        id: "r0",
        projectId: "donor",
        ordinal: 0,
        createdAt: "now",
        operation: "create",
        document: {
          canvas: {
            width: 160,
            height: 96,
            fps: { numerator: 30, denominator: 1 },
            background: "#000000ff",
          },
          tracks: [],
          groups: [],
          clips: [],
          syncGroups: [],
          processing: [],
        },
      },
    ],
    undo: [],
    references: [],
  };
}

test("portable manifest validates complete history bytes, undo targets, paths and declared media closure", () => {
  const snapshot = snapshotFixture();
  const text = JSON.stringify(snapshot.revisions[0]);
  const path = "revisions/0.json";
  const revisions = new Map([[path, text]]);
  const manifest = projectPackageManifest(
    snapshot,
    [],
    [
      {
        path,
        bytes: Buffer.byteLength(text),
        sha256: createHash("sha256").update(text).digest("hex"),
      },
    ],
  );
  const validate = (value: unknown, entries = revisions) =>
    validateProjectPackage(JSON.stringify(value), entries, archiveLimits);
  expect(validate(manifest).snapshot).toEqual(snapshot);
  const second = { ...snapshot.revisions[0]!, id: "r1", ordinal: 1, operation: "apply" as const };
  const secondText = JSON.stringify(second);
  const two = {
    ...snapshot,
    project: { ...snapshot.project, currentRevisionId: "r1" },
    revisions: [...snapshot.revisions, second],
  };
  const twoInventory = [
    ...manifest.inventory,
    {
      path: "revisions/1.json",
      bytes: Buffer.byteLength(secondText),
      sha256: createHash("sha256").update(secondText).digest("hex"),
    },
  ];
  expect(
    validateProjectPackage(
      JSON.stringify(projectPackageManifest(two, [], twoInventory)),
      new Map([...revisions, ["revisions/1.json", secondText]]),
      { ...archiveLimits, revisionBytes: 1 },
    ).snapshot,
  ).toEqual(two);
  expect(() =>
    validate(manifest, new Map([[path, text.replace("Editable", "Changed") + " "]])),
  ).toThrow(/hash or size/);
  expect(() => validate({ ...manifest, undo: ["missing"] })).toThrow(/undo target/);
  expect(() =>
    validate({
      ...manifest,
      inventory: [...manifest.inventory, { ...manifest.inventory[0], path: "../outside" }],
    }),
  ).toThrow(/inventory member/);
  expect(() =>
    validate({
      ...manifest,
      inventory: [...manifest.inventory, { ...manifest.inventory[0], path: "unreferenced.json" }],
    }),
  ).toThrow(/Unreferenced/);
  expect(() =>
    validateProjectPackage(JSON.stringify(manifest), revisions, {
      ...archiveLimits,
      expandedBytes: 1,
    }),
  ).toThrow(/byte limit/);
});

test("inventory-bound asset metadata is mandatory, exact and validated before closure", () => {
  const snapshot = snapshotFixture();
  const resource: Extract<PortableResource, { kind: "asset" }> = {
    kind: "asset",
    asset: {
      id: "a".repeat(64),
      bytes: 1,
      fileName: "a".repeat(64) + ".mov",
      createdAt: "now",
      originUs: 100001,
      streams: [
        {
          id: "audio:0",
          kind: "audio",
          codec: "pcm",
          decodable: true,
          startUs: 0,
          endUs: 30,
          channels: 1,
          sampleRate: 48000,
          segments: [
            { startUs: 0, endUs: 10, empty: true },
            { startUs: 10, endUs: 30, empty: false, mediaStartUs: 0, mediaDurationUs: 20 },
          ],
        },
      ],
    },
    origins: [],
    dependencies: [],
  };
  snapshot.references = [
    { revisionId: "r0", resources: [{ kind: "asset", id: resource.asset.id }] },
  ];
  const revision = JSON.stringify(snapshot.revisions[0]);
  const revisions = new Map([["revisions/0.json", revision]]);
  const member = resourceMetadataMember(resource);
  const manifest = projectPackageManifest(
    snapshot,
    [resource],
    [
      {
        path: "revisions/0.json",
        bytes: Buffer.byteLength(revision),
        sha256: createHash("sha256").update(revision).digest("hex"),
      },
      {
        path: `assets/${resource.asset.fileName}`,
        bytes: resource.asset.bytes,
        sha256: resource.asset.id,
      },
      member.reference.metadata,
    ],
  );
  const read = (
    metadata = new Map([[member.reference.metadata.path, member.body]]),
    value = manifest,
  ) => validateProjectPackage(JSON.stringify(value), revisions, archiveLimits, metadata);
  expect(read().resources).toEqual([resource]);
  expect(() => read(new Map())).toThrow(/metadata member hash or size/);
  expect(() => read(new Map([[member.reference.metadata.path, member.body + " "]]))).toThrow(
    /metadata member hash or size/,
  );
  expect(() =>
    read(
      new Map([
        [member.reference.metadata.path, member.body],
        ["extra", "{}"],
      ]),
    ),
  ).toThrow(/Unexpected resource metadata/);
  for (const version of [1, 2])
    expect(() => read(undefined, { ...manifest, version } as never)).toThrow(/project.*version/);
  const duplicate = structuredClone(resource);
  duplicate.asset.streams.push({ ...duplicate.asset.streams[0]!, segments: [] });
  const duplicateMember = resourceMetadataMember(duplicate);
  const duplicateManifest = {
    ...manifest,
    resources: [duplicateMember.reference],
    inventory: manifest.inventory.map((entry) =>
      entry.path === member.reference.metadata.path ? duplicateMember.reference.metadata : entry,
    ),
  };
  expect(() =>
    read(new Map([[member.reference.metadata.path, duplicateMember.body]]), duplicateManifest),
  ).toThrow(/schema/);
  const substituted = JSON.stringify({
    ...resource,
    asset: { ...resource.asset, id: "b".repeat(64), fileName: `${"b".repeat(64)}.wav` },
  });
  const substitutedRef = {
    ...member.reference.metadata,
    bytes: Buffer.byteLength(substituted),
    sha256: createHash("sha256").update(substituted).digest("hex"),
  };
  expect(() =>
    read(new Map([[substitutedRef.path, substituted]]), {
      ...manifest,
      resources: [{ ...member.reference, metadata: substitutedRef }],
      inventory: manifest.inventory.map((entry) =>
        entry.path === substitutedRef.path ? substitutedRef : entry,
      ),
    }),
  ).toThrow(/identity/);
  const oversized = { ...member.reference.metadata, bytes: projectJsonBytes + 1 };
  const tooLarge = {
    ...manifest,
    resources: [{ ...member.reference, metadata: oversized }],
    inventory: manifest.inventory.map((entry) =>
      entry.path === oversized.path ? oversized : entry,
    ),
  };
  expect(() =>
    parseProjectPackageManifest(JSON.stringify(tooLarge), revisions, archiveLimits),
  ).toThrow(
    expect.objectContaining({
      code: "LIMIT_EXCEEDED",
      details: {
        aggregateJsonBytes: projectJsonBytes + 1 + Buffer.byteLength(revision),
        maximumJsonBytes: projectJsonBytes,
      },
    }),
  );
});

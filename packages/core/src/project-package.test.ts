import { createHash } from "node:crypto";
import { archiveLimits } from "./package-archive.js";
import { projectPackageManifest, validateProjectPackage } from "./project-package.js";
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

test("portable manifest validates complete history bytes, undo targets, paths and declared media closure", () => {
  const snapshot: ProjectSnapshot = {
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
          captions: [],
        },
      },
    ],
    undo: [],
  };
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
  expect(() =>
    validateProjectPackage(
      JSON.stringify(projectPackageManifest(two, [], twoInventory)),
      new Map([...revisions, ["revisions/1.json", secondText]]),
      {
        ...archiveLimits,
        revisionBytes: Math.max(Buffer.byteLength(text), Buffer.byteLength(secondText)) + 1,
      },
    ),
  ).toThrow(/revision byte budget/);
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

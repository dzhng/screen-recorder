import { createHash } from "node:crypto";
import { archiveLimits } from "./package-archive.js";
import { projectPackageManifest, validateProjectPackage } from "./project-package.js";
import type { ProjectSnapshot } from "./projects.js";

import { test, expect } from "vitest";
import { collectPortableAssets } from "./project-package.js";

test("portable inventory follows generated reference chains and rejects missing dependencies within a bound", () => {
  const records = new Map([
    ["speech", { asset: { id: "speech" }, dependencies: ["reference"] }],
    ["reference", { asset: { id: "reference" }, dependencies: ["original"] }],
    ["original", { asset: { id: "original" }, dependencies: [] }],
  ]);
  const read = (id: string) => {
    const value = records.get(id);
    if (!value) throw new Error("missing reference");
    return value;
  };
  expect(collectPortableAssets(["speech", "original"], read).map((item) => item.asset.id)).toEqual([
    "original",
    "reference",
    "speech",
  ]);
  expect(() => collectPortableAssets(["speech"], read, 2)).toThrow(/limit/);
  records.delete("reference");
  expect(() => collectPortableAssets(["speech"], read)).toThrow("missing reference");
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

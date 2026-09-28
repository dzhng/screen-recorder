import { createHash } from "node:crypto";
import { z } from "zod";
import { isMediaClip, validateComposition } from "@screenrec/composition";
import { CatalogError } from "./catalog.js";
import { compositionAsset, portableAssetSchema, type PortableAsset } from "./assets.js";
import { validateProjectSnapshot, type ProjectSnapshot } from "./projects.js";
import type { ArchiveLimits } from "./package-archive.js";

const digest = z.string().regex(/^[a-f0-9]{64}$/);
const member = z.strictObject({
  path: z.string(),
  bytes: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  sha256: digest,
});
const manifestSchema = z.strictObject({
  format: z.literal("screenrec-project"),
  version: z.literal(1),
  project: z.unknown(),
  undo: z.array(z.string()).max(1000),
  revisions: z.array(z.string()).min(1).max(1000),
  assets: z.array(portableAssetSchema).max(25_000),
  inventory: z.array(member).max(25_000),
});
export type ProjectPackageManifest = z.infer<typeof manifestSchema>;
export type ValidatedProjectPackage = ProjectPackageManifest & { snapshot: ProjectSnapshot };
function invalid(message: string): never {
  throw new CatalogError("INVALID_PACKAGE", message);
}

/** The same graph walk selects an export closure and checks an imported closure; cycles terminate by identity. */
export function collectPortableAssets<T extends { asset: { id: string }; dependencies: string[] }>(
  roots: readonly string[],
  read: (id: string) => T,
  limit = 25_000,
): T[] {
  const found = new Map<string, T>(),
    pending = [...new Set(roots)];
  for (let position = 0; position < pending.length; position++) {
    const id = pending[position]!;
    if (found.has(id)) continue;
    if (found.size >= limit)
      throw new CatalogError("LIMIT_EXCEEDED", "Portable dependency inventory exceeds its limit");
    const value = read(id);
    if (value.asset.id !== id) invalid("Dependency identity differs from inventory key");
    found.set(id, value);
    for (const dependency of value.dependencies)
      if (!found.has(dependency)) pending.push(dependency);
    if (pending.length > limit * 2)
      throw new CatalogError("LIMIT_EXCEEDED", "Portable dependency edges exceed their limit");
  }
  return [...found.values()].sort((a, b) => a.asset.id.localeCompare(b.asset.id));
}
export function projectAssetRoots(snapshot: ProjectSnapshot): string[] {
  const clips = snapshot.revisions.flatMap((revision) =>
    revision.document.clips.filter(isMediaClip),
  );
  if (clips.some((clip) => clip.acquisitionId))
    throw new CatalogError(
      "UNSUPPORTED_PACKAGE_DEPENDENCY",
      "Capture evidence adoption is not yet supported by project packages",
    );
  return [...new Set(clips.map((clip) => clip.assetId))];
}
export function projectPackageManifest(
  snapshot: ProjectSnapshot,
  assets: PortableAsset[],
  inventory: ProjectPackageManifest["inventory"],
): ProjectPackageManifest {
  return {
    format: "screenrec-project",
    version: 1,
    project: snapshot.project,
    undo: snapshot.undo,
    revisions: snapshot.revisions.map((revision) => `revisions/${revision.ordinal}.json`),
    assets,
    inventory,
  };
}
/** Native extraction checks archive bytes; this owner checks complete editable meaning. */
export function validateProjectPackage(
  body: string,
  revisions: ReadonlyMap<string, string>,
  limits: ArchiveLimits,
): ValidatedProjectPackage {
  if (Buffer.byteLength(body) > limits.manifestBytes) invalid("Project manifest exceeds its limit");
  let value: unknown;
  try {
    value = JSON.parse(body);
  } catch {
    invalid("Invalid project manifest JSON");
  }
  const parsed = manifestSchema.safeParse(value);
  if (!parsed.success) invalid("Invalid project manifest");
  const manifest = parsed.data;
  if (manifest.inventory.length > limits.entries - 1 || manifest.revisions.length > limits.history)
    invalid("Project inventory exceeds its limit");
  const inventory = new Map<string, z.infer<typeof member>>(),
    folded = new Set<string>();
  let bytes = 0;
  for (const entry of manifest.inventory) {
    const parts = entry.path.split("/");
    if (
      !/^[A-Za-z0-9_./-]+$/.test(entry.path) ||
      parts.some(
        (part) => !part || part === "." || part === ".." || part.length > limits.componentBytes,
      ) ||
      parts.length > limits.depth ||
      entry.path.length > limits.pathBytes ||
      folded.has(entry.path.toLowerCase()) ||
      entry.bytes > limits.memberBytes ||
      entry.path === "manifest.json"
    )
      invalid("Invalid project inventory member");
    folded.add(entry.path.toLowerCase());
    inventory.set(entry.path, entry);
    bytes += entry.bytes;
    if (!Number.isSafeInteger(bytes) || bytes > limits.expandedBytes)
      invalid("Project inventory exceeds byte limit");
  }
  const consumed = new Set<string>();
  const documents = manifest.revisions.map((path, index) => {
    if (path !== `revisions/${index}.json`) invalid("Project revision inventory is incomplete");
    const text = revisions.get(path),
      entry = inventory.get(path);
    if (
      !text ||
      !entry ||
      Buffer.byteLength(text) > limits.revisionBytes ||
      entry.bytes !== Buffer.byteLength(text) ||
      entry.sha256 !== createHash("sha256").update(text).digest("hex")
    )
      invalid("Project revision hash or size differs");
    consumed.add(path);
    try {
      return JSON.parse(text);
    } catch {
      invalid("Invalid project revision JSON");
    }
  });
  if (revisions.size !== documents.length) invalid("Unexpected project revision member");
  const snapshot = validateProjectSnapshot({
    project: manifest.project,
    revisions: documents,
    undo: manifest.undo,
  });
  const assets = new Map<string, PortableAsset>();
  for (const portable of manifest.assets) {
    const asset = portable.asset;
    if (assets.has(asset.id) || !asset.fileName.startsWith(asset.id))
      invalid("Duplicate or ambiguous project asset");
    const path = `assets/${asset.fileName}`,
      entry = inventory.get(path);
    if (!entry || entry.sha256 !== asset.id || entry.bytes !== asset.bytes)
      invalid("Project asset byte identity differs");
    consumed.add(path);
    assets.set(asset.id, portable);
  }
  const closure = collectPortableAssets(
    projectAssetRoots(snapshot),
    (id) => assets.get(id) ?? invalid("Missing transitive project asset"),
    limits.entries,
  );
  if (closure.length !== assets.size || consumed.size !== inventory.size)
    invalid("Unreferenced project inventory member");
  for (const revision of snapshot.revisions)
    validateComposition(
      revision.document,
      closure.map((entry) => compositionAsset(entry.asset)),
    );
  return { ...manifest, snapshot };
}

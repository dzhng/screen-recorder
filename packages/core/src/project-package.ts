import { textSeedResources } from "./text-seeds.js";
import { portablePreparedAudioSchema, preparedAudioResource } from "./prepared-audio.js";
import { portableProjectIndexMetadataSchema } from "./project-index.js";
import { portableSourceIndexMetadataSchema } from "./source-index.js";
import { indexGenerationResource } from "./screenshot-index.js";
import { createHash } from "node:crypto";
import { z } from "zod";
import {
  documentAcquisitionIds,
  selectionRangeSchema,
  documentAssetIds,
  validateComposition,
} from "@screenrec/composition";
import { CatalogError } from "./catalog.js";
import { hdrConversionEvidenceMatchesMetadata } from "./asset-origins.js";
import { compositionAsset, portableAssetSchema } from "./assets.js";
import { sourcePublicationFiles } from "./source-admission.js";
import {
  projectSnapshotReferencesSchema,
  validateProjectSnapshot,
  type ProjectSnapshot,
} from "./projects.js";
import { portableSceneMetadataSchema, sceneGenerationResource } from "./scene-evidence.js";
import { portableScenePublicationSchema } from "./scene-processing.js";
import { portableTranscriptSchema, transcriptGenerationResource } from "./transcript.js";
import { retainedPublicationSchema } from "./jobs.js";
import { acquisitionContext, portableAcquisitionSchema } from "./acquisitions.js";
import { resourceKinds, type ResourceReference } from "./references.js";
import { checkProjectJsonBytes, type ArchiveLimits } from "./package-archive.js";

const digest = z.string().regex(/^[a-f0-9]{64}$/);
const member = z.strictObject({
  path: z.string(),
  bytes: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  sha256: digest,
});
const indexMembersSchema = z.strictObject({
  publication: retainedPublicationSchema.nullable(),
  records: z
    .array(z.strictObject({ bytes: z.int().nonnegative().max(262144), sha256: digest }))
    .max(25000),
  images: z
    .array(
      z.strictObject({
        bytes: z
          .int()
          .positive()
          .max(32 * 1024 * 1024),
        sha256: digest,
      }),
    )
    .max(25000),
});
const resourceSchema = z.discriminatedUnion("kind", [
  portableAssetSchema.extend({ kind: z.literal("asset") }),
  portablePreparedAudioSchema.extend({ kind: z.literal("prepared-audio") }),
  z.strictObject({ kind: z.literal("acquisition"), acquisition: portableAcquisitionSchema }),
  z.strictObject({
    kind: z.literal("scene-generation"),
    metadata: portableSceneMetadataSchema,
    publication: portableScenePublicationSchema.nullable(),
    chunks: z
      .array(
        z.strictObject({
          bytes: z
            .int()
            .nonnegative()
            .max(8 * 1024 * 1024),
          sha256: digest,
        }),
      )
      .min(1)
      .max(25000),
  }),
  indexMembersSchema.extend({
    kind: z.literal("index-generation"),
    metadata: portableSourceIndexMetadataSchema,
  }),
  indexMembersSchema.extend({
    kind: z.literal("project-index-generation"),
    metadata: portableProjectIndexMetadataSchema,
  }),
  z.strictObject({
    kind: z.literal("transcript-generation"),
    metadata: portableTranscriptSchema,
    available: z.array(selectionRangeSchema).max(100000),
    publication: retainedPublicationSchema.nullable(),
    receipt: z.strictObject({
      bytes: z
        .int()
        .nonnegative()
        .max(8 * 1024 * 1024),
      sha256: digest,
    }),
  }),
]);
const serializedResourceSchema = z.strictObject({
  identity: z.strictObject({ kind: z.enum(resourceKinds), id: z.string().min(1).max(2048) }),
  metadata: member,
});
export function resourceMetadataPath(identity: ResourceReference): string {
  return `resources/${createHash("sha256").update(key(identity)).digest("hex")}.json`;
}
export function resourceMetadataMember(resource: PortableResource) {
  const body = JSON.stringify(resource),
    identity = resourceIdentity(resource);
  return {
    body,
    reference: {
      identity,
      metadata: {
        path: resourceMetadataPath(identity),
        bytes: Buffer.byteLength(body),
        sha256: createHash("sha256").update(body).digest("hex"),
      },
    },
  };
}
export type PortableResource = z.infer<typeof resourceSchema>;
export type PortableDependency =
  | Exclude<
      PortableResource,
      {
        kind:
          | "scene-generation"
          | "transcript-generation"
          | "index-generation"
          | "project-index-generation";
      }
    >
  | Omit<Extract<PortableResource, { kind: "scene-generation" }>, "chunks">
  | Omit<Extract<PortableResource, { kind: "transcript-generation" }>, "receipt">
  | Omit<Extract<PortableResource, { kind: "index-generation" }>, "records" | "images">
  | Omit<Extract<PortableResource, { kind: "project-index-generation" }>, "records" | "images">;
export function resourceIdentity(resource: PortableDependency): ResourceReference {
  switch (resource.kind) {
    case "prepared-audio":
      return {
        kind: "prepared-audio",
        id: preparedAudioResource(resource.projectId, resource.publication.attemptId),
      };
    case "project-index-generation":
      return {
        kind: "index-generation",
        id: indexGenerationResource(
          { kind: "project", projectId: resource.metadata.projectId },
          resource.metadata.generation,
        ),
      };
    case "index-generation":
      return {
        kind: "index-generation",
        id: indexGenerationResource(
          { kind: "asset", assetId: resource.metadata.assetId },
          resource.metadata.generation,
        ),
      };
    case "asset":
      return { kind: "asset", id: resource.asset.id };
    case "acquisition":
      return { kind: "acquisition", id: resource.acquisition.id };
    case "scene-generation":
      return { kind: "scene-generation", id: sceneGenerationResource(resource.metadata) };
    case "transcript-generation":
      return { kind: "transcript-generation", id: transcriptGenerationResource(resource.metadata) };
  }
}
const key = (identity: ResourceReference) => `${identity.kind}:${identity.id}`;
export function resourceDependencies(resource: PortableDependency): ResourceReference[] {
  switch (resource.kind) {
    case "prepared-audio":
      return [{ kind: "asset", id: resource.audio.assetId }, ...resource.audio.dependencies];
    case "project-index-generation":
      return resource.metadata.scenes.map((scene) => ({
        kind: "scene-generation",
        id: sceneGenerationResource(scene),
      }));
    case "index-generation":
      return [
        { kind: "asset", id: resource.metadata.assetId },
        { kind: "scene-generation", id: sceneGenerationResource(resource.metadata.scenes) },
        ...(resource.metadata.acquisitionId
          ? [{ kind: "acquisition" as const, id: resource.metadata.acquisitionId }]
          : []),
      ];
    case "asset":
      return resource.dependencies;
    case "acquisition":
      return resource.acquisition.bindings.map((binding) => ({
        kind: "asset",
        id: binding.assetId,
      }));
    case "scene-generation":
    case "transcript-generation":
      return [
        { kind: "asset", id: resource.metadata.owner.assetId },
        ...(resource.metadata.source.acquisitionId
          ? [{ kind: "acquisition" as const, id: resource.metadata.source.acquisitionId }]
          : []),
      ];
  }
}
export function resourceMembers(
  resource: PortableResource,
): { path: string; bytes: number; sha256: string | null }[] {
  if (resource.kind === "prepared-audio") return [];
  if (resource.kind === "index-generation" || resource.kind === "project-index-generation")
    return [
      ...resource.records.map((value, index) => ({
        path: indexMemberPath(resource, "records", index),
        ...value,
      })),
      ...resource.images.map((value, index) => ({
        path: indexMemberPath(resource, "images", index),
        ...value,
      })),
    ];
  if (resource.kind === "asset")
    return [
      {
        path: `assets/${resource.asset.fileName}`,
        bytes: resource.asset.bytes,
        sha256: resource.asset.id,
      },
    ];
  if (resource.kind === "scene-generation")
    return resource.chunks.map((chunk, index) => ({
      path: sceneMemberPath(resource, index),
      ...chunk,
    }));
  if (resource.kind === "transcript-generation")
    return [
      { path: transcriptMemberPath(resource, "raw.jsonl"), ...resource.metadata.raw },
      { path: transcriptMemberPath(resource, "receipt.json"), ...resource.receipt },
    ];
  const acquisition = resource.acquisition;
  return [
    {
      path: `acquisitions/${acquisition.id}/journal.jsonl`,
      bytes: acquisition.journal.bytes,
      sha256: acquisition.journal.sha256,
    },
    {
      path: `acquisitions/${acquisition.id}/normalized.jsonl`,
      bytes: acquisition.receipt.bytes,
      sha256: null,
    },
    ...sourcePublicationFiles(acquisition.receipt).map(({ name, identity }) => ({
      path: `acquisitions/${acquisition.id}/${name}`,
      bytes: Number(identity.bytes),
      sha256: identity.sha256,
    })),
  ];
}
export function sceneMemberPath(
  resource: Extract<PortableDependency, { kind: "scene-generation" }>,
  ordinal: number,
): string {
  const id = createHash("sha256")
    .update(key(resourceIdentity(resource)))
    .digest("hex");
  return `scenes/${id}/${ordinal}.json`;
}
export function indexMemberPath(
  resource: Extract<PortableDependency, { kind: "index-generation" | "project-index-generation" }>,
  kind: "records" | "images",
  ordinal: number,
): string {
  const id = createHash("sha256")
    .update(key(resourceIdentity(resource)))
    .digest("hex");
  return `indexes/${id}/${kind}/${ordinal}.${kind === "images" ? "png" : "json"}`;
}
export function transcriptMemberPath(
  resource: Extract<PortableDependency, { kind: "transcript-generation" }>,
  leaf: "raw.jsonl" | "receipt.json",
): string {
  const id = createHash("sha256")
    .update(key(resourceIdentity(resource)))
    .digest("hex");
  return `transcripts/${id}/${leaf}`;
}
const manifestSchema = z.strictObject({
  format: z.literal("screenrec-project"),
  version: z.literal(3),
  project: z.unknown(),
  undo: z.array(z.string()).max(1000),
  references: projectSnapshotReferencesSchema,
  revisions: z.array(z.string()).min(1).max(1000),
  resources: z.array(serializedResourceSchema).max(25_000),
  inventory: z.array(member).max(25_000),
});
export type ProjectPackageManifest = z.infer<typeof manifestSchema>;
export type ValidatedProjectPackage = Omit<ProjectPackageManifest, "resources"> & {
  resources: PortableResource[];
  snapshot: ProjectSnapshot;
};
function invalid(message: string): never {
  throw new CatalogError("INVALID_PACKAGE", message);
}

/** The same graph walk selects an export closure and checks an imported closure; cycles terminate by identity. */
export function collectPortableResources<T extends PortableDependency>(
  roots: readonly ResourceReference[],
  read: (identity: ResourceReference) => T,
  limit = 25_000,
): T[] {
  const found = new Map<string, T>(),
    queued = new Set<string>(),
    pending: ResourceReference[] = [];
  const enqueue = (identity: ResourceReference) => {
    if (queued.has(key(identity))) return;
    if (queued.size >= limit)
      throw new CatalogError("LIMIT_EXCEEDED", "Portable dependency inventory exceeds its limit");
    queued.add(key(identity));
    pending.push(identity);
  };
  roots.forEach(enqueue);
  for (let position = 0; position < pending.length; position++) {
    const identity = pending[position]!,
      value = read(identity);
    if (key(resourceIdentity(value)) !== key(identity))
      invalid("Dependency identity differs from inventory key");
    found.set(key(identity), value);
    resourceDependencies(value).forEach(enqueue);
  }
  return [...found.values()].sort((a, b) =>
    key(resourceIdentity(a)).localeCompare(key(resourceIdentity(b))),
  );
}
export function projectResourceRoots(snapshot: ProjectSnapshot): ResourceReference[] {
  return [
    ...snapshot.references.flatMap((value) => value.resources),
    ...snapshot.revisions.flatMap((revision) => textSeedResources(revision.document)),
    ...snapshot.revisions.flatMap((revision) =>
      documentAssetIds(revision.document).map((id) => ({ kind: "asset" as const, id })),
    ),
    ...snapshot.revisions.flatMap((revision) =>
      documentAcquisitionIds(revision.document).map((id) => ({ kind: "acquisition" as const, id })),
    ),
  ];
}
export function projectPackageManifest(
  snapshot: ProjectSnapshot,
  resources: PortableResource[],
  inventory: ProjectPackageManifest["inventory"],
): ProjectPackageManifest {
  return {
    format: "screenrec-project",
    version: 3,
    project: snapshot.project,
    undo: snapshot.undo,
    references: snapshot.references,
    revisions: snapshot.revisions.map((revision) => `revisions/${revision.ordinal}.json`),
    resources: resources.map((resource) => resourceMetadataMember(resource).reference),
    inventory,
  };
}
/** Compact shape/inventory admission precedes any external metadata reads. */
export function parseProjectPackageManifest(
  body: string,
  _revisions: ReadonlyMap<string, string>,
  limits: ArchiveLimits,
): ProjectPackageManifest {
  if (Buffer.byteLength(body) > limits.manifestBytes) invalid("Project manifest exceeds its limit");
  let value: unknown;
  try {
    value = JSON.parse(body);
  } catch {
    invalid("Invalid project manifest JSON");
  }
  if (
    value &&
    typeof value === "object" &&
    "format" in value &&
    value.format === "screenrec-project" &&
    (!("version" in value) || value.version !== 3)
  )
    throw new CatalogError("INVALID_PACKAGE", "Unsupported project package version", {
      supportedVersion: 3,
    });
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
  let aggregate = 0;
  const metadata = new Set<string>();
  for (const resource of manifest.resources) {
    const ref = resource.metadata,
      entry = inventory.get(ref.path);
    if (
      ref.path !== resourceMetadataPath(resource.identity) ||
      metadata.has(ref.path) ||
      !entry ||
      entry.bytes !== ref.bytes ||
      entry.sha256 !== ref.sha256
    )
      invalid("Resource metadata reference differs from inventory");
    metadata.add(ref.path);
    aggregate += ref.bytes;
  }
  for (const [ordinal, path] of manifest.revisions.entries()) {
    const entry = inventory.get(path);
    if (path !== `revisions/${ordinal}.json` || !entry)
      invalid("Project revision inventory is incomplete");
    aggregate += entry.bytes;
  }
  checkProjectJsonBytes(aggregate);
  return manifest;
}

/** Complete editable meaning is checked after admitted member hydration, before readiness. */
export function resolveProjectPackage(
  manifest: ProjectPackageManifest,
  revisions: ReadonlyMap<string, string>,
  limits: ArchiveLimits,
  metadata: ReadonlyMap<string, string>,
): ValidatedProjectPackage {
  const inventory = new Map(manifest.inventory.map((entry) => [entry.path, entry]));
  const consumed = new Set<string>();
  const documents = manifest.revisions.map((path, index) => {
    if (path !== `revisions/${index}.json`) invalid("Project revision inventory is incomplete");
    const text = revisions.get(path),
      entry = inventory.get(path);
    if (
      !text ||
      !entry ||
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
    references: manifest.references,
  });
  const resources = new Map<string, PortableResource>();
  const resolved: PortableResource[] = [];
  let metadataCount = 0;
  for (const serialized of manifest.resources) {
    const ref = serialized.metadata,
      body = metadata.get(ref.path);
    if (
      body === undefined ||
      Buffer.byteLength(body) !== ref.bytes ||
      createHash("sha256").update(body).digest("hex") !== ref.sha256
    )
      invalid("Resource metadata member hash or size differs");
    let value: unknown;
    try {
      value = JSON.parse(body);
    } catch {
      invalid("Invalid resource metadata JSON");
    }
    const parsed = resourceSchema.safeParse(value);
    if (!parsed.success || key(resourceIdentity(parsed.data)) !== key(serialized.identity))
      invalid("Invalid portable resource metadata identity or schema");
    const resource = parsed.data;
    consumed.add(ref.path);
    metadataCount++;
    resolved.push(resource);
    if (
      (resource.kind === "index-generation" || resource.kind === "project-index-generation") &&
      (resource.images.length !== resource.metadata.candidateCount ||
        resource.records.length !==
          resource.metadata.candidateCount + resource.metadata.coverageCount)
    )
      invalid("Screenshot index members differ from its counts");
    if (
      resource.kind === "project-index-generation" &&
      (resource.metadata.projectId !== snapshot.project.projectId ||
        !snapshot.revisions.some((revision) => revision.id === resource.metadata.revisionId))
    )
      invalid("Project screenshot index belongs to another history");
    if (
      resource.kind === "prepared-audio" &&
      (resource.projectId !== snapshot.project.projectId ||
        !snapshot.revisions.some((revision) => revision.id === resource.revisionId))
    )
      invalid("Prepared audio belongs to another project history");
    const identity = key(resourceIdentity(resource));
    if (resources.has(identity)) invalid("Duplicate project dependency");
    if (resource.kind === "asset" && !resource.asset.fileName.startsWith(resource.asset.id))
      invalid("Ambiguous project asset filename");
    for (const member of resourceMembers(resource)) {
      const entry = inventory.get(member.path);
      if (
        !entry ||
        entry.bytes !== member.bytes ||
        (member.sha256 !== null && entry.sha256 !== member.sha256)
      )
        invalid("Project dependency byte identity differs");
      consumed.add(member.path);
    }
    resources.set(identity, resource);
  }
  if (metadata.size !== metadataCount) invalid("Unexpected resource metadata member");
  const closure = collectPortableResources(
    projectResourceRoots(snapshot),
    (identity) => resources.get(key(identity)) ?? invalid("Missing transitive project dependency"),
    limits.entries,
  );
  if (closure.length !== resources.size || consumed.size !== inventory.size)
    invalid("Unreferenced project inventory member");
  for (const resource of closure) {
    if (resource.kind !== "asset") continue;
    for (const origin of resource.origins) {
      if (origin.kind !== "hdr-conversion") continue;
      const original = resources.get(key({ kind: "asset", id: origin.source.assetId }));
      if (
        original?.kind !== "asset" ||
        !hdrConversionEvidenceMatchesMetadata(origin.source, original.asset)
      )
        invalid("HDR conversion receipt differs from its retained original source");
    }
  }
  const assets = closure.flatMap((resource) =>
    resource.kind === "asset" ? [compositionAsset(resource.asset)] : [],
  );
  const acquisitions = closure.flatMap((resource) =>
    resource.kind === "acquisition" ? [acquisitionContext(resource.acquisition)] : [],
  );
  for (const revision of snapshot.revisions)
    validateComposition(revision.document, assets, acquisitions);
  return { ...manifest, resources: resolved, snapshot };
}

export function validateProjectPackage(
  body: string,
  revisions: ReadonlyMap<string, string>,
  limits: ArchiveLimits,
  metadata: ReadonlyMap<string, string> = new Map(),
): ValidatedProjectPackage {
  return resolveProjectPackage(
    parseProjectPackageManifest(body, revisions, limits),
    revisions,
    limits,
    metadata,
  );
}

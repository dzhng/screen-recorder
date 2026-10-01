import {
  signedTimeValueSchema,
  fromTime,
  toTime,
  toSignedTime,
  subtract,
  compare,
  type SignedTimeValue,
} from "@screenrec/composition";
import {
  verifySourceEvidence,
  sourcePublicationFiles,
  sourcePublicationMembers as publicationMembers,
} from "./source-admission.js";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { isDeepStrictEqual } from "node:util";
import { constants, openSync, fstatSync, closeSync } from "node:fs";
import { chmod, lstat, mkdir, open, opendir, realpath, rm } from "node:fs/promises";
import { dirname, isAbsolute, join } from "node:path";
import { acquisitionContextSchema, type AcquisitionContext } from "@screenrec/composition";
import {
  AssetStore,
  compositionAsset,
  mediaProbeSchema,
  type Asset,
  type AssetProbe,
} from "./assets.js";
import type { CaptureStore } from "./capture-store.js";
import { Catalog, CatalogError } from "./catalog.js";
import {
  copyImportedFile,
  fileIdentity,
  hashFile,
  type IdentifiedFile,
  openDirectoryLease,
} from "./files.js";
import {
  validateSourceReceipt,
  type CameraPublicationProof,
  type SourceEvidenceMetadata,
  type SourceEvidenceStore,
} from "./evidence.js";
import type { SourceExporter } from "./processing.js";
import { ResourceReferences, type ResourceOwner } from "./references.js";

const members = [
  "capture.journal.jsonl",
  "video.mov",
  "narration.mov",
  "system.mov",
  ...publicationMembers,
] as const;
export type AcquisitionMember = "journal" | "normalized" | (typeof publicationMembers)[number];
type Member = (typeof members)[number];
type SourceFiles = Record<Member, IdentifiedFile | null>;
export type PreparedAcquisition = { requestId: string; path: string; files: SourceFiles };
const captureRequestPrefix = "capture:";
export type AcquisitionImportIntent = PreparedAcquisition & {
  kind: "import";
  acquisitionId: string;
};
export type CaptureAcquisitionIntent = {
  kind: "capture";
  acquisitionId: string;
  requestId: string;
  recordingId: string;
  sourceId: string;
  path: string;
  files: Partial<SourceFiles>;
};
export type AcquisitionIntent =
  | CaptureAcquisitionIntent
  | AcquisitionImportIntent
  | { kind: "package"; acquisitionId: string; requestId: string; packageIdentity: string };
type AcquisitionAdmission =
  | Omit<CaptureAcquisitionIntent, "acquisitionId" | "requestId">
  | Omit<AcquisitionImportIntent, "acquisitionId" | "requestId">
  | { kind: "package"; packageIdentity: string };

export type Acquisition = {
  id: string;
  sourceId: string;
  evidence: SourceEvidenceMetadata;
  journal: { fileName: string; bytes: number; sha256: string };
  bindings: (AcquisitionContext["bindings"][number] & {
    sourceRoles: ("video" | "narration" | "system")[];
    sourceToAssetOffsetUs: SignedTimeValue;
    supportBasis: "physical" | "captured-audio";
  })[];
};
const memberBytes = z.number().int().nonnegative().max(268_435_456);
export const portableAcquisitionSchema = z
  .strictObject({
    id: z
      .uuid()
      .refine((value) => value === value.toLowerCase(), "Acquisition ID must be canonical"),
    sourceId: z.string().min(1).max(256),
    generation: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),
    receipt: z.record(z.string(), z.unknown()),
    journal: z.strictObject({ bytes: memberBytes, sha256: z.string().regex(/^[a-f0-9]{64}$/) }),
    bindings: z
      .array(
        acquisitionContextSchema.shape.bindings.element
          .extend({
            sourceRoles: z
              .array(z.enum(["video", "narration", "system"]))
              .min(1)
              .max(3),
            sourceToAssetOffsetUs: signedTimeValueSchema,
            supportBasis: z.enum(["physical", "captured-audio"]),
          })
          .strict(),
      )
      .min(1)
      .max(256),
  })
  .transform((value) => {
    if ("file" in value.receipt)
      throw new CatalogError(
        "INVALID_PACKAGE",
        "Portable acquisition receipt must not contain a local path",
      );
    const { file: _file, ...receipt } = validateSourceReceipt(
      { ...value.receipt, file: "source.jsonl" },
      value.sourceId,
    );
    return { ...value, receipt };
  });
export type PortableAcquisition = z.infer<typeof portableAcquisitionSchema>;
export type PortableAcquisitionFiles = Record<
  "journal" | "normalized",
  IdentifiedFile & { sha256: string }
> &
  Partial<Record<(typeof publicationMembers)[number], IdentifiedFile & { sha256: string }>>;
function portableAcquisition(value: Acquisition): PortableAcquisition {
  if (
    value.evidence.owner.kind !== "acquisition" ||
    value.evidence.owner.acquisitionId !== value.id ||
    value.evidence.sourceId !== value.sourceId
  )
    throw new CatalogError(
      "INVALID_STORAGE",
      "Acquisition evidence identity conflicts with its owner",
    );
  const { file: _file, ...receipt } = value.evidence.receipt;
  return portableAcquisitionSchema.parse({
    id: value.id,
    sourceId: value.sourceId,
    generation: value.evidence.generation,
    receipt,
    journal: { bytes: value.journal.bytes, sha256: value.journal.sha256 },
    bindings: value.bindings,
  });
}
const missing = (error: unknown) => (error as NodeJS.ErrnoException).code === "ENOENT";

async function sourceRoot(path: string): Promise<string> {
  const root = await realpath(path).catch((error) => {
    throw new CatalogError(
      missing(error) ? "NOT_FOUND" : "INVALID_PATH",
      "Cannot open capture source directory",
      { filesystemCode: (error as NodeJS.ErrnoException).code },
    );
  });
  const stat = await lstat(root).catch((error) => {
    throw new CatalogError(
      missing(error) ? "NOT_FOUND" : "INVALID_PATH",
      "Cannot inspect capture source directory",
      { filesystemCode: (error as NodeJS.ErrnoException).code },
    );
  });
  if (!stat.isDirectory())
    throw new CatalogError("INVALID_PATH", "Capture source must be a directory");
  return root;
}
async function observeMember(root: string, member: Member): Promise<IdentifiedFile | null> {
  const path = join(root, member);
  const file = await open(
    path,
    constants.O_RDONLY | constants.O_NONBLOCK | constants.O_NOFOLLOW,
  ).catch((error) => {
    if (missing(error) && member !== "video.mov" && member !== "capture.journal.jsonl") return null;
    throw new CatalogError(
      missing(error) ? "NOT_FOUND" : "INVALID_PATH",
      `Cannot admit capture member: ${member}`,
      { filesystemCode: (error as NodeJS.ErrnoException).code },
    );
  });
  if (!file) return null;
  try {
    const stat = await file.stat({ bigint: true }).catch((error) => {
      throw new CatalogError("INVALID_PATH", `Cannot inspect capture member: ${member}`, {
        filesystemCode: (error as NodeJS.ErrnoException).code,
      });
    });
    if (!stat.isFile() || stat.size > BigInt(Number.MAX_SAFE_INTEGER))
      throw new CatalogError("INVALID_PATH", `Capture member must be a regular file: ${member}`);
    return { path, bytes: Number(stat.size), identity: fileIdentity(stat) };
  } finally {
    await file.close();
  }
}

/** Access failures do not establish that a durable observation changed. */
function deferredReadFailure(error: unknown, frozen: boolean): never {
  if (!(error instanceof CatalogError)) throw error;
  const filesystemCode = error.details.filesystemCode;
  if (
    typeof filesystemCode === "string" &&
    !["ENOENT", "ENOTDIR", "ELOOP"].includes(filesystemCode)
  )
    throw new CatalogError(error.code, error.message, error.details, true);
  if (frozen) throw new CatalogError("SOURCE_CHANGED", error.message, error.details);
  if (error.code === "NOT_FOUND")
    throw new CatalogError(error.code, error.message, error.details, true);
  throw error;
}

export function acquisitionContext(
  value: Pick<Acquisition, "id" | "bindings">,
): AcquisitionContext {
  return {
    id: value.id,
    bindings: value.bindings.map(({ assetId, streamId, available }) => ({
      assetId,
      streamId,
      available,
    })),
  };
}

/** An explicit capture adoption owns its media and journal independently of the donor library. */
export class AcquisitionStore {
  private readonly dependencies: ResourceReferences;
  constructor(private readonly catalog: Catalog) {
    this.dependencies = new ResourceReferences(catalog);
    catalog.catalog.exec(`CREATE TABLE IF NOT EXISTS acquisitions (
      id TEXT PRIMARY KEY, requestId TEXT UNIQUE NOT NULL, admission TEXT NOT NULL, metadata TEXT
    ) STRICT`);
  }

  replay(requestId: string, path: string): AcquisitionImportIntent | null {
    const row = this.catalog.catalog
      .prepare("SELECT id,admission FROM acquisitions WHERE requestId=?")
      .get(requestId);
    if (!row) return null;
    const admission = JSON.parse(row.admission as string) as AcquisitionAdmission;
    if (admission.kind !== "import" || admission.path !== path)
      throw new CatalogError(
        "REQUEST_CONFLICT",
        "Acquisition request ID already names another input",
      );
    return { ...admission, requestId, acquisitionId: row.id as string };
  }
  /** Called inside the shared queue admission transaction. */
  admitImport(prepared: PreparedAcquisition): AcquisitionImportIntent {
    const replay = this.replay(prepared.requestId, prepared.path);
    if (replay) return replay;
    const acquisitionId = randomUUID();
    const admission: AcquisitionAdmission = {
      kind: "import",
      path: prepared.path,
      files: prepared.files,
    };
    this.catalog.catalog
      .prepare("INSERT INTO acquisitions VALUES(?,?,?,NULL)")
      .run(acquisitionId, prepared.requestId, JSON.stringify(admission));
    return { ...prepared, kind: "import", acquisitionId };
  }
  /** Called inside the shared queue admission transaction, before source files are opened. */
  admitCapture(
    captures: CaptureStore,
    recordingId: string,
    path: string,
  ): CaptureAcquisitionIntent {
    if (captures.catalog !== this.catalog.catalog)
      throw new CatalogError(
        "INVALID_STATE",
        "Capture admission requires the shared catalog connection",
      );
    if (!isAbsolute(path))
      throw new CatalogError("INVALID_PARAMS", "Capture source requires an absolute directory");
    const recording = captures.settledSource(recordingId);
    const requestId = `${captureRequestPrefix}${recording.sourceId}`;
    const row = this.catalog.catalog
      .prepare("SELECT id FROM acquisitions WHERE requestId=?")
      .get(requestId);
    if (row) {
      const intent = this.intent(row.id as string);
      if (
        intent.kind !== "capture" ||
        intent.recordingId !== recordingId ||
        intent.sourceId !== recording.sourceId ||
        intent.path !== path
      )
        throw new CatalogError("REQUEST_CONFLICT", "Capture source already names another input");
      return intent;
    }
    const acquisitionId = randomUUID();
    const admission: AcquisitionAdmission = {
      kind: "capture",
      recordingId,
      sourceId: recording.sourceId,
      path,
      files: {},
    };
    this.catalog.catalog
      .prepare("INSERT INTO acquisitions VALUES(?,?,?,NULL)")
      .run(acquisitionId, requestId, JSON.stringify(admission));
    return { ...admission, acquisitionId, requestId };
  }
  /** Read-only discovery uses the same source identity as capture admission. */
  captureIntent(sourceId: string): CaptureAcquisitionIntent | null {
    const row = this.catalog.catalog
      .prepare("SELECT id FROM acquisitions WHERE requestId=?")
      .get(`${captureRequestPrefix}${sourceId}`);
    if (!row) return null;
    const intent = this.intent(row.id as string);
    if (intent.kind !== "capture" || intent.sourceId !== sourceId)
      throw new CatalogError("REQUEST_CONFLICT", "Capture source request names another input");
    return intent;
  }
  /** A missed notification leaves its eligible primary source in this durable backlog. */
  pendingPrimaryCaptures(captures: CaptureStore): string[] {
    if (captures.catalog !== this.catalog.catalog)
      throw new CatalogError(
        "INVALID_STATE",
        "Capture admission requires the shared catalog connection",
      );
    // This bounded selection only finds candidates. Admission asks CaptureStore.settledSource
    // inside its transaction, including the deletion fence, before reserving an acquisition.
    return this.catalog.catalog
      .prepare(`SELECT r.recordingId FROM recordings r
      LEFT JOIN acquisitions a ON a.requestId=? || r.sourceId
      WHERE r.state IN ('complete','interrupted') AND r.sourceDurationUs IS NOT NULL AND a.id IS NULL
      AND r.recordingId NOT IN (SELECT recordingId FROM recording_deletions)
      ORDER BY r.creationSequence LIMIT 100`)
      .all(captureRequestPrefix)
      .map((row) => row.recordingId as string);
  }
  freezeCaptureMember(acquisitionId: string, member: Member, file: IdentifiedFile | null): void {
    this.catalog.transaction(() => {
      const intent = this.intent(acquisitionId);
      if (intent.kind !== "capture")
        throw new CatalogError("INVALID_STATE", "Deferred observation requires a capture intent");
      if (Object.hasOwn(intent.files, member) && !isDeepStrictEqual(intent.files[member], file))
        throw new CatalogError("SOURCE_CHANGED", "Capture member differs from its frozen identity");
      const admission: AcquisitionAdmission = {
        kind: intent.kind,
        recordingId: intent.recordingId,
        sourceId: intent.sourceId,
        path: intent.path,
        files: intent.files,
      };
      admission.files[member] = file;
      this.catalog.catalog
        .prepare("UPDATE acquisitions SET admission=? WHERE id=?")
        .run(JSON.stringify(admission), acquisitionId);
    });
  }
  intent(acquisitionId: string): AcquisitionIntent {
    const row = this.catalog.catalog
      .prepare("SELECT requestId,admission FROM acquisitions WHERE id=?")
      .get(acquisitionId);
    if (!row) throw new CatalogError("NOT_FOUND", "Acquisition does not exist", { acquisitionId });
    return {
      ...(JSON.parse(row.admission as string) as AcquisitionAdmission),
      acquisitionId,
      requestId: row.requestId as string,
    };
  }
  /** Package reservations have no invented capture-import path or file roles. */
  admitPortable(acquisitionId: string, packageIdentity: string) {
    const existing = this.catalog.catalog
      .prepare("SELECT metadata FROM acquisitions WHERE id=?")
      .get(acquisitionId);
    if (existing) {
      if (existing.metadata === null)
        throw new CatalogError(
          "PROCESSING_BUSY",
          "Acquisition is already being prepared",
          {},
          true,
        );
      return { existing: JSON.parse(existing.metadata as string) as Acquisition, requestId: null };
    }
    const requestId = randomUUID();
    this.catalog.catalog
      .prepare("INSERT INTO acquisitions VALUES(?,?,?,NULL)")
      .run(acquisitionId, requestId, JSON.stringify({ kind: "package", packageIdentity }));
    return { existing: null, requestId };
  }
  publish(value: Acquisition): void {
    this.intent(value.id);
    this.catalog.catalog
      .prepare("UPDATE acquisitions SET metadata=? WHERE id=?")
      .run(JSON.stringify(value), value.id);
  }
  ready(acquisitionId: string): boolean {
    return Boolean(
      this.catalog.catalog
        .prepare("SELECT 1 FROM acquisitions WHERE id=? AND metadata IS NOT NULL")
        .get(acquisitionId),
    );
  }
  discardPortable(acquisitionId: string, requestId: string): void {
    this.catalog.catalog
      .prepare(
        "DELETE FROM acquisitions WHERE id=? AND requestId=? AND metadata IS NULL AND json_extract(admission,'$.kind')='package'",
      )
      .run(acquisitionId, requestId);
  }
  get(acquisitionId: string): Acquisition {
    const row = this.catalog.catalog
      .prepare("SELECT metadata FROM acquisitions WHERE id=?")
      .get(acquisitionId);
    if (!row) throw new CatalogError("NOT_FOUND", "Acquisition does not exist", { acquisitionId });
    if (row.metadata === null)
      throw new CatalogError("NOT_READY", "Acquisition import has not completed", {
        acquisitionId,
      });
    return JSON.parse(row.metadata as string);
  }
  context(acquisitionId: string): AcquisitionContext {
    return acquisitionContext(this.get(acquisitionId));
  }
  retain(owner: ResourceOwner, ids: readonly string[]): void {
    for (const id of ids) this.get(id);
    this.dependencies.retain("acquisition", owner, ids);
  }
  release(owner: ResourceOwner): void {
    this.dependencies.release("acquisition", owner);
  }
  references(id: string): ResourceOwner[] {
    this.get(id);
    return this.dependencies.owners("acquisition", id);
  }
}

/** Executes admitted capture copies and indexing on the shared preparation queue. */
export class AcquisitionImporter {
  private readonly directory: string;
  constructor(
    private readonly catalog: Catalog,
    private readonly store: AcquisitionStore,
    private readonly assets: AssetStore,
    private readonly evidence: SourceEvidenceStore,
    library: string,
  ) {
    this.directory = join(library, "acquisitions");
  }
  async prepareImport(requestId: string, path: string): Promise<PreparedAcquisition> {
    if (!requestId || !isAbsolute(path))
      throw new CatalogError(
        "INVALID_PARAMS",
        "Acquisition import requires a request ID and absolute directory",
      );
    const replay = this.store.replay(requestId, path);
    if (replay) return replay;
    const root = await sourceRoot(path);
    const files = {} as SourceFiles;
    for (const member of members) files[member] = await observeMember(root, member);
    return { requestId, path, files };
  }
  private async freezeCapture(
    intent: CaptureAcquisitionIntent,
    signal: AbortSignal,
  ): Promise<SourceFiles> {
    const root = await sourceRoot(intent.path).catch((error) =>
      deferredReadFailure(error, Object.keys(intent.files).length > 0),
    );
    // Validate the whole durable prefix before allowing any new observation.
    for (const member of members) {
      signal.throwIfAborted();
      if (!Object.hasOwn(intent.files, member)) continue;
      const frozen = intent.files[member];
      const current = await observeMember(root, member).catch((error) =>
        deferredReadFailure(error, true),
      );
      if (!isDeepStrictEqual(frozen, current))
        throw new CatalogError("SOURCE_CHANGED", `Frozen capture member changed: ${member}`);
    }
    for (const member of members) {
      signal.throwIfAborted();
      if (Object.hasOwn(intent.files, member)) continue;
      const file = await observeMember(root, member).catch((error) =>
        deferredReadFailure(error, false),
      );
      signal.throwIfAborted();
      this.store.freezeCaptureMember(intent.acquisitionId, member, file);
      intent.files[member] = file;
    }
    return intent.files as SourceFiles;
  }
  journalPath(id: string): string {
    return join(this.directory, id, this.store.get(id).journal.fileName);
  }

  portable(id: string): {
    acquisition: PortableAcquisition;
    files: Record<"journal" | "normalized", IdentifiedFile> &
      Partial<Record<(typeof publicationMembers)[number], IdentifiedFile>>;
  } {
    const value = this.store.get(id),
      acquisition = portableAcquisition(value);
    const paths = { journal: this.journalPath(id), normalized: value.evidence.receipt.file };
    const identify = (path: string, bytes: number): IdentifiedFile => {
      const fd = openSync(path, constants.O_RDONLY | constants.O_NONBLOCK | constants.O_NOFOLLOW);
      try {
        const stat = fstatSync(fd, { bigint: true });
        if (!stat.isFile() || stat.size !== BigInt(bytes))
          throw new CatalogError("INVALID_STORAGE", "Acquisition member differs from its receipt");
        return { path, bytes, identity: fileIdentity(stat) };
      } finally {
        closeSync(fd);
      }
    };
    return {
      acquisition,
      files: {
        journal: identify(paths.journal, value.journal.bytes),
        normalized: identify(paths.normalized, value.evidence.receipt.bytes),
        ...Object.fromEntries(
          sourcePublicationFiles(value.evidence.receipt).map(({ name, identity }) => [
            name,
            identify(join(dirname(paths.journal), name), Number(identity.bytes)),
          ]),
        ),
      },
    };
  }
  /** Transient package readiness and durable adoption share the same canonical admission proof. */
  async verifyPortable(
    value: unknown,
    files: PortableAcquisitionFiles,
    signal: AbortSignal,
    native: {
      exportSource: SourceExporter;
      assetFiles: ReadonlyMap<string, IdentifiedFile>;
      assets: ReadonlyMap<string, Asset>;
    },
  ) {
    const lifetime = await this.lease(false);
    try {
      const acquisition = portableAcquisitionSchema.parse(value);
      const canonical: NonNullable<Parameters<SourceExporter>[3]> = {};
      const roles = new Set<string>();
      for (const binding of acquisition.bindings) {
        for (const role of binding.sourceRoles) {
          if (roles.has(role))
            throw new CatalogError("INVALID_PACKAGE", "Acquisition repeats a source role");
          roles.add(role);
          if (role === "video" && !acquisition.receipt.publications?.video) continue;
          const file = native.assetFiles.get(binding.assetId);
          if (!file) throw new CatalogError("INVALID_PACKAGE", "Missing canonical source input");
          const proof = acquisition.receipt.publications?.[role];
          if (
            proof &&
            (binding.assetId !== proof.canonical.sha256 ||
              file.bytes !== Number(proof.canonical.bytes))
          )
            throw new CatalogError(
              "INVALID_PACKAGE",
              "Canonical asset differs from publication proof",
            );
          canonical[role] = {
            ...file,
            ...(proof
              ? { metadata: mediaProbeSchema.parse(native.assets.get(binding.assetId)) }
              : {}),
          };
        }
      }
      const audio = new Map<string, { startUs: number; endUs: number }[]>();
      await verifySourceEvidence({
        directory: this.directory,
        receipt: acquisition.receipt,
        files,
        canonical,
        exportSource: native.exportSource,
        lifetime,
        signal,
        audio: (row) => {
          const interval = JSON.parse(row.content) as {
            role: string;
            startUs: number;
            endUs: number;
          };
          const intervals = audio.get(interval.role) ?? [];
          if (intervals.length === 100_000)
            throw new CatalogError("LIMIT_EXCEEDED", "Capture acquisition interval limit exceeded");
          intervals.push(interval);
          audio.set(interval.role, intervals);
        },
      });
      for (const binding of acquisition.bindings) {
        const asset = native.assets.get(binding.assetId);
        if (!asset) throw new CatalogError("INVALID_PACKAGE", "Missing bound asset metadata");
        for (const role of binding.sourceRoles) {
          const expected = this.binding(
            asset,
            role,
            audio.get(role) ?? [],
            acquisition.receipt.publications?.video,
          );
          if (!isDeepStrictEqual({ ...expected, sourceRoles: binding.sourceRoles }, binding))
            throw new CatalogError(
              "INVALID_PACKAGE",
              "Acquisition binding differs from verified source evidence",
            );
        }
      }
    } finally {
      await lifetime.close();
    }
  }

  async stagePortable(
    value: unknown,
    files: PortableAcquisitionFiles,
    signal: AbortSignal,
    native: {
      exportSource: SourceExporter;
      assetFiles: ReadonlyMap<string, IdentifiedFile>;
      assets: ReadonlyMap<string, Asset>;
    },
  ) {
    const acquisition = portableAcquisitionSchema.parse(value);
    signal.throwIfAborted();
    if (
      files.journal.bytes !== acquisition.journal.bytes ||
      files.journal.sha256 !== acquisition.journal.sha256 ||
      files.normalized.bytes !== acquisition.receipt.bytes
    )
      throw new CatalogError("INVALID_PACKAGE", "Acquisition members conflict with their receipts");
    const packageIdentity = createHash("sha256")
      .update(JSON.stringify([acquisition, files.journal.sha256, files.normalized.sha256]))
      .digest("hex");
    const proofMembers = sourcePublicationFiles(acquisition.receipt).map(({ name, identity }) => {
      const member = files[name];
      if (!member || member.sha256 !== identity.sha256 || member.bytes !== Number(identity.bytes))
        throw new CatalogError(
          "INVALID_PACKAGE",
          "Publication proof differs from package inventory",
        );
      return [name, member] as const;
    });
    if (
      this.store.ready(acquisition.id) &&
      !isDeepStrictEqual(portableAcquisition(this.store.get(acquisition.id)), acquisition)
    )
      throw new CatalogError(
        "INVALID_PACKAGE",
        "Existing acquisition metadata conflicts with package identity",
      );
    await this.verifyPortable(acquisition, files, signal, native);
    const reservation = this.catalog.transaction(() =>
      this.store.admitPortable(acquisition.id, packageIdentity),
    );
    const owner = { kind: "acquisition" as const, acquisitionId: acquisition.id };
    if (reservation.existing) {
      if (!isDeepStrictEqual(portableAcquisition(reservation.existing), acquisition))
        throw new CatalogError(
          "INVALID_PACKAGE",
          "Existing acquisition metadata conflicts with package identity",
        );
      for (const [path, member] of [
        [this.journalPath(acquisition.id), files.journal],
        [reservation.existing.evidence.receipt.file, files.normalized],
        ...proofMembers.map(
          ([name, member]) =>
            [join(dirname(this.journalPath(acquisition.id)), name), member] as const,
        ),
      ] as const) {
        const file = await open(
          path,
          constants.O_RDONLY | constants.O_NONBLOCK | constants.O_NOFOLLOW,
        );
        try {
          if ((await hashFile(file, member.bytes, signal)).sha256 !== member.sha256)
            throw new CatalogError(
              "INVALID_PACKAGE",
              "Existing acquisition content conflicts with package identity",
            );
        } finally {
          await file.close();
        }
      }
      return {
        close: async () => {},
        publish: () => {
          signal.throwIfAborted();
          this.assets.retain(
            { kind: "acquisition", id: acquisition.id },
            acquisition.bindings.map((binding) => binding.assetId),
          );
        },
      };
    }
    const directory = join(this.directory, acquisition.id, acquisition.generation);
    const sourceDirectory = join(directory, "source"),
      normalized = join(directory, "source.jsonl");
    let ownsDirectory = false;
    const close = async () => {
      if (this.store.ready(acquisition.id)) return;
      await this.evidence.purge(owner, new AbortController().signal);
      if (ownsDirectory)
        await rm(join(this.directory, acquisition.id), { recursive: true, force: true });
      this.store.discardPortable(acquisition.id, reservation.requestId!);
    };
    try {
      await mkdir(join(this.directory, acquisition.id), { mode: 0o700 });
      ownsDirectory = true;
      await mkdir(sourceDirectory, { recursive: true, mode: 0o700 });
      for (const [path, member] of [
        [join(sourceDirectory, "capture.journal.jsonl"), files.journal],
        [normalized, files.normalized],
        ...proofMembers.map(([name, member]) => [join(sourceDirectory, name), member] as const),
      ] as const) {
        const copied = await copyImportedFile(member.path, path, signal, member, 268_435_456);
        if (copied.sha256 !== member.sha256 || copied.bytes !== member.bytes)
          throw new CatalogError(
            "INVALID_PACKAGE",
            "Acquisition member hash differs from inventory",
          );
      }
      const evidence = await this.evidence.ingest({
        owner,
        sourceId: acquisition.sourceId,
        generation: acquisition.generation,
        file: normalized,
        receipt: { ...acquisition.receipt, file: normalized },
        signal,
      });
      const adopted: Acquisition = {
        id: acquisition.id,
        sourceId: acquisition.sourceId,
        evidence,
        journal: {
          ...acquisition.journal,
          fileName: `${acquisition.generation}/source/capture.journal.jsonl`,
        },
        bindings: acquisition.bindings,
      };
      for (const path of [
        normalized,
        sourceDirectory,
        directory,
        dirname(directory),
        this.directory,
      ]) {
        const file = await open(path, constants.O_RDONLY);
        try {
          await file.sync();
        } finally {
          await file.close();
        }
      }
      signal.throwIfAborted();
      return {
        close,
        publish: () => {
          signal.throwIfAborted();
          for (const binding of acquisition.bindings) {
            if (new Set(binding.sourceRoles).size !== binding.sourceRoles.length)
              throw new CatalogError("INVALID_PACKAGE", "Acquisition repeats a source role");
            for (const role of binding.sourceRoles) {
              const expected = this.binding(
                this.assets.get(binding.assetId),
                role,
                this.acquired(evidence, role),
                acquisition.receipt.publications?.video,
              );
              if (!isDeepStrictEqual({ ...expected, sourceRoles: binding.sourceRoles }, binding))
                throw new CatalogError(
                  "INVALID_PACKAGE",
                  "Acquisition binding conflicts with source clocks and evidence",
                );
            }
          }
          this.assets.retain(
            { kind: "acquisition", id: acquisition.id },
            acquisition.bindings.map((binding) => binding.assetId),
          );
          this.store.publish(adopted);
        },
      };
    } catch (error) {
      await close();
      throw error;
    }
  }

  async executeImport(
    acquisitionId: string,
    attemptId: string,
    native: {
      probe: (
        path: string,
        signal: AbortSignal,
        lifetime?: { readonly fd: number },
      ) => ReturnType<AssetProbe>;
      exportSource: SourceExporter;
    },
    signal: AbortSignal,
  ): Promise<Acquisition> {
    const lifetime = await this.lease(false);
    try {
      const intent = this.store.intent(acquisitionId);
      if (intent.kind === "package")
        throw new CatalogError("INVALID_REQUEST", "Capture import requires an import admission");
      const ready = this.catalog.catalog
        .prepare("SELECT metadata FROM acquisitions WHERE id=?")
        .get(acquisitionId)!;
      if (ready.metadata !== null) return JSON.parse(ready.metadata as string);
      const files =
        intent.kind === "capture" ? await this.freezeCapture(intent, signal) : intent.files;
      const owner = { kind: "acquisition" as const, id: acquisitionId };
      const directory = join(this.directory, acquisitionId, attemptId);
      const sourceDirectory = join(directory, "source");
      await mkdir(sourceDirectory, { recursive: true, mode: 0o700 });
      let indexed: SourceEvidenceMetadata | undefined;
      let published = false;
      try {
        for (const member of ["narration.mov", "system.mov", ...publicationMembers] as const) {
          if (files[member]) continue;
          const path = join(dirname(files["video.mov"]!.path), member);
          const present = await lstat(path).then(
            () => true,
            (error) => {
              if (missing(error)) return false;
              if (intent.kind === "capture")
                deferredReadFailure(
                  new CatalogError("INVALID_PATH", "Cannot inspect frozen capture member", {
                    filesystemCode: (error as NodeJS.ErrnoException).code,
                  }),
                  true,
                );
              throw error;
            },
          );
          if (present)
            throw new CatalogError(
              "SOURCE_CHANGED",
              "An absent capture member appeared after admission",
            );
        }
        const journal = files["capture.journal.jsonl"]!;
        const copied = await copyImportedFile(
          journal.path,
          join(sourceDirectory, "capture.journal.jsonl"),
          signal,
          journal,
          268_435_456,
        );
        for (const name of publicationMembers) {
          const proof = files[name];
          if (proof)
            await copyImportedFile(
              proof.path,
              join(sourceDirectory, name),
              signal,
              proof,
              name === "camera.mapping.jsonl" ? 268_435_456 : 65_536,
            );
        }
        const canonical = Object.fromEntries(
          (["video", "narration", "system"] as const).flatMap((role) => {
            const file = files[`${role}.mov`];
            return file ? [[role, file]] : [];
          }),
        );
        const output = join(directory, "source.jsonl");
        const receipt = await native.exportSource(sourceDirectory, output, signal, canonical, [
          lifetime.fd,
        ]);
        const sourceId = receipt.header?.sessionID;
        if (typeof sourceId !== "string" || !sourceId)
          throw new CatalogError("INVALID_EVIDENCE", "Capture journal has no session identity");
        if (intent.kind === "capture" && sourceId !== intent.sourceId)
          throw new CatalogError(
            "SOURCE_CHANGED",
            "Capture journal does not name the allocated source",
          );
        indexed = await this.evidence.ingest({
          owner: { kind: "acquisition", acquisitionId },
          sourceId,
          generation: attemptId,
          file: output,
          receipt,
          signal,
        });
        const bindings: Acquisition["bindings"] = [];
        for (const sourceRole of ["video", "narration", "system"] as const) {
          const source = files[`${sourceRole}.mov`];
          if (!source) continue;
          if (
            receipt.header?.schemaVersion === 2 &&
            sourceRole !== "video" &&
            !receipt.publications?.[sourceRole]
          )
            throw new CatalogError(
              "INVALID_EVIDENCE",
              "Canonical audio lacks verified publication proof",
            );
          const asset = await this.assets.import(
            source.path,
            { kind: "capture", source: sourceId },
            (path, signal) => native.probe(path, signal, lifetime),
            signal,
            (value) => this.assets.retain(owner, [value.id]),
            {
              ...source,
              ...(receipt.publications?.[sourceRole]
                ? { sha256: receipt.publications[sourceRole]!.canonical.sha256 }
                : {}),
            },
          );
          const binding = this.binding(
            asset,
            sourceRole,
            this.acquired(indexed, sourceRole),
            receipt.publications?.video,
          );
          const same = bindings.find(
            (row) => row.assetId === binding.assetId && row.streamId === binding.streamId,
          );
          if (same) {
            if (JSON.stringify(same.available) !== JSON.stringify(binding.available))
              throw new CatalogError(
                "UNSUPPORTED_MEDIA",
                "Identical captured streams have conflicting acquisition support",
                { assetId: asset.id, streamId: binding.streamId },
              );
            same.sourceRoles.push(sourceRole);
          } else bindings.push(binding);
        }
        const value: Acquisition = {
          id: acquisitionId,
          sourceId,
          evidence: indexed,
          journal: { fileName: `${attemptId}/source/capture.journal.jsonl`, ...copied },
          bindings,
        };
        await chmod(output, 0o400);
        for (const retained of [
          output,
          sourceDirectory,
          directory,
          dirname(directory),
          this.directory,
        ]) {
          const handle = await open(retained, constants.O_RDONLY);
          try {
            await handle.sync();
          } finally {
            await handle.close();
          }
        }
        signal.throwIfAborted();
        this.catalog.transaction(() => {
          this.store.publish(value);
        });
        published = true;
        return value;
      } catch (error) {
        // Frozen donor opens preserve their OS cause; explicit imports keep their existing policy.
        if (
          intent.kind === "capture" &&
          error instanceof CatalogError &&
          typeof error.details.filesystemCode === "string"
        )
          deferredReadFailure(error, true);
        throw error;
      } finally {
        if (!published) {
          if (indexed) this.evidence.removeUnpublished(indexed);
          this.assets.release(owner);
          await rm(directory, { recursive: true, force: true });
        }
      }
    } finally {
      await lifetime.close();
    }
  }
  private *acquired(identity: SourceEvidenceMetadata, role: "video" | "narration" | "system") {
    if (role === "video") return;
    for (const page of this.evidence.exportRecords(identity, role))
      for (const row of page) yield JSON.parse(row.content) as { startUs: number; endUs: number };
  }
  private binding(
    asset: Asset,
    sourceRole: Acquisition["bindings"][number]["sourceRoles"][number],
    intervals: Iterable<{ startUs: number; endUs: number }>,
    camera?: CameraPublicationProof,
  ): Acquisition["bindings"][number] {
    const kind = sourceRole === "video" ? "video" : "audio";
    const streams = compositionAsset(asset).streams.filter((stream) => stream.kind === kind);
    if (streams.length !== 1 || streams[0]!.kind === "image")
      throw new CatalogError(
        "UNSUPPORTED_MEDIA",
        "Captured member must contain exactly one matching decodable stream",
        { assetId: asset.id, sourceRole },
      );
    const stream = streams[0]!;
    let available = stream.available;
    if (sourceRole === "video" && camera) {
      const verified = [
        {
          startUs: toTime(subtract(fromTime(camera.support.startUs), fromTime(asset.originUs))),
          endUs: toTime(subtract(fromTime(camera.support.endUs), fromTime(asset.originUs))),
        },
      ];
      if (!isDeepStrictEqual(available, verified))
        throw new CatalogError(
          "INVALID_EVIDENCE",
          "Camera physical support differs from verified source support",
        );
      available = verified;
    }
    if (sourceRole !== "video") {
      available = [];
      for (const interval of intervals) {
        const start = subtract(fromTime(interval.startUs), fromTime(asset.originUs));
        const end = subtract(fromTime(interval.endUs), fromTime(asset.originUs));
        const clippedStart = compare(start, fromTime(0)) < 0 ? fromTime(0) : start;
        if (compare(clippedStart, end) < 0)
          available.push({ startUs: toTime(clippedStart), endUs: toTime(end) });
        if (available.length > 100_000)
          throw new CatalogError("LIMIT_EXCEEDED", "Capture acquisition interval limit exceeded");
      }
    }
    return {
      assetId: asset.id,
      streamId: stream.id,
      available,
      sourceRoles: [sourceRole],
      sourceToAssetOffsetUs: toSignedTime(subtract(fromTime(0), fromTime(asset.originUs))),
      supportBasis: sourceRole === "video" ? "physical" : "captured-audio",
    };
  }

  /** One cleanup domain: startup must not purge any rows or files while an orphan native attempt owns it. */
  private async lease(exclusive: boolean) {
    return openDirectoryLease(this.directory, exclusive ? "exclusive" : "shared").catch(
      (error: NodeJS.ErrnoException) => {
        if (error.code === "EAGAIN" || error.code === "EWOULDBLOCK")
          throw new CatalogError(
            "ACQUISITION_BUSY",
            "An acquisition worker still owns this library; retry startup after it exits",
            {},
            true,
          );
        throw error;
      },
    );
  }

  /** Exclusive service startup only, before constructing the queue or admitting new work. */
  async recover(signal: AbortSignal): Promise<void> {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    const lifetime = await this.lease(true);
    try {
      for await (const entry of await opendir(this.directory)) {
        signal.throwIfAborted();
        const row = this.catalog.catalog
          .prepare("SELECT metadata FROM acquisitions WHERE id=?")
          .get(entry.name);
        const metadata = row?.metadata ? (JSON.parse(row.metadata as string) as Acquisition) : null;
        if (!metadata) {
          await this.evidence.purge({ kind: "acquisition", acquisitionId: entry.name }, signal);
          this.assets.release({ kind: "acquisition", id: entry.name });
          await rm(join(this.directory, entry.name), { recursive: true, force: true });
          if (row) {
            const intent = this.store.intent(entry.name);
            if (intent.kind === "package") this.store.discardPortable(entry.name, intent.requestId);
          }
        } else {
          for await (const attempt of await opendir(join(this.directory, entry.name))) {
            if (attempt.name !== metadata.evidence.generation)
              await rm(join(this.directory, entry.name, attempt.name), {
                recursive: true,
                force: true,
              });
          }
        }
      }
      // A crash can happen after reserving an intent but before creating its directory.
      for (;;) {
        const pending = this.catalog.catalog
          .prepare(
            "SELECT id,requestId FROM acquisitions WHERE metadata IS NULL AND json_extract(admission,'$.kind')='package' LIMIT 256",
          )
          .all() as { id: string; requestId: string }[];
        if (!pending.length) break;
        for (const intent of pending) {
          signal.throwIfAborted();
          await this.evidence.purge({ kind: "acquisition", acquisitionId: intent.id }, signal);
          this.assets.release({ kind: "acquisition", id: intent.id });
          this.store.discardPortable(intent.id, intent.requestId);
        }
      }
    } finally {
      await lifetime.close();
    }
  }
}

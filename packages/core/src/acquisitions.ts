import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { isDeepStrictEqual } from "node:util";
import { constants, openSync, fstatSync, closeSync } from "node:fs";
import { chmod, lstat, mkdir, open, opendir, realpath, rm } from "node:fs/promises";
import { dirname, isAbsolute, join } from "node:path";
import { acquisitionContextSchema, type AcquisitionContext } from "@screenrec/composition";
import { AssetStore, compositionAsset, type Asset, type AssetProbe } from "./assets.js";
import { Catalog, CatalogError } from "./catalog.js";
import { copyImportedFile, fileIdentity, hashFile, type IdentifiedFile } from "./files.js";
import {
  validateSourceReceipt,
  type SourceEvidenceMetadata,
  type SourceEvidenceStore,
} from "./evidence.js";
import type { SourceExporter } from "./processing.js";
import { ResourceReferences, type ResourceOwner } from "./references.js";

const members = ["capture.journal.jsonl", "video.mov", "narration.mov", "system.mov"] as const;
type Member = (typeof members)[number];
type SourceFiles = Record<Member, IdentifiedFile | null>;
export type PreparedAcquisition = { requestId: string; path: string; files: SourceFiles };
export type AcquisitionImportIntent = PreparedAcquisition & {
  kind: "import";
  acquisitionId: string;
};
export type AcquisitionIntent =
  | AcquisitionImportIntent
  | { kind: "package"; acquisitionId: string; requestId: string; packageIdentity: string };
type AcquisitionAdmission =
  | Omit<AcquisitionImportIntent, "acquisitionId" | "requestId">
  | { kind: "package"; packageIdentity: string };

export type Acquisition = {
  id: string;
  sourceId: string;
  evidence: SourceEvidenceMetadata;
  journal: { fileName: string; bytes: number; sha256: string };
  bindings: (AcquisitionContext["bindings"][number] & {
    sourceRoles: ("video" | "narration" | "system")[];
    sourceToAssetOffsetUs: number;
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
            sourceToAssetOffsetUs: z
              .number()
              .int()
              .min(Number.MIN_SAFE_INTEGER)
              .max(Number.MAX_SAFE_INTEGER),
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
>;
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
    const value = this.get(acquisitionId);
    return {
      id: value.id,
      bindings: value.bindings.map(({ assetId, streamId, available }) => ({
        assetId,
        streamId,
        available,
      })),
    };
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
    const root = await realpath(path).catch((error) => {
      throw new CatalogError(
        missing(error) ? "NOT_FOUND" : "INVALID_PATH",
        "Cannot open capture source directory",
      );
    });
    if (!(await lstat(root)).isDirectory())
      throw new CatalogError("INVALID_PATH", "Capture source must be a directory");
    const files = {} as SourceFiles;
    for (const member of members) {
      const source = join(root, member);
      // Freeze explicit members, including absence; never follow a member outside the admitted directory.
      const file = await open(
        source,
        constants.O_RDONLY | constants.O_NONBLOCK | constants.O_NOFOLLOW,
      ).catch((error) => {
        if (missing(error) && (member === "narration.mov" || member === "system.mov")) return null;
        throw new CatalogError(
          missing(error) ? "NOT_FOUND" : "INVALID_PATH",
          `Cannot admit capture member: ${member}`,
        );
      });
      if (!file) {
        files[member] = null;
        continue;
      }
      try {
        const stat = await file.stat({ bigint: true });
        if (!stat.isFile() || stat.size > BigInt(Number.MAX_SAFE_INTEGER))
          throw new CatalogError(
            "INVALID_PATH",
            `Capture member must be a regular file: ${member}`,
          );
        files[member] = { path: source, bytes: Number(stat.size), identity: fileIdentity(stat) };
      } finally {
        await file.close();
      }
    }
    return { requestId, path, files };
  }
  journalPath(id: string): string {
    return join(this.directory, id, this.store.get(id).journal.fileName);
  }

  portable(id: string): {
    acquisition: PortableAcquisition;
    files: Record<"journal" | "normalized", IdentifiedFile>;
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
      },
    };
  }
  async stagePortable(value: unknown, files: PortableAcquisitionFiles, signal: AbortSignal) {
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
              const expected = this.binding(this.assets.get(binding.assetId), role, evidence);
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
    native: { probe: AssetProbe; exportSource: SourceExporter },
    signal: AbortSignal,
  ): Promise<Acquisition> {
    const intent = this.store.intent(acquisitionId);
    if (intent.kind !== "import")
      throw new CatalogError("INVALID_REQUEST", "Capture import requires an import admission");
    const ready = this.catalog.catalog
      .prepare("SELECT metadata FROM acquisitions WHERE id=?")
      .get(acquisitionId)!;
    if (ready.metadata !== null) return JSON.parse(ready.metadata as string);
    const owner = { kind: "acquisition" as const, id: acquisitionId };
    const directory = join(this.directory, acquisitionId, attemptId);
    const sourceDirectory = join(directory, "source");
    await mkdir(sourceDirectory, { recursive: true, mode: 0o700 });
    let indexed: SourceEvidenceMetadata | undefined;
    let published = false;
    try {
      for (const member of ["narration.mov", "system.mov"] as const) {
        if (intent.files[member]) continue;
        const path = join(dirname(intent.files["video.mov"]!.path), member);
        const present = await lstat(path).then(
          () => true,
          (error) => {
            if (missing(error)) return false;
            throw error;
          },
        );
        if (present)
          throw new CatalogError(
            "SOURCE_CHANGED",
            "An absent capture member appeared after admission",
          );
      }
      const journal = intent.files["capture.journal.jsonl"]!;
      const copied = await copyImportedFile(
        journal.path,
        join(sourceDirectory, "capture.journal.jsonl"),
        signal,
        journal,
        268_435_456,
      );
      const output = join(directory, "source.jsonl");
      const receipt = await native.exportSource(sourceDirectory, output, signal);
      const sourceId = receipt.header?.sessionID;
      if (typeof sourceId !== "string" || !sourceId)
        throw new CatalogError("INVALID_EVIDENCE", "Capture journal has no session identity");
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
        const source = intent.files[`${sourceRole}.mov`];
        if (!source) continue;
        const asset = await this.assets.import(
          source.path,
          { kind: "capture", source: sourceId },
          native.probe,
          signal,
          (value) => this.assets.retain(owner, [value.id]),
          source,
        );
        const binding = this.binding(asset, sourceRole, indexed);
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
    } finally {
      if (!published) {
        if (indexed) this.evidence.removeUnpublished(indexed);
        this.assets.release(owner);
        await rm(directory, { recursive: true, force: true });
      }
    }
  }
  private binding(
    asset: Asset,
    sourceRole: Acquisition["bindings"][number]["sourceRoles"][number],
    identity: SourceEvidenceMetadata,
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
    if (sourceRole !== "video") {
      available = [];
      for (const page of this.evidence.exportRecords(identity, sourceRole)) {
        for (const row of page) {
          const interval = JSON.parse(row.content) as { startUs: number; endUs: number };
          const startUs = Math.max(0, interval.startUs - asset.originUs);
          const endUs = interval.endUs - asset.originUs;
          if (!Number.isSafeInteger(startUs) || !Number.isSafeInteger(endUs))
            throw new CatalogError(
              "UNSUPPORTED_MEDIA",
              "Capture timing exceeds the normalized source clock",
            );
          if (startUs < endUs) available.push({ startUs, endUs });
        }
        if (available.length > 100_000)
          throw new CatalogError("LIMIT_EXCEEDED", "Capture acquisition interval limit exceeded");
      }
    }
    return {
      assetId: asset.id,
      streamId: stream.id,
      available,
      sourceRoles: [sourceRole],
      sourceToAssetOffsetUs: asset.originUs === 0 ? 0 : -asset.originUs,
      supportBasis: sourceRole === "video" ? "physical" : "captured-audio",
    };
  }

  /** Exclusive service startup only, before constructing the queue or admitting new work. */
  async recover(signal: AbortSignal): Promise<void> {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
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
  }
}

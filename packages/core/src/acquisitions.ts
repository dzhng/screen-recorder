import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { chmod, lstat, mkdir, open, opendir, realpath, rm } from "node:fs/promises";
import { dirname, isAbsolute, join } from "node:path";
import type { AcquisitionContext } from "@screenrec/composition";
import { AssetStore, compositionAsset, type Asset, type AssetProbe } from "./assets.js";
import { Catalog, CatalogError } from "./catalog.js";
import { copyImportedFile, fileIdentity, type IdentifiedFile } from "./files.js";
import type { SourceEvidenceMetadata, SourceEvidenceStore } from "./evidence.js";
import type { SourceExporter } from "./processing.js";
import { ResourceReferences, type ResourceOwner } from "./references.js";

const members = ["capture.journal.jsonl", "video.mov", "narration.mov", "system.mov"] as const;
type Member = (typeof members)[number];
type SourceFiles = Record<Member, IdentifiedFile | null>;
export type PreparedAcquisition = { requestId: string; path: string; files: SourceFiles };
export type AcquisitionIntent = PreparedAcquisition & { acquisitionId: string };
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
const missing = (error: unknown) => (error as NodeJS.ErrnoException).code === "ENOENT";

/** An explicit capture adoption owns its media and journal independently of the donor library. */
export class AcquisitionStore {
  private readonly dependencies: ResourceReferences;
  constructor(private readonly catalog: Catalog) {
    this.dependencies = new ResourceReferences(catalog);
    catalog.catalog.exec(`CREATE TABLE IF NOT EXISTS acquisitions (
      id TEXT PRIMARY KEY, requestId TEXT UNIQUE NOT NULL, path TEXT NOT NULL,
      files TEXT NOT NULL, metadata TEXT
    ) STRICT`);
  }

  replay(requestId: string, path: string): AcquisitionIntent | null {
    const row = this.catalog.catalog
      .prepare("SELECT id,path FROM acquisitions WHERE requestId=?")
      .get(requestId);
    if (!row) return null;
    if (row.path !== path)
      throw new CatalogError(
        "REQUEST_CONFLICT",
        "Acquisition request ID already names another directory",
      );
    return this.intent(row.id as string);
  }
  /** Called inside the shared queue admission transaction. */
  admitImport(prepared: PreparedAcquisition): AcquisitionIntent {
    const replay = this.replay(prepared.requestId, prepared.path);
    if (replay) return replay;
    const acquisitionId = randomUUID();
    this.catalog.catalog
      .prepare("INSERT INTO acquisitions VALUES(?,?,?,?,NULL)")
      .run(acquisitionId, prepared.requestId, prepared.path, JSON.stringify(prepared.files));
    return this.intent(acquisitionId);
  }
  intent(acquisitionId: string): AcquisitionIntent {
    const row = this.catalog.catalog
      .prepare("SELECT requestId,path,files FROM acquisitions WHERE id=?")
      .get(acquisitionId);
    if (!row) throw new CatalogError("NOT_FOUND", "Acquisition does not exist", { acquisitionId });
    return {
      acquisitionId,
      requestId: row.requestId as string,
      path: row.path as string,
      files: JSON.parse(row.files as string),
    };
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

  async executeImport(
    acquisitionId: string,
    attemptId: string,
    native: { probe: AssetProbe; exportSource: SourceExporter },
    signal: AbortSignal,
  ): Promise<Acquisition> {
    const intent = this.store.intent(acquisitionId);
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
        this.catalog.catalog
          .prepare("UPDATE acquisitions SET metadata=? WHERE id=?")
          .run(JSON.stringify(value), acquisitionId);
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
      sourceToAssetOffsetUs: -asset.originUs,
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
  }
}

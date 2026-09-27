import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { mkdir, open, link, unlink, opendir, rm, lstat } from "node:fs/promises";
import { extname, isAbsolute, join } from "node:path";
import { z } from "zod";
import { Catalog, CatalogError } from "./catalog.js";
import { fileIdentity, type IdentifiedFile } from "./files.js";
import { isDeepStrictEqual } from "node:util";

const integer = z.number().int().min(Number.MIN_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER);
const positive = integer.positive();
const segment = z.object({
  startUs: integer,
  endUs: integer,
  empty: z.boolean(),
  mediaStartUs: integer.optional(),
  mediaDurationUs: integer.nonnegative().optional(),
});
const stream = z.object({
  id: z.string().min(1),
  kind: z.enum(["image", "video", "audio", "unsupported"]),
  codec: z.string(),
  decodable: z.boolean(),
  startUs: integer.optional(),
  endUs: integer.optional(),
  segments: z.array(segment).max(100_000).optional(),
  width: positive.optional(),
  height: positive.optional(),
  orientedWidth: positive.optional(),
  orientedHeight: positive.optional(),
  transform: z.array(z.number().finite()).length(6).optional(),
  orientation: integer.min(1).max(8).optional(),
  hasAlpha: z.boolean().optional(),
  sampleRate: z.number().positive().finite().optional(),
  channels: positive.optional(),
  channelLayoutTag: integer.nonnegative().optional(),
  colorPrimaries: z.string().optional(),
  transferFunction: z.string().optional(),
  ycbcrMatrix: z.string().optional(),
  samples: z
    .object({
      count: integer.nonnegative(),
      firstPtsUs: integer,
      lastPtsUs: integer,
      minDurationUs: integer.nonnegative(),
      maxDurationUs: integer.nonnegative(),
    })
    .optional(),
});
export const mediaProbeSchema = z.object({
  originUs: integer,
  streams: z.array(stream).min(1).max(256),
});
export type MediaProbe = z.infer<typeof mediaProbeSchema>;
export type Asset = MediaProbe & { id: string; bytes: number; createdAt: string; fileName: string };
export type AssetSummary = Pick<Asset, "id" | "bytes" | "createdAt" | "fileName"> & {
  mediaKinds: MediaProbe["streams"][number]["kind"][];
  streamCount: number;
};
export type AssetProvenance = { kind: "import" | "capture" | "generated"; source?: string };
export type ImportIntent = {
  importId: string;
  requestId: string;
  path: string;
  assetId: string | null;
  source: IdentifiedFile;
};
export type PreparedImport = Pick<ImportIntent, "requestId" | "path" | "source">;
export type AssetOwner = { kind: "asset" | "project" | "revision" | "job" | "export"; id: string };
export type AssetProbe = (path: string, signal: AbortSignal) => Promise<unknown>;
const absent = (error: unknown) => (error as NodeJS.ErrnoException).code === "ENOENT";

/** Immutable media and references share the project catalog; only ready assets are visible. */
export class AssetStore {
  private readonly directory: string;
  private readonly staging: string;
  constructor(
    private readonly store: Catalog,
    private readonly libraryDirectory: string,
  ) {
    this.directory = join(libraryDirectory, "assets");
    this.staging = join(libraryDirectory, "staging", "assets");
    store.catalog.exec(`
      CREATE TABLE IF NOT EXISTS asset_imports (
        importId TEXT PRIMARY KEY, requestId TEXT UNIQUE NOT NULL, path TEXT NOT NULL, assetId TEXT, source TEXT NOT NULL
      ) STRICT;
      CREATE TABLE IF NOT EXISTS assets (
        sequence INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT UNIQUE NOT NULL,
        metadata TEXT NOT NULL
      ) STRICT;
      CREATE TABLE IF NOT EXISTS asset_origins (
        assetId TEXT NOT NULL, provenance TEXT NOT NULL, PRIMARY KEY(assetId,provenance)
      ) STRICT;
      CREATE TABLE IF NOT EXISTS asset_references (
        assetId TEXT NOT NULL, ownerKind TEXT NOT NULL, ownerId TEXT NOT NULL,
        PRIMARY KEY(assetId,ownerKind,ownerId)
      ) STRICT;
      CREATE INDEX IF NOT EXISTS asset_reference_owner ON asset_references(ownerKind,ownerId);
    `);
  }

  /** Startup under the service lifetime lock, before any import can run. */
  async recover(): Promise<void> {
    for (const directory of [
      this.libraryDirectory,
      this.directory,
      join(this.libraryDirectory, "staging"),
      this.staging,
    ]) {
      await mkdir(directory, { recursive: true, mode: 0o700 });
      const stat = await lstat(directory);
      if (!stat.isDirectory() || stat.uid !== process.getuid?.() || (stat.mode & 0o077) !== 0)
        throw new CatalogError(
          "INVALID_PATH",
          "Managed asset directories must be private directories owned by this user",
        );
    }
    for await (const file of await opendir(this.staging))
      await rm(join(this.staging, file.name), { recursive: true, force: true });
    for await (const entry of await opendir(this.directory)) {
      const file = entry.name;
      const row = this.store.catalog
        .prepare("SELECT metadata FROM assets WHERE id=?")
        .get(file.split(".")[0]!);
      if (!row || (JSON.parse(row.metadata as string) as Asset).fileName !== file)
        await rm(join(this.directory, file), { recursive: true, force: true });
    }
  }

  async prepareImport(requestId: string, path: string): Promise<PreparedImport> {
    if (!requestId || !isAbsolute(path))
      throw new CatalogError(
        "INVALID_PARAMS",
        "Import requires a request ID and absolute local path",
      );
    const previous = this.importReplay(requestId, path);
    if (previous) return { requestId, path, source: previous.source };
    const file = await open(path, constants.O_RDONLY | constants.O_NONBLOCK).catch((error) => {
      throw new CatalogError(
        absent(error) ? "NOT_FOUND" : "INVALID_PATH",
        "Cannot open import source",
      );
    });
    let source: IdentifiedFile;
    try {
      const stat = await file.stat({ bigint: true });
      if (!stat.isFile() || stat.size > BigInt(Number.MAX_SAFE_INTEGER))
        throw new CatalogError(
          "UNSUPPORTED_MEDIA",
          "Import source must be a regular file of supported size",
        );
      source = { path, bytes: Number(stat.size), identity: fileIdentity(stat) };
    } finally {
      await file.close();
    }
    return { requestId, path, source };
  }
  /** Resolve the receipt inside the same transaction that admits its preparation job. */
  admitImport(prepared: PreparedImport): ImportIntent {
    const { requestId, path, source } = prepared;
    const existing = this.importReplay(requestId, path);
    if (existing) return existing;
    const importId = randomUUID();
    this.store.catalog
      .prepare("INSERT INTO asset_imports VALUES(?,?,?,NULL,?)")
      .run(importId, requestId, path, JSON.stringify(source));
    return this.intent(importId);
  }
  private importReplay(requestId: string, path: string): ImportIntent | null {
    const row = this.store.catalog
      .prepare("SELECT importId,path FROM asset_imports WHERE requestId=?")
      .get(requestId);
    if (!row) return null;
    if (row.path !== path)
      throw new CatalogError("REQUEST_CONFLICT", "Import request ID already names another path");
    return this.intent(row.importId as string);
  }
  intent(importId: string): ImportIntent {
    const row = this.store.catalog
      .prepare("SELECT * FROM asset_imports WHERE importId=?")
      .get(importId);
    if (!row) throw new CatalogError("NOT_FOUND", "Import intent does not exist", { importId });
    return {
      importId: row.importId as string,
      requestId: row.requestId as string,
      path: row.path as string,
      assetId: row.assetId as string | null,
      source: JSON.parse(row.source as string) as IdentifiedFile,
    };
  }
  async executeImport(
    importId: string,
    probe: AssetProbe,
    signal: AbortSignal,
    owner?: AssetOwner,
  ): Promise<Asset> {
    const intent = this.intent(importId);
    if (intent.assetId) {
      const asset = this.get(intent.assetId);
      if (owner) this.retain(owner, [asset.id]);
      return asset;
    }
    return this.import(
      intent.path,
      { kind: "import", source: intent.path },
      probe,
      signal,
      (asset) => {
        this.store.catalog
          .prepare("UPDATE asset_imports SET assetId=? WHERE importId=?")
          .run(asset.id, importId);
        if (owner) this.retain(owner, [asset.id]);
      },
      intent.source,
    );
  }

  get(id: string): Asset {
    const row = this.store.catalog.prepare("SELECT metadata FROM assets WHERE id=?").get(id);
    if (!row) throw new CatalogError("NOT_FOUND", "Asset does not exist", { assetId: id });
    return JSON.parse(row.metadata as string) as Asset;
  }
  path(id: string): string {
    return join(this.directory, this.get(id).fileName);
  }
  list(input: { afterSequence?: number; limit?: number } = {}): {
    assets: AssetSummary[];
    nextCursor: { afterSequence: number } | null;
  } {
    const limit = input.limit ?? 250,
      after = input.afterSequence ?? 0;
    if (
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      limit > 1000 ||
      !Number.isSafeInteger(after) ||
      after < 0
    )
      throw new CatalogError("INVALID_PARAMS", "Invalid asset page bounds");
    const rows = this.store.catalog
      .prepare(`SELECT sequence,id,
        json_extract(metadata,'$.bytes') AS bytes,
        json_extract(metadata,'$.createdAt') AS createdAt,
        json_extract(metadata,'$.fileName') AS fileName,
        json_array_length(metadata,'$.streams') AS streamCount,
        (SELECT json_group_array(kind) FROM (
          SELECT DISTINCT json_extract(value,'$.kind') AS kind
          FROM json_each(assets.metadata,'$.streams') ORDER BY kind
        )) AS mediaKinds
        FROM assets WHERE sequence>? ORDER BY sequence LIMIT ?`)
      .all(after, limit + 1);
    return {
      assets: rows.slice(0, limit).map(
        ({ sequence: _sequence, mediaKinds, ...row }) =>
          ({
            ...row,
            mediaKinds: JSON.parse(mediaKinds as string),
          }) as AssetSummary,
      ),
      nextCursor:
        rows.length > limit ? { afterSequence: rows[limit - 1]!.sequence as number } : null,
    };
  }
  origins(
    id: string,
    input: { afterProvenance?: string; limit?: number } = {},
  ): {
    origins: AssetProvenance[];
    nextCursor: { afterProvenance: string } | null;
  } {
    this.get(id);
    const limit = input.limit ?? 250;
    if (
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      limit > 1000 ||
      (input.afterProvenance !== undefined && typeof input.afterProvenance !== "string")
    )
      throw new CatalogError("INVALID_PARAMS", "Invalid provenance page bounds");
    const rows = this.store.catalog
      .prepare(
        "SELECT provenance FROM asset_origins WHERE assetId=? AND provenance>? ORDER BY provenance LIMIT ?",
      )
      .all(id, input.afterProvenance ?? "", limit + 1);
    return {
      origins: rows
        .slice(0, limit)
        .map((row) => JSON.parse(row.provenance as string) as AssetProvenance),
      nextCursor:
        rows.length > limit ? { afterProvenance: rows[limit - 1]!.provenance as string } : null,
    };
  }
  /** Call inside the revision/job transaction when references must commit with that owner. */
  retain(owner: AssetOwner, ids: readonly string[]): void {
    for (const id of ids) this.get(id);
    for (const id of ids)
      this.store.catalog
        .prepare("INSERT OR IGNORE INTO asset_references VALUES(?,?,?)")
        .run(id, owner.kind, owner.id);
  }
  release(owner: AssetOwner): void {
    this.store.catalog
      .prepare("DELETE FROM asset_references WHERE ownerKind=? AND ownerId=?")
      .run(owner.kind, owner.id);
  }
  references(id: string): AssetOwner[] {
    this.get(id);
    return this.store.catalog
      .prepare(
        "SELECT ownerKind AS kind,ownerId AS id FROM asset_references WHERE assetId=? ORDER BY ownerKind,ownerId",
      )
      .all(id) as AssetOwner[];
  }

  async import(
    path: string,
    provenance: AssetProvenance,
    probe: AssetProbe,
    signal: AbortSignal = new AbortController().signal,
    published?: (asset: Asset) => void,
    expected?: IdentifiedFile,
  ): Promise<Asset> {
    if (!isAbsolute(path))
      throw new CatalogError("INVALID_PATH", "Asset import requires an absolute local path");
    signal.throwIfAborted();
    const extension = extname(path).toLowerCase();
    const suffix = /^\.[a-z0-9]{1,12}$/.test(extension) ? extension : "";
    const staging = join(this.staging, randomUUID() + suffix);
    let input;
    try {
      input = await open(path, constants.O_RDONLY | constants.O_NONBLOCK);
    } catch (error) {
      throw new CatalogError(
        absent(error) ? "NOT_FOUND" : "INVALID_PATH",
        "Cannot open import source",
      );
    }
    try {
      const before = await input.stat({ bigint: true });
      if (
        expected &&
        (BigInt(expected.bytes) !== before.size ||
          !isDeepStrictEqual(expected.identity, fileIdentity(before)))
      )
        throw new CatalogError(
          "SOURCE_CHANGED",
          "Import source no longer matches the frozen request; create a new import",
          {},
          false,
        );
      if (!before.isFile() || before.size > BigInt(Number.MAX_SAFE_INTEGER))
        throw new CatalogError(
          "UNSUPPORTED_MEDIA",
          "Import source must be a regular file of supported size",
        );
      const output = await open(staging, "wx", 0o600);
      const hash = createHash("sha256");
      let bytes = 0;
      try {
        const buffer = Buffer.allocUnsafe(1024 * 1024);
        for (;;) {
          signal.throwIfAborted();
          const read = await input.read(buffer, 0, buffer.length, null);
          if (!read.bytesRead) break;
          bytes += read.bytesRead;
          if (BigInt(bytes) > before.size)
            throw new CatalogError(
              "SOURCE_CHANGED",
              "Import source grew during copying",
              {},
              false,
            );
          hash.update(buffer.subarray(0, read.bytesRead));
          let written = 0;
          while (written < read.bytesRead) {
            signal.throwIfAborted();
            const result = await output.write(buffer, written, read.bytesRead - written);
            if (!result.bytesWritten)
              throw new CatalogError("STORAGE_ERROR", "Import copy made no progress");
            written += result.bytesWritten;
          }
        }
        const after = await input.stat({ bigint: true });
        if (
          BigInt(bytes) !== before.size ||
          after.size !== before.size ||
          after.mtimeNs !== before.mtimeNs ||
          after.ctimeNs !== before.ctimeNs
        )
          throw new CatalogError(
            "SOURCE_CHANGED",
            "Import source changed during copying",
            {},
            false,
          );
        await output.chmod(0o400);
        await output.sync();
      } finally {
        await output.close();
      }
      const id = hash.digest("hex");
      const existing = this.store.catalog.prepare("SELECT metadata FROM assets WHERE id=?").get(id);
      if (existing) {
        signal.throwIfAborted();
        return this.store.transaction(() => {
          this.store.catalog
            .prepare("INSERT OR IGNORE INTO asset_origins VALUES(?,?)")
            .run(id, JSON.stringify(provenance));
          const asset = JSON.parse(existing.metadata as string) as Asset;
          published?.(asset);
          return asset;
        });
      }
      const parsed = mediaProbeSchema.safeParse(await probe(staging, signal));
      if (!parsed.success)
        throw new CatalogError("INVALID_NATIVE_RESPONSE", "Media probe returned invalid metadata");
      const metadata = parsed.data;
      if (!metadata.streams.some((stream) => stream.kind !== "unsupported" && stream.decodable))
        throw new CatalogError(
          "UNSUPPORTED_MEDIA",
          `Media contains no decodable streams: ${metadata.streams.map((stream) => stream.codec).join(", ")}`,
          {
            streams: metadata.streams.map(({ id, kind, codec, decodable }) => ({
              id,
              kind,
              codec,
              decodable,
            })),
          },
        );
      const ids = new Set<string>();
      for (const item of metadata.streams) {
        if (ids.has(item.id))
          throw new CatalogError(
            "INVALID_NATIVE_RESPONSE",
            "Media probe repeated a stream identity",
          );
        ids.add(item.id);
        if (item.kind === "audio" || item.kind === "video") {
          if (
            item.startUs === undefined ||
            item.endUs === undefined ||
            item.startUs < 0 ||
            item.endUs <= item.startUs ||
            !item.segments?.length
          )
            throw new CatalogError(
              "UNSUPPORTED_MEDIA",
              "Timed stream has no occupied presentation interval",
              { streamId: item.id },
            );
        }
      }
      signal.throwIfAborted();
      const fileName = id + suffix;
      const asset: Asset = {
        id,
        bytes,
        createdAt: new Date().toISOString(),
        fileName,
        ...metadata,
      };
      // Hard-link publication never overwrites a concurrent import of the same hash.
      try {
        await link(staging, join(this.directory, fileName));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      }
      const directory = await open(this.directory, constants.O_RDONLY);
      try {
        await directory.sync();
      } finally {
        await directory.close();
      }
      signal.throwIfAborted();
      const result = this.store.transaction(() => {
        this.store.catalog
          .prepare("INSERT OR IGNORE INTO assets(id,metadata) VALUES(?,?)")
          .run(id, JSON.stringify(asset));
        this.store.catalog
          .prepare("INSERT OR IGNORE INTO asset_origins VALUES(?,?)")
          .run(id, JSON.stringify(provenance));
        const ready = this.get(id);
        published?.(ready);
        return ready;
      });
      if (result.fileName !== fileName)
        await unlink(join(this.directory, fileName)).catch((error) => {
          if (!absent(error)) throw error;
        });
      return result;
    } finally {
      await input.close();
      await unlink(staging).catch((error) => {
        if (!absent(error)) throw error;
      });
    }
  }
}

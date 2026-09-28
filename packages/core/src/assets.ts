import { isDeepStrictEqual } from "node:util";
import { ResourceReferences, resourceKinds, type ResourceOwner } from "./references.js";
import type { Asset as CompositionAsset } from "@screenrec/composition";
import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { mkdir, open, link, unlink, opendir, rm, lstat } from "node:fs/promises";
import { extname, isAbsolute, join } from "node:path";
import { z } from "zod";
import { Catalog, CatalogError } from "./catalog.js";
import { copyImportedFile, fileIdentity, hashFile, type IdentifiedFile } from "./files.js";

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
  orientedWidth: z.number().finite().positive().optional(),
  orientedHeight: z.number().finite().positive().optional(),
  orientedPixelBounds: z
    .object({
      x: z.number().finite(),
      y: z.number().finite(),
      width: z.number().finite().positive(),
      height: z.number().finite().positive(),
    })
    .optional(),
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
export const portableAssetSchema = z.strictObject({
  asset: mediaProbeSchema
    .extend({
      id: z.string().regex(/^[a-f0-9]{64}$/),
      bytes: integer.nonnegative(),
      createdAt: z.string().min(1),
      fileName: z.string().regex(/^[a-f0-9]{64}(?:\.[a-z0-9]{1,12})?$/),
    })
    .strict(),
  origins: z
    .array(
      z.strictObject({
        kind: z.enum(["import", "capture", "generated"]),
        source: z.string().optional(),
      }),
    )
    .max(1000),
  dependencies: z
    .array(z.strictObject({ kind: z.enum(resourceKinds), id: z.string().min(1).max(2048) }))
    .max(25_000),
});
export type PortableAsset = z.infer<typeof portableAssetSchema>;
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
export type AssetProbe = (path: string, signal: AbortSignal) => Promise<unknown>;
const absent = (error: unknown) => (error as NodeJS.ErrnoException).code === "ENOENT";

/** Immutable media and references share the project catalog; only ready assets are visible. */
export class AssetStore {
  private readonly directory: string;
  private readonly staging: string;
  private readonly dependencies: ResourceReferences;
  constructor(
    private readonly store: Catalog,
    private readonly libraryDirectory: string,
  ) {
    this.dependencies = new ResourceReferences(store);
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
    owner?: ResourceOwner,
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
  retain(owner: ResourceOwner, ids: readonly string[]): void {
    for (const id of ids) this.get(id);
    this.dependencies.retain("asset", owner, ids);
  }
  release(owner: ResourceOwner): void {
    this.dependencies.release("asset", owner);
  }
  references(id: string): ResourceOwner[] {
    this.get(id);
    return this.dependencies.owners("asset", id);
  }

  portable(id: string): PortableAsset {
    const origins = this.origins(id, { limit: 1000 });
    if (origins.nextCursor)
      throw new CatalogError("LIMIT_EXCEEDED", "Asset provenance exceeds package limit");
    const dependencies = this.dependencies.dependencies({ kind: "asset", id });
    return { asset: this.get(id), origins: origins.origins, dependencies };
  }

  /** Copy and hash before the caller's shared publication transaction. Unpublished links recover as orphans. */
  async stagePortable(
    value: unknown,
    path: string,
    signal: AbortSignal,
    expected?: IdentifiedFile,
  ) {
    const parsed = portableAssetSchema.safeParse(value);
    if (!parsed.success)
      throw new CatalogError("INVALID_PACKAGE", "Invalid portable asset metadata");
    const { asset, origins, dependencies } = parsed.data;
    if (!asset.fileName.startsWith(asset.id))
      throw new CatalogError("INVALID_PACKAGE", "Asset member identity differs from its hash");
    const staging = join(this.staging, randomUUID() + extname(asset.fileName));
    let retainedName = asset.fileName;
    const close = async () => {
      await unlink(staging).catch((error) => {
        if (!absent(error)) throw error;
      });
      const row = this.store.catalog
        .prepare("SELECT metadata FROM assets WHERE id=?")
        .get(asset.id);
      if (row && (JSON.parse(row.metadata as string) as Asset).fileName !== retainedName)
        await unlink(join(this.directory, retainedName)).catch((error) => {
          if (!absent(error)) throw error;
        });
    };
    try {
      const copied = await copyImportedFile(path, staging, signal, expected);
      if (copied.sha256 !== asset.id || copied.bytes !== asset.bytes)
        throw new CatalogError(
          "INVALID_PACKAGE",
          "Asset byte hash or size does not match its identity",
        );
      const stored = this.store.catalog
        .prepare("SELECT metadata FROM assets WHERE id=?")
        .get(asset.id);
      if (stored) retainedName = (JSON.parse(stored.metadata as string) as Asset).fileName;
      await link(staging, join(this.directory, retainedName)).catch(async (error) => {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
        const existing = await open(
          join(this.directory, retainedName),
          constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
        );
        try {
          const checked = await hashFile(existing, asset.bytes, signal);
          if (checked.sha256 !== asset.id)
            throw new CatalogError(
              "INVALID_PACKAGE",
              "Existing asset file hash conflicts with package identity",
            );
        } finally {
          await existing.close();
        }
      });
      const directory = await open(this.directory, constants.O_RDONLY);
      try {
        await directory.sync();
      } finally {
        await directory.close();
      }
      signal.throwIfAborted();
      return {
        close,
        publish: () => {
          signal.throwIfAborted();
          const prior = this.store.catalog
            .prepare("SELECT metadata FROM assets WHERE id=?")
            .get(asset.id);
          if (prior) {
            const existing = JSON.parse(prior.metadata as string) as Asset;
            if (existing.fileName !== retainedName)
              throw new CatalogError(
                "STORAGE_BUSY",
                "Asset publication changed during package staging; retry adoption",
                {},
                true,
              );
            if (
              existing.bytes !== asset.bytes ||
              !isDeepStrictEqual(mediaProbeSchema.parse(existing), mediaProbeSchema.parse(asset))
            )
              throw new CatalogError(
                "INVALID_PACKAGE",
                "Existing asset metadata conflicts with package identity",
              );
          } else
            this.store.catalog
              .prepare("INSERT INTO assets(id,metadata) VALUES(?,?)")
              .run(asset.id, JSON.stringify({ ...asset, fileName: retainedName }));
          for (const origin of origins)
            this.store.catalog
              .prepare("INSERT OR IGNORE INTO asset_origins VALUES(?,?)")
              .run(asset.id, JSON.stringify(origin));
          // Closure is validated by the package owner before this transaction starts.
          for (const kind of resourceKinds)
            this.dependencies.retain(
              kind,
              { kind: "asset", id: asset.id },
              dependencies
                .filter((dependency) => dependency.kind === kind)
                .map((dependency) => dependency.id),
            );
        },
      };
    } catch (error) {
      await close();
      throw error;
    }
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
    try {
      const { sha256: id, bytes } = await copyImportedFile(path, staging, signal, expected);
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
      await unlink(staging).catch((error) => {
        if (!absent(error)) throw error;
      });
    }
  }
}

/** Probe times already share the asset origin; preserve occupied gaps without zeroing each stream. */
export function compositionAsset(asset: Asset): CompositionAsset {
  return {
    id: asset.id,
    streams: asset.streams.flatMap((stream): CompositionAsset["streams"] => {
      if (!stream.decodable || stream.kind === "unsupported") return [];
      if (stream.kind === "image")
        return [
          {
            id: stream.id,
            kind: "image",
            width: stream.orientedWidth!,
            height: stream.orientedHeight!,
          },
        ];
      const available: { startUs: number; endUs: number }[] = [];
      for (const segment of [...stream.segments!]
        .filter((s) => !s.empty)
        .sort((a, b) => a.startUs - b.startUs)) {
        const startUs = Math.max(stream.startUs!, segment.startUs),
          endUs = Math.min(stream.endUs!, segment.endUs);
        if (startUs >= endUs) continue;
        const last = available.at(-1);
        if (last && startUs <= last.endUs) last.endUs = Math.max(last.endUs, endUs);
        else available.push({ startUs, endUs });
      }
      return [
        {
          id: stream.id,
          ...(stream.kind === "video"
            ? {
                kind: "video" as const,
                width: stream.orientedWidth!,
                height: stream.orientedHeight!,
                ...(stream.orientedPixelBounds ? { pixelBounds: stream.orientedPixelBounds } : {}),
              }
            : { kind: "audio" as const }),
          bounds: { startUs: stream.startUs!, endUs: stream.endUs! },
          available,
        },
      ];
    }),
  };
}

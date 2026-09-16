import { setImmediate } from "node:timers/promises";
import { randomUUID } from "node:crypto";
import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  mkdirSync,
  openSync,
  opendirSync,
  readSync,
  realpathSync,
  unlinkSync,
} from "node:fs";
import { join } from "node:path";
import { CatalogError, type RevisionStore } from "./library.js";

type Row = {
  id: string;
  recordingId: string;
  bytes: number | null;
  touched: number;
  device: number | null;
  inode: number | null;
};
export type CacheFile = Readonly<{ id: string; path: string; bytes: number }>;
export type CacheRead = Readonly<{
  bytes: number;
  /** Positioned reads leave the shared file offset untouched. */
  read(buffer: Uint8Array, position: number): number;
  release(): void;
}>;
const filename = /^[0-9a-f-]{36}\.cache$/;
const missing = (error: unknown) => (error as NodeJS.ErrnoException).code === "ENOENT";

/** Disposable files only. Publication and LRU accounting share the library catalog; source and
 * retained evidence never enter this directory. One service owns this instance and catalog. */
export class DerivedCache {
  private readonly root: string;
  private ready = false;
  private publication: Promise<unknown> = Promise.resolve();
  private reconciling: Promise<void> | undefined;
  private readonly held = new Map<string, number>();
  private readonly directories: { path: string; dev: number; ino: number }[] = [];
  constructor(
    private readonly store: RevisionStore,
    home: string,
    private readonly budget = 1024 ** 3,
  ) {
    if (!Number.isSafeInteger(budget) || budget < 1) throw new RangeError("Invalid cache budget");
    const columns = store.catalog.prepare("PRAGMA table_info(derived_cache)").all() as {
      name: string;
    }[];
    if (columns.length && !columns.some((column) => column.name === "recordingId"))
      throw new CatalogError(
        "UNSUPPORTED_CATALOG",
        "This library has an unsupported derived cache format",
      );
    const base = realpathSync(home);
    let path = base;
    for (const name of ["cache", "derived"]) {
      path = join(path, name);
      try {
        mkdirSync(path);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      }
      const stat = lstatSync(path);
      if (!stat.isDirectory())
        throw new CatalogError("INVALID_CACHE", "Cache directory must not be a link");
      this.directories.push({ path, dev: stat.dev, ino: stat.ino });
    }
    this.root = path;
    store.catalog.exec(`CREATE TABLE IF NOT EXISTS derived_cache (
      id TEXT PRIMARY KEY, recordingId TEXT NOT NULL REFERENCES recordings(recordingId), bytes INTEGER, touched INTEGER NOT NULL, device INTEGER, inode INTEGER
    ); CREATE INDEX IF NOT EXISTS derived_cache_lru ON derived_cache(touched,id);
    CREATE INDEX IF NOT EXISTS derived_cache_recording ON derived_cache(recordingId,id);`);
  }
  get bytes(): number {
    return (
      this.store.catalog
        .prepare("SELECT COALESCE(SUM(bytes),0) AS bytes FROM derived_cache")
        .get() as { bytes: number }
    ).bytes;
  }
  private checkRoot(): void {
    for (const directory of this.directories) {
      const stat = lstatSync(directory.path);
      if (!stat.isDirectory() || stat.dev !== directory.dev || stat.ino !== directory.ino)
        throw new CatalogError("INVALID_CACHE", "Cache directory changed while in use");
    }
  }
  private path(id: string): string {
    if (!filename.test(`${id}.cache`))
      throw new CatalogError("INVALID_CACHE", "Invalid cache identity");
    return join(this.root, `${id}.cache`);
  }
  private row(id: string): Row | undefined {
    return this.store.catalog.prepare("SELECT * FROM derived_cache WHERE id=?").get(id) as
      | Row
      | undefined;
  }
  private tick(): number {
    return (
      this.store.catalog
        .prepare("SELECT COALESCE(MAX(touched),0)+1 AS value FROM derived_cache")
        .get() as { value: number }
    ).value;
  }
  private requireReady(): void {
    if (!this.ready)
      throw new CatalogError("NOT_READY", "Cache reconciliation is pending", {}, true);
  }
  reserve(recordingId: string): Readonly<{ id: string; path: string }> {
    this.requireReady();
    this.checkRoot();
    this.store.get(recordingId);
    const id = randomUUID();
    this.store.catalog
      .prepare("INSERT INTO derived_cache(id,recordingId,touched) VALUES (?,?,?)")
      .run(id, recordingId, this.tick());
    return { id, path: this.path(id) };
  }
  publish(id: string): Promise<CacheFile> {
    const result = this.publication.then(() => this.admit(id));
    this.publication = result.catch(() => {});
    return result;
  }
  private async admit(id: string): Promise<CacheFile> {
    this.requireReady();
    this.checkRoot();
    const row = this.row(id);
    if (!row) throw new CatalogError("INVALID_CACHE", "No cache reservation exists");
    const path = this.path(id);
    let fd: number | undefined;
    try {
      this.store.get(row.recordingId);
      if (row.bytes !== null) return { id, path, bytes: row.bytes };
      fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
      const stat = fstatSync(fd);
      if (!stat.isFile() || stat.nlink !== 1)
        throw new CatalogError("INVALID_CACHE", "Derivative must be an independent regular file");
      if (stat.size > this.budget)
        throw new CatalogError("LIMIT_EXCEEDED", "Derivative exceeds cache budget");
      await this.makeRoom(stat.size);
      if (!this.row(id)) throw new CatalogError("INVALID_CACHE", "Cache reservation was removed");
      this.store.get(row.recordingId);
      this.store.catalog
        .prepare("UPDATE derived_cache SET bytes=?,device=?,inode=?,touched=? WHERE id=?")
        .run(stat.size, stat.dev, stat.ino, this.tick(), id);
      return { id, path, bytes: stat.size };
    } catch (error) {
      this.removeFile(id);
      throw error;
    } finally {
      if (fd !== undefined) closeSync(fd);
    }
  }
  acquire(id: string): CacheRead | null {
    this.requireReady();
    return this.open(id, true);
  }
  private open(id: string, touch: boolean): CacheRead | null {
    this.checkRoot();
    const row = this.row(id);
    if (!row || row.bytes === null) return null;
    if (touch) this.store.get(row.recordingId);
    let fd: number;
    try {
      fd = openSync(
        this.path(id),
        constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
      );
    } catch (error) {
      if (missing(error) || (error as NodeJS.ErrnoException).code === "ELOOP") {
        this.removeFile(id);
        return null;
      }
      throw error;
    }
    const stat = fstatSync(fd);
    if (
      !stat.isFile() ||
      stat.nlink !== 1 ||
      stat.size !== row.bytes ||
      stat.dev !== row.device ||
      stat.ino !== row.inode
    ) {
      closeSync(fd);
      this.removeFile(id);
      return null;
    }
    if (touch)
      this.store.catalog
        .prepare("UPDATE derived_cache SET touched=? WHERE id=?")
        .run(this.tick(), id);
    this.held.set(id, (this.held.get(id) ?? 0) + 1);
    let released = false;
    return {
      bytes: row.bytes,
      read: (buffer, position) => {
        if (released) throw new CatalogError("INVALID_CACHE", "Cache read has been released");
        if (!Number.isSafeInteger(position) || position < 0)
          throw new RangeError("Invalid read position");
        return readSync(fd, buffer, 0, buffer.byteLength, position);
      },
      release: () => {
        if (released) return;
        released = true;
        closeSync(fd);
        const count = this.held.get(id)! - 1;
        if (count) this.held.set(id, count);
        else this.held.delete(id);
      },
    };
  }
  remove(id: string): void {
    this.requireReady();
    this.removeFile(id);
  }
  /** Call after recording admission is fenced and producers/readers have settled. Publication and
   * purge share one order, so an already-queued admission cannot recreate a removed reservation. */
  purgeRecording(recordingId: string): Promise<void> {
    const result = this.publication.then(async () => {
      this.requireReady();
      for (;;) {
        const rows = this.store.catalog
          .prepare("SELECT id FROM derived_cache WHERE recordingId=? ORDER BY id LIMIT 64")
          .all(recordingId) as { id: string }[];
        if (!rows.length) return;
        for (const row of rows) this.removeFile(row.id);
        await setImmediate();
      }
    });
    this.publication = result.catch(() => {});
    return result;
  }
  private removeFile(id: string): void {
    this.checkRoot();
    if (this.held.has(id))
      throw new CatalogError("CACHE_BUSY", "Derivative is being read", {}, true);
    if (!this.row(id)) return;
    try {
      unlinkSync(this.path(id));
    } catch (error) {
      if (!missing(error)) throw error;
    }
    this.store.catalog.prepare("DELETE FROM derived_cache WHERE id=?").run(id);
  }
  private async makeRoom(extra: number): Promise<void> {
    let touched = -1,
      id = "";
    let work = 0;
    let bytes = this.bytes;
    const cutoff = this.tick();
    while (bytes + extra > this.budget) {
      const row = this.store.catalog
        .prepare(`SELECT * FROM derived_cache WHERE bytes IS NOT NULL
        AND touched<? AND (touched>? OR (touched=? AND id>?)) ORDER BY touched,id LIMIT 1`)
        .get(cutoff, touched, touched, id) as Row | undefined;
      if (!row)
        throw new CatalogError("CACHE_BUSY", "Cache budget is held by active readers", {}, true);
      touched = row.touched;
      id = row.id;
      if (!this.held.has(id)) {
        this.removeFile(id);
        bytes -= row.bytes!;
      }
      if (++work % 64 === 0) {
        await setImmediate();
        bytes = this.bytes;
      }
    }
  }
  /** Startup runs before producers/readers. Keyset iteration and directory streaming keep memory
   * independent of cache size; interrupted reservations and untracked derivative files are disposable. */
  reconcile(signal?: AbortSignal): Promise<void> {
    if (this.ready) return Promise.resolve();
    if (this.reconciling) return this.reconciling;
    this.reconciling = this.scan(signal).finally(() => {
      this.reconciling = undefined;
    });
    return this.reconciling;
  }
  private async scan(signal?: AbortSignal): Promise<void> {
    let work = 0;
    const checkpoint = async () => {
      signal?.throwIfAborted();
      if (++work % 64 === 0) await setImmediate(undefined, { signal });
    };
    let after = "";
    for (;;) {
      await checkpoint();
      const row = this.store.catalog
        .prepare("SELECT * FROM derived_cache WHERE id>? ORDER BY id LIMIT 1")
        .get(after) as Row | undefined;
      if (!row) break;
      after = row.id;
      if (row.bytes === null) this.removeFile(row.id);
      else this.open(row.id, false)?.release();
    }
    this.checkRoot();
    const directory = opendirSync(this.root);
    try {
      for (let entry = directory.readSync(); entry; entry = directory.readSync()) {
        await checkpoint();
        this.checkRoot();
        if (filename.test(entry.name) && !this.row(entry.name.slice(0, -6)))
          unlinkSync(join(this.root, entry.name));
      }
    } finally {
      directory.closeSync();
    }
    // A lowered budget may require many evictions after restart; yield between each one.
    let bytes = this.bytes;
    while (bytes > this.budget) {
      await checkpoint();
      const row = this.store.catalog
        .prepare("SELECT * FROM derived_cache WHERE bytes IS NOT NULL ORDER BY touched,id LIMIT 1")
        .get() as Row;
      this.removeFile(row.id);
      bytes -= row.bytes!;
    }
    signal?.throwIfAborted();
    this.ready = true;
  }
}

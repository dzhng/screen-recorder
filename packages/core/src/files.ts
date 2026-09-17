import { closeSync, constants, fstatSync, openSync, type BigIntStats } from "node:fs";
import { join } from "node:path";
import { CatalogError } from "./library.js";

export type OpenedFile = { readonly fd: number; close(): void };
export type FileAccess = {
  path(file: string): string;
  open(file: string): OpenedFile;
  check(): void;
};
export type FileIdentity = { device: string; inode: string; modifiedNs: string; changedNs: string };
export type IdentifiedFile = { path: string; bytes: number; identity: FileIdentity };
export function fileIdentity(stat: BigIntStats): FileIdentity {
  return {
    device: String(stat.dev),
    inode: String(stat.ino),
    modifiedNs: String(stat.mtimeNs),
    changedNs: String(stat.ctimeNs),
  };
}
export function openedFile(fd: number, onClose = () => {}): OpenedFile {
  let closed = false;
  return {
    get fd() {
      if (closed) throw new CatalogError("CONTEXT_CLOSED", "File read has been closed");
      return fd;
    },
    close() {
      if (closed) return;
      closed = true;
      try {
        closeSync(fd);
      } finally {
        onClose();
      }
    },
  };
}
/** Trusted library/fixture directories retain their existing leaf-check contract. */
export function fileAccess(root: string | FileAccess): FileAccess {
  if (typeof root !== "string") return root;
  return {
    check: () => {},
    path: (file) => join(root, file),
    open: (file) =>
      openedFile(
        openSync(
          join(root, file),
          constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
        ),
      ),
  };
}
export function fileSubdirectory(files: FileAccess, directory: string): FileAccess {
  return {
    check: () => files.check(),
    path: (file) => files.path(`${directory}/${file}`),
    open: (file) => files.open(`${directory}/${file}`),
  };
}

/** Local extraction identities are authority; paths are only locators, checked before consuming bytes. */
export class IdentifiedFiles implements FileAccess {
  private readonly entries = new Map<string, IdentifiedFile>();
  private readonly leases = new Map<OpenedFile, string>();
  private closed = false;
  private accepting = true;
  constructor(
    private readonly root: string,
    entries: readonly IdentifiedFile[],
    private readonly maximumOpen = 32,
  ) {
    if (process.platform !== "darwin")
      throw new CatalogError(
        "UNSUPPORTED_PLATFORM",
        "Retained packages require macOS file admission",
      );
    for (const entry of entries) this.add(entry);
  }
  add(entry: IdentifiedFile): void {
    if (this.closed) throw new CatalogError("CONTEXT_CLOSED", "Package is closed");
    if (
      !/^[A-Za-z0-9_./-]+$/.test(entry.path) ||
      entry.path.split("/").some((part) => !part || part === "." || part === "..") ||
      this.entries.has(entry.path)
    )
      throw new CatalogError("INVALID_PACKAGE", "Invalid or repeated local file identity");
    this.entries.set(entry.path, entry);
  }
  stop(): void {
    this.accepting = false;
  }
  check(): void {
    if (!this.accepting || this.closed)
      throw new CatalogError("CONTEXT_CLOSED", "Package is closed");
  }
  path(file: string): string {
    return join(this.root, file);
  }
  open(file: string, writable = false, onClose = () => {}): OpenedFile {
    this.check();
    const expected = this.entries.get(file);
    if (!expected) throw new CatalogError("NOT_FOUND", "File is not admitted to this package");
    if (this.leases.size >= this.maximumOpen)
      throw new CatalogError("LIMIT_EXCEEDED", "Package open-file limit exceeded", {}, true);
    // Darwin SDK sys/fcntl.h: O_NOFOLLOW_ANY is stable ABI but Node omits the named constant.
    const fd = openSync(
      this.path(file),
      (writable ? constants.O_RDWR : constants.O_RDONLY) | constants.O_NONBLOCK | 0x20000000,
    );
    try {
      const stat = fstatSync(fd, { bigint: true }),
        actual = fileIdentity(stat);
      if (
        !stat.isFile() ||
        stat.nlink !== 1n ||
        stat.size !== BigInt(expected.bytes) ||
        actual.device !== expected.identity.device ||
        actual.inode !== expected.identity.inode ||
        actual.modifiedNs !== expected.identity.modifiedNs ||
        actual.changedNs !== expected.identity.changedNs
      )
        throw new CatalogError("INVALID_STORAGE", "Package member changed after extraction");
      const lease = openedFile(fd, () => {
        this.leases.delete(lease);
        onClose();
      });
      this.leases.set(lease, file);
      return lease;
    } catch (error) {
      closeSync(fd);
      throw error;
    }
  }
  refresh(file: string, lease: OpenedFile): IdentifiedFile {
    const previous = this.entries.get(file),
      stat = fstatSync(lease.fd, { bigint: true });
    if (
      !previous ||
      !stat.isFile() ||
      stat.nlink !== 1n ||
      String(stat.dev) !== previous.identity.device ||
      String(stat.ino) !== previous.identity.inode ||
      stat.size > BigInt(Number.MAX_SAFE_INTEGER)
    )
      throw new CatalogError("INVALID_STORAGE", "Output identity changed while writing");
    const entry = { path: file, bytes: Number(stat.size), identity: fileIdentity(stat) };
    this.entries.set(file, entry);
    return entry;
  }
  forget(file: string): void {
    if ([...this.leases.values()].includes(file))
      throw new CatalogError("PROCESSING_BUSY", "File still has active reads");
    this.entries.delete(file);
  }
  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.stop();
    const failures: unknown[] = [];
    for (const lease of this.leases.keys()) {
      try {
        lease.close();
      } catch (error) {
        failures.push(error);
      }
    }
    if (failures.length) throw new AggregateError(failures, "Package file closure failed");
  }
}

import { DatabaseSync } from "node:sqlite";
/**
 * The persisted contract shared by catalog owners. Additive tables are created idempotently.
 * Changes to existing shapes or required ownership records need a bump: old catalogs cannot
 * reconstruct missing semantic inputs and are refused, never migrated.
 */
export const catalogFormat = 26;
export class CatalogError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly details: Record<string, unknown> = {},
    readonly retryable = false,
  ) {
    super(message);
  }
}

/** One SQLite connection and transaction boundary, shared by the library owners. */
export class Catalog {
  readonly catalog: DatabaseSync;
  constructor(path: string, busyTimeoutMs = 1000) {
    if (!Number.isSafeInteger(busyTimeoutMs) || busyTimeoutMs < 0 || busyTimeoutMs > 10000)
      throw new RangeError("SQLite timeout must be 0–10000 milliseconds");
    this.catalog = new DatabaseSync(path, { timeout: busyTimeoutMs });
    const { user_version: format } = this.catalog.prepare("PRAGMA user_version").get() as {
      user_version: number;
    };
    if (format === 0 && !this.catalog.prepare("SELECT 1 FROM sqlite_master LIMIT 1").get())
      this.catalog.exec(`PRAGMA user_version=${catalogFormat}`);
    else if (format !== catalogFormat) {
      this.catalog.close();
      throw new CatalogError(
        "UNSUPPORTED_CATALOG",
        "This catalog was written in another format; open a library created by this version.",
        { format, supportedFormat: catalogFormat },
      );
    }
  }
  close(): void {
    if (this.catalog.isOpen) this.catalog.close();
  }
  /** One immediate transaction for writes that must land together, reporting a lock wait as retryable. */
  transaction<T>(run: () => T): T {
    let began = false;
    try {
      this.catalog.exec("BEGIN IMMEDIATE");
      began = true;
      const result = run();
      this.catalog.exec("COMMIT");
      return result;
    } catch (error) {
      if (began) this.catalog.exec("ROLLBACK");
      if (error && typeof error === "object" && "errcode" in error && error.errcode === 5)
        throw new CatalogError("STORAGE_BUSY", "Catalog is locked; retry the request", {}, true);
      throw error;
    }
  }
}

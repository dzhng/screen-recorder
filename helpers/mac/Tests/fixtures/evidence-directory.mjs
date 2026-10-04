import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** The parent owns anonymous output even when the native child aborts. */
export function withEvidenceDirectory(key, run) {
  const supplied = process.env[key];
  const directory = supplied ?? mkdtempSync(join(tmpdir(), "screenrec-test-"));
  try {
    return run({ ...process.env, [key]: directory });
  } finally {
    if (supplied === undefined) rmSync(directory, { recursive: true, force: true });
  }
}

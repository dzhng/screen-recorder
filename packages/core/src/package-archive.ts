import { createHash } from "node:crypto";
import { z } from "zod";
import { CatalogError } from "./library.js";
import { validateManifest } from "./package-manifest.js";

/** Limits apply to observed bytes and names, independently of ZIP header declarations. */
export const archiveLimits = {
  compressedBytes: 16 * 1024 ** 3,
  expandedBytes: 16 * 1024 ** 3,
  memberBytes: 8 * 1024 ** 3,
  entries: 25_000,
  pathBytes: 512,
  componentBytes: 128,
  depth: 16,
  manifestBytes: 2 * 1024 ** 2,
  revisionBytes: 1024 ** 2,
  history: 1_000,
  initialReadBytes: 8 * 1024 ** 2,
  receiptBytes: 7 * 1024 ** 2,
};
export type ArchiveLimits = typeof archiveLimits;
const integer = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const localIdentity = z.strictObject({
  device: z.string().regex(/^\d{1,20}$/),
  inode: z.string().regex(/^\d{1,20}$/),
  modifiedNs: z.string().regex(/^\d{1,20}$/),
  changedNs: z.string().regex(/^\d{1,20}$/),
});
const memberSchema = z.strictObject({
  path: z.string(),
  directory: z.boolean(),
  bytes: integer,
  sha256: digest,
  identity: localIdentity.nullable(),
});
const receiptSchema = z.strictObject({
  manifest: z.string(),
  revisions: z.record(z.string(), z.string()),
  members: z.array(memberSchema),
  archiveSha256: digest,
  expandedBytes: integer,
  copiedBytes: integer,
  initialReadBytes: integer,
  peakResidentBytes: integer,
  parser: z.string(),
});

export function validateArchiveLimits(limits: ArchiveLimits): void {
  for (const key of Object.keys(archiveLimits) as (keyof ArchiveLimits)[])
    if (!Number.isSafeInteger(limits[key]) || limits[key] < 1 || limits[key] > archiveLimits[key])
      throw new RangeError(
        `Archive ${key} must be a positive integer within the supported maximum`,
      );
}

/** The native owner supplies fully enumerated, hashed bytes; this owner checks their package meaning. */
export function verifyArchiveReceipt(value: unknown, limits: ArchiveLimits = archiveLimits) {
  validateArchiveLimits(limits);
  const parsed = receiptSchema.safeParse(value);
  const invalid = (message: string): never => {
    throw new CatalogError("INVALID_PACKAGE", message);
  };
  if (!parsed.success) return invalid("Invalid native archive receipt");
  const receipt = parsed.data;
  if (
    Buffer.byteLength(JSON.stringify(receipt)) > limits.receiptBytes ||
    receipt.members.length > limits.entries ||
    receipt.expandedBytes > limits.expandedBytes ||
    receipt.copiedBytes < 1 ||
    receipt.copiedBytes > limits.compressedBytes ||
    receipt.initialReadBytes > limits.initialReadBytes
  )
    return invalid("Archive receipt exceeds its limits");
  const manifest = validateManifest(
    receipt.manifest,
    new Map(Object.entries(receipt.revisions)),
    limits,
  );
  const expected = new Map(manifest.inventory.map((entry) => [entry.path, entry]));
  const actual = new Map<string, z.infer<typeof memberSchema>>();
  const folded = new Map<string, string>();
  let total = 0;
  for (const entry of receipt.members) {
    const parts = entry.path.split("/");
    if (
      !/^[A-Za-z0-9_./-]+$/.test(entry.path) ||
      parts.some((p) => !p || p === "." || p === "..") ||
      parts.some((p) => p.length > limits.componentBytes) ||
      parts.length > limits.depth ||
      entry.path.length > limits.pathBytes ||
      folded.has(entry.path.toLowerCase()) ||
      entry.bytes > limits.memberBytes ||
      (entry.directory && entry.bytes !== 0) ||
      (entry.directory ? entry.identity !== null : entry.identity === null)
    )
      return invalid("Invalid or duplicate extracted member");
    folded.set(entry.path.toLowerCase(), entry.path);
    actual.set(entry.path, entry);
    total += entry.bytes;
    if (!Number.isSafeInteger(total)) return invalid("Archive byte total is unsafe");
  }
  if (total !== receipt.expandedBytes) return invalid("Archive byte total mismatch");
  const checkText = (path: string, text: string) => {
    const entry = actual.get(path);
    if (
      !entry ||
      entry.directory ||
      entry.bytes !== Buffer.byteLength(text) ||
      entry.sha256 !== createHash("sha256").update(text).digest("hex")
    )
      return invalid("Archive metadata bytes do not match their inventory");
  };
  checkText("manifest.json", receipt.manifest);
  for (const [path, text] of Object.entries(receipt.revisions)) checkText(path, text);
  const requiredDirectories = new Set<string>();
  for (const entry of manifest.inventory) {
    const member = actual.get(entry.path);
    if (
      !member ||
      member.directory ||
      member.bytes !== entry.bytes ||
      member.sha256 !== entry.sha256
    )
      return invalid("Missing member or inventory hash/size mismatch");
    const parts = entry.path.split("/");
    for (let i = 1; i < parts.length; i++) requiredDirectories.add(parts.slice(0, i).join("/"));
  }
  for (const member of actual.values()) {
    if (
      member.directory
        ? !requiredDirectories.has(member.path)
        : member.path !== "manifest.json" && !expected.has(member.path)
    )
      return invalid("Unlisted archive member");
    const parts = member.path.split("/");
    for (let i = 1; i < parts.length; i++) {
      const ancestor = actual.get(folded.get(parts.slice(0, i).join("/").toLowerCase()) ?? "");
      if (ancestor && (!ancestor.directory || ancestor.path !== parts.slice(0, i).join("/")))
        return invalid("Archive file/directory collision");
    }
  }
  return {
    manifest,
    files: receipt.members
      .filter((entry) => !entry.directory)
      .map((entry) => ({
        path: `content/${entry.path}`,
        bytes: entry.bytes,
        identity: entry.identity!,
      })),
    revisionContents: receipt.revisions,
    archiveSha256: receipt.archiveSha256,
    copiedBytes: receipt.copiedBytes,
    expandedBytes: total,
    memberCount: actual.size,
    parser: receipt.parser,
    initialReadBytes: receipt.initialReadBytes,
    peakResidentBytes: receipt.peakResidentBytes,
  };
}

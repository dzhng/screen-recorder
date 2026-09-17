import { constants, fstatSync, openSync } from "node:fs";
import { CatalogError } from "@screenrec/core/library";
import {
  openedFile,
  type OpenedFile,
  type FileIdentity,
  fileIdentity,
} from "@screenrec/core/files";
import { archiveLimits } from "@screenrec/core/package-archive";

export type AdmittedArchive = OpenedFile &
  Readonly<{
    bytes: number;
    identity: Readonly<Omit<FileIdentity, "changedNs">>;
  }>;
/** Pin the object before queue admission; native copying later creates the immutable snapshot. */
export function admitArchive(path: string): AdmittedArchive {
  if (process.platform !== "darwin")
    throw new CatalogError("UNSUPPORTED_PLATFORM", "Archive admission requires macOS");
  const file = openedFile(openSync(path, constants.O_RDONLY | constants.O_NONBLOCK | 0x20000000));
  try {
    const stat = fstatSync(file.fd, { bigint: true });
    if (!stat.isFile() || stat.size < 1n || stat.size > BigInt(archiveLimits.compressedBytes))
      throw new CatalogError("INVALID_PACKAGE", "Archive must be a bounded regular file");
    const { device, inode, modifiedNs } = fileIdentity(stat);
    return Object.freeze({
      get fd() {
        return file.fd;
      },
      close: () => file.close(),
      bytes: Number(stat.size),
      identity: Object.freeze({ device, inode, modifiedNs }),
    });
  } catch (error) {
    file.close();
    throw error;
  }
}

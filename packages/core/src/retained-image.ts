import { constants, fstatSync, openSync, readSync } from "node:fs";
import { openedFile, type OpenedFile } from "./files.js";
import { CatalogError } from "./library.js";
import type { MaterializedFrame } from "./frame-materialization.js";
const integer = (n: number) => Number.isSafeInteger(n) && n >= 0;
function invalid(message: string): never {
  throw new CatalogError("INVALID_EVIDENCE", message);
}
export function openRetainedImage(
  input: string | OpenedFile,
  frame: Pick<MaterializedFrame, "bytes" | "mediaType" | "width" | "height">,
  expected?: { device: number; inode: number; modified: number },
) {
  const file =
    typeof input === "string"
      ? openedFile(
          openSync(input, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK),
        )
      : input;
  const fd = file.fd;
  try {
    const stat = fstatSync(fd);
    if (
      !stat.isFile() ||
      stat.nlink !== 1 ||
      stat.size !== frame.bytes ||
      stat.size < 33 ||
      stat.size > 32 * 1024 * 1024 ||
      frame.mediaType !== "image/png"
    )
      invalid("Invalid retained PNG file or byte receipt");
    if (
      expected &&
      (stat.dev !== expected.device ||
        stat.ino !== expected.inode ||
        stat.mtimeMs !== expected.modified)
    )
      invalid("Retained image changed after admission");
    const header = Buffer.alloc(24);
    readSync(fd, header, 0, 24, 0);
    if (
      !header.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ||
      header.toString("ascii", 12, 16) !== "IHDR" ||
      header.readUInt32BE(16) !== frame.width ||
      header.readUInt32BE(20) !== frame.height
    )
      invalid("Retained PNG does not match dimensions");
    return { file, stat };
  } catch (error) {
    file.close();
    throw error;
  }
}

export function retainedImageRead(file: OpenedFile, bytes: number) {
  let released = false;
  return {
    bytes,
    read(buffer: Uint8Array, position: number): number {
      if (released) invalid("Selected image read has been released");
      if (!integer(position) || position > bytes) invalid("Invalid selected image read position");
      return readSync(file.fd, buffer, 0, Math.min(buffer.length, bytes - position), position);
    },
    release() {
      if (!released) {
        released = true;
        file.close();
      }
    },
  };
}

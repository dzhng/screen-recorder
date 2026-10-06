import { execFileSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Compile the real private CLI owner without building capture, codecs or the app. */
export async function compileCliOwner(directory: string): Promise<string> {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
  const owner = join(directory, "owner");
  const main = join(directory, "main.swift");
  await writeFile(
    main,
    "import Foundation\nCommandWorker.run(Array(CommandLine.arguments.dropFirst()))\n",
  );
  execFileSync("/usr/bin/xcrun", [
    "swiftc",
    "-module-cache-path",
    join(directory, "swift-cache"),
    "-emit-library",
    "-emit-module",
    "-module-name",
    "YapMedia",
    join(root, "helpers/mac/Sources/YapMedia/ExclusiveFile.swift"),
    "-emit-module-path",
    join(directory, "YapMedia.swiftmodule"),
    "-o",
    join(directory, "libYapMedia.dylib"),
  ]);
  execFileSync("/usr/bin/xcrun", [
    "swiftc",
    "-I",
    directory,
    "-L",
    directory,
    "-lYapMedia",
    "-Xlinker",
    "-rpath",
    "-Xlinker",
    directory,
    "-module-cache-path",
    join(directory, "swift-cache"),
    join(root, "helpers/mac/Sources/YapNative/ParentLifetime.swift"),
    join(root, "helpers/mac/Sources/YapNative/CommandWorker.swift"),
    main,
    "-o",
    owner,
  ]);
  return owner;
}

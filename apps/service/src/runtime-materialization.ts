import { createHash } from "node:crypto";
import { chmod, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { CatalogError } from "@yap/core/catalog";
import type { RuntimeMaterializer } from "@yap/core/models";
import { cliWorker, nativeResult } from "./worker.js";

/** Preparation owns inputs/staging; this adapter supplies the shared descendant lifetime. */
export function runtimeMaterializer(
  ownerExecutable: string | undefined,
): RuntimeMaterializer | undefined {
  if (!ownerExecutable) return;
  return async ({ inputs, directory, acquisition, signal }) => {
    const base = join(inputs, "interpreter"),
      scripts = join(inputs, "scripts");
    await mkdir(base, { mode: 0o700 });
    await mkdir(scripts, { mode: 0o700 });
    for (const resource of acquisition.resources) {
      if (createHash("sha256").update(resource.content).digest("hex") !== resource.sha256)
        throw new CatalogError(
          "INVALID_MODEL",
          "Registered runtime assembly resource differs from its pin",
        );
      await writeFile(join(scripts, resource.path), resource.content, { flag: "wx", mode: 0o644 });
      await chmod(join(scripts, resource.path), 0o644);
    }
    nativeResult(
      await cliWorker(
        {
          executable: "/bin/sh",
          ownerExecutable,
          args: [
            "-c",
            'umask 022; exec /usr/bin/tar "$@"',
            "yap-runtime-tar",
            "-xzpf",
            join(inputs, acquisition.interpreterArchive),
            "-C",
            base,
            "--strip-components",
            "1",
          ],
        },
        { signal, timeoutMs: 120000, maxBytes: 65536 },
      ),
    );
    const request = join(inputs, "preparation.json");
    await writeFile(request, JSON.stringify({ inputs, base, directory, acquisition }), {
      flag: "wx",
      mode: 0o600,
    });
    const result = nativeResult(
      await cliWorker(
        {
          executable: "/usr/bin/sandbox-exec",
          ownerExecutable,
          args: [
            "-p",
            "(version 1)(allow default)(deny network*)",
            join(base, "bin/python3.12"),
            "-I",
            "-B",
            join(scripts, "prepare.py"),
            request,
          ],
        },
        { signal, timeoutMs: 600000, output: "json", maxBytes: 65536 },
      ),
    ) as { output?: { ready?: boolean } };
    if (result.output?.ready !== true)
      throw new CatalogError(
        "MODEL_RUNTIME_EXTRACTION_FAILED",
        "Runtime assembly produced no completion evidence",
      );
  };
}

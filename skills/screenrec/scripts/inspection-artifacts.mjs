import { open } from "node:fs/promises";
import { createCli } from "./screenrec-cli.mjs";

export const failure = (code, message) => Object.assign(new Error(message), { code });
export function budget(value, fallback, min, max, name) {
  const result = value ?? fallback;
  if (!Number.isSafeInteger(result) || result < min || result > max)
    throw failure("INVALID_REQUEST", `${name} is outside its supported range`);
  return result;
}
/** Read only a CLI-delivered task file, never an internal cache receipt path. */
export async function readOutput(path, maxBytes) {
  if (typeof path !== "string")
    throw failure("INVALID_RESPONSE", "Ready evidence has no CLI output file");
  const file = await open(path, "r");
  try {
    const stat = await file.stat();
    if (!stat.isFile() || stat.size > maxBytes)
      throw failure("OUTPUT_BUDGET_EXCEEDED", "Delivered evidence exceeds its byte budget");
    const result = Buffer.alloc(stat.size);
    let offset = 0;
    while (offset < result.length) {
      const { bytesRead } = await file.read(result, offset, result.length - offset, offset);
      if (!bytesRead)
        throw failure("ARTIFACT_CHANGED", "Delivered file ended before its declared size");
      offset += bytesRead;
    }
    return result;
  } finally {
    await file.close();
  }
}
export async function runJsonHelper(helper) {
  try {
    const chunks = [];
    let bytes = 0;
    for await (const chunk of process.stdin) {
      bytes += chunk.length;
      if (bytes > 1024 * 1024) throw failure("INVALID_REQUEST", "Request exceeds 1 MiB");
      chunks.push(chunk);
    }
    const request = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    console.log(JSON.stringify(await helper(request, createCli(request.cli))));
  } catch (error) {
    console.error(
      JSON.stringify({ error: { code: error.code ?? "INVALID_REQUEST", message: error.message } }),
    );
    process.exitCode = 1;
  }
}

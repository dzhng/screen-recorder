import { mkdtemp, readFile, readdir, rm, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "vitest";
import { nativeResult, preparedModelWorker } from "./worker.js";

test("prepared model execution writes compiler cache outside its immutable runtime", async () => {
  const home = await mkdtemp("/tmp/yap-prepared-worker-");
  try {
    const runtime = join(home, "runtime"),
      cache = join(home, "cache");
    await mkdir(runtime);
    await mkdir(cache);
    const entry = join(runtime, "worker.py");
    await writeFile(
      entry,
      `import json, os
from pathlib import Path
request = json.loads(input())
cache = Path(os.environ.get("NUMBA_CACHE_DIR", str(Path(__file__).parent / "__pycache__")))
cache.mkdir(exist_ok=True)
cached = cache / "compiled-input"
previous = cached.read_text() if cached.exists() else None
cached.write_text(request["params"]["input"])
print(json.dumps({"ok": True, "data": {"previous": previous}}))
`,
    );
    const worker = preparedModelWorker(
      {
        python: "/usr/bin/python3",
        entry,
        model: home,
        cache,
        descriptorDigest: "a",
        runtimeDigest: "b",
        modelDigest: "c",
        runtimeRevision: "d",
        modelRevision: "e",
      },
      5000,
    );
    expect(nativeResult(await worker("observe", { input: "bounded input" }))).toEqual({
      previous: null,
    });
    expect(await readdir(runtime)).toEqual(["worker.py"]);
    expect(await readFile(join(cache, "compiled-input"), "utf8")).toBe("bounded input");
    expect(nativeResult(await worker("observe", { input: "bounded input" }))).toEqual({
      previous: "bounded input",
    });
    expect(await readdir(runtime)).toEqual(["worker.py"]);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

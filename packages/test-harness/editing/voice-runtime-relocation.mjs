import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, open, readFile, readdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { parseArgs } from "node:util";
import { withRenderedFile } from "../../../apps/service/dist/render.js";
import { voiceEntryPins } from "../../../apps/service/dist/voice-pins.js";
import { jsonWorker, nativeResult, mediaWorker } from "../../../apps/service/dist/worker.js";

const { values } = parseArgs({
  options: Object.fromEntries(
    ["bundle", "model", "native", "out", "profile", "assembly"].map((name) => [
      name,
      { type: "string" },
    ]),
  ),
});
for (const key of ["bundle", "model", "native", "out", "profile", "assembly"])
  assert(values[key], `Missing --${key}`);
const bundle = resolve(values.bundle),
  out = resolve(values.out);
await mkdir(out, { mode: 0o700 });
const cache = join(out, "cache");
await mkdir(cache, { mode: 0o700 });
const root = new URL("../../../", import.meta.url).pathname;
const frozen = join(root, "specs/agent-editing/assets/18-voice");
const cases = JSON.parse(
  await readFile(join(root, "packages/test-harness/editing/voice/cases.json")),
);
const workspace = join(out, "workspace");
const preparation = {
  python: join(bundle, "python/bin/python"),
  entry: join(bundle, "voice/worker.py"),
  model: resolve(values.model),
  cache,
};
const hash = (data) => createHash("sha256").update(data).digest("hex");
for (const [path, pin] of [
  [preparation.python, voiceEntryPins.python],
  [preparation.entry, voiceEntryPins.entry],
  [join(bundle, "voice/pins.json"), voiceEntryPins.pins],
]) {
  const bytes = await readFile(path);
  assert.equal(bytes.length, pin.bytes);
  assert.equal(hash(bytes), pin.sha256);
}
const profileContents = await readFile(resolve(values.profile), "utf8");
const profilePath = join(out, "effective.sb");
await writeFile(profilePath, profileContents, { flag: "wx" });
const assembly = JSON.parse(await readFile(resolve(values.assembly), "utf8"));
const donorFiles = [
  join(assembly.sourceRoots.base, "bin/python3.12"),
  join(assembly.sourceRoots.venv, "pyvenv.cfg"),
  join(assembly.sourceRoots.venv, "lib/python3.12/site-packages/mlx_audio/tts/utils.py"),
];
const native = mediaWorker({ SCREENREC_NATIVE: resolve(values.native) });
const voice = jsonWorker(
  {
    executable: "/usr/bin/sandbox-exec",
    args: ["-f", profilePath, preparation.python, "-I", "-B", preparation.entry],
    environment: {
      ...process.env,
      HF_HOME: cache,
      HF_HUB_OFFLINE: "1",
      TRANSFORMERS_OFFLINE: "1",
      HF_HUB_DISABLE_IMPLICIT_TOKEN: "1",
      TOKENIZERS_PARALLELISM: "false",
    },
  },
  600000,
);
const worker = (operation, params, options) =>
  (operation === "voice.generatePrivate" ? voice : native)(operation, params, options);
const generate = (request, signal) =>
  withRenderedFile(
    worker,
    { attemptParent: workspace, output: request.output, filename: "audio.wav" },
    signal,
    async (output, execute) =>
      nativeResult(
        await execute(
          "voice.generatePrivate",
          { ...request, model: preparation.model, output },
          { signal },
        ),
      ),
  );
const report = {
  passed: false,
  scope:
    "Two private-entry fresh processes under one combined donor/network sandbox using the shared JSON/render owners; no cold-cache, public readiness or quality claim",
  preparation,
  profileContents,
  profileSha256: hash(Buffer.from(profileContents)),
  donorFiles,
  runs: [],
};
try {
  for (const path of donorFiles) {
    const source = await open(path, "r");
    try {
      assert.equal(
        (await source.read(Buffer.alloc(1), 0, 1, 0)).bytesRead,
        1,
        "Donor control must be readable without denial",
      );
    } finally {
      await source.close();
    }
  }
  const probe = jsonWorker(
    {
      executable: "/usr/bin/sandbox-exec",
      args: [
        "-f",
        profilePath,
        preparation.python,
        "-I",
        "-B",
        "-c",
        `
import errno,json,socket,sys
paths=json.loads(sys.stdin.readline())["params"]["paths"]
results=[]
for path in paths:
    try:
        with open(path,"rb") as f: f.read(1)
        results.append({"path":path,"denied":False})
    except OSError as e:
        results.append({"path":path,"denied":e.errno in [errno.EPERM,errno.EACCES],"errno":e.errno})
s=socket.socket()
network=False
try: s.bind(("127.0.0.1",0))
except OSError as e: network=e.errno in [errno.EPERM,errno.EACCES]
finally: s.close()
print(json.dumps({"ok":True,"data":{"files":results,"networkDenied":network}}),flush=True)
`,
      ],
    },
    30000,
  );
  report.denial = nativeResult(await probe("runtime.denial", { paths: donorFiles }));
  assert(
    report.denial.networkDenied && report.denial.files.every((x) => x.denied),
    "Profile must deny every actual donor and networking before generation",
  );
  for (const replacement of cases.replacements) {
    const output = join(out, replacement.id + ".wav");
    const receipt = await generate(
      {
        reference: join(frozen, "reference.wav"),
        referenceText: cases.reference.text,
        text: replacement.text,
        generation: cases.generation,
        seed: cases.seed,
        output,
      },
      new AbortController().signal,
    );
    const actual = await readFile(output),
      expected = await readFile(join(frozen, `same-take-${replacement.id}.wav`));
    assert.deepEqual(actual, expected);
    assert.deepEqual(await readdir(workspace), []);
    report.runs.push({
      id: replacement.id,
      exactWAVAndPCM: true,
      bytes: actual.length,
      sha256: hash(actual),
      receipt,
    });
  }
  report.passed = true;
} catch (error) {
  report.failure = { message: error.message, stack: error.stack };
  throw error;
} finally {
  await writeFile(join(out, "report.json"), JSON.stringify(report, null, 2) + "\n");
}

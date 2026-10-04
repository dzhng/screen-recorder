import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { JourneyService, poll, hash, root } from "./source-evidence-fixture.mjs";
import { CaptureStore } from "../../core/dist/capture-store.js";

// The desktop control peer is idle; recovery and all public requests use the actual service/native owners.
if (process.send) {
  const child = spawn(process.execPath, [join(root, "apps/service/dist/main.js")], {
    env: { ...process.env, SCREENREC_HOME: process.argv[2] },
    stdio: ["pipe", "pipe", "pipe"],
  });
  child.stderr.pipe(process.stderr);
  createInterface({ input: child.stdout }).on("line", (line) => {
    const message = JSON.parse(line);
    if (message.event === "started") process.send({ socketPath: message.socketPath });
    else if (message.event === "call")
      child.stdin.write(
        JSON.stringify({
          event: "result",
          response: {
            id: message.request.id,
            ok: true,
            data: {
              state: "idle",
              recordingId: null,
              sourceId: null,
              elapsedUs: null,
              selection: null,
              permissions: { screen: true, microphone: "authorized", camera: "not_determined" },
            },
          },
        }) + "\n",
      );
  });
  process.on("message", (message) => {
    if (message === "close") child.kill("SIGTERM");
  });
  process.on("disconnect", () => child.kill("SIGTERM"));
  child.on("exit", () => {
    if (process.connected) process.disconnect();
  });
} else {
  assert.ok(process.argv[2], "Pass the output of SCREENREC_NATIVE_PUBLICATION_OUTPUT");
  const output = await mkdtemp("/tmp/screenrec-terminal-boundaries-");
  const scratch = await mkdtemp("/tmp/screenrec-terminal-library-");
  const report = { passed: false, cases: [], trace: [] };
  try {
    for (const boundary of ["absent-terminal", "torn-terminal"]) {
      const donor = join(process.argv[2], boundary);
      const journal = await readFile(join(donor, "capture.journal.jsonl"));
      const header = JSON.parse(journal.toString().split("\n")[0]).data;
      const home = join(scratch, boundary);
      await mkdir(home, { mode: 0o700 });
      let ids = 0;
      await mkdir(join(home, "library"), { recursive: true, mode: 0o700 });
      const store = new CaptureStore(join(home, "library", "catalog.sqlite"), {
        now: () => new Date().toISOString(),
        newId: () => (++ids === 2 ? header.sessionID : randomUUID()),
      });
      const recording = store.allocate().recording;
      store.close();
      const source = join(home, "library", "recordings", recording.recordingId, "source");
      await cp(donor, source, { recursive: true });
      const names = [
        "capture.journal.jsonl",
        "video.mov",
        "narration.mov",
        "system.mov",
        "narration.publication.json",
        "system.publication.json",
      ];
      const digests = async () =>
        Object.fromEntries(
          await Promise.all(
            names.map(async (name) => [name, hash(await readFile(join(source, name)))]),
          ),
        );
      const before = await digests();
      const service = new JourneyService(home, report, undefined, new URL(import.meta.url));
      try {
        await service.start();
        const settled = await poll(
          () => service.call("recording.get", { recordingId: recording.recordingId }),
          (value) => value.state === "interrupted",
          "terminal recovery",
        );
        assert.equal(settled.interruptionReason, "CAPTURE_INTERRUPTED");
        assert.equal(settled.interruptionMessage, null);
        assert.ok(settled.sourceDurationUs > 0);
        const admitted = await poll(
          () => service.call("recording.get", { recordingId: recording.recordingId }),
          (value) =>
            value.sourceAdmissions.some(
              (source) => source.kind === "primary" && source.job?.state === "ready",
            ),
          "capture source admission",
        );
        const acquisitionId = admitted.sourceAdmissions.find(
          (source) => source.kind === "primary",
        ).acquisitionId;
        const acquisition = await service.call("acquisition.get", { acquisitionId });
        const receipt = acquisition.evidence.receipt;
        assert.equal(receipt.finished, false);
        assert.equal(receipt.completion ?? null, null);
        assert.equal(receipt.incompleteTail, boundary === "torn-terminal");
        assert.equal(receipt.invalidAtSequence ?? null, null);
        await service.stop();
        await service.start();
        assert.deepEqual(
          await service.call(
            "recording.get",
            { recordingId: recording.recordingId },
            { transport: "mcp" },
          ),
          admitted,
        );
        assert.deepEqual(await digests(), before);
        report.cases.push({ boundary, settled: admitted, acquisition, hashes: before });
      } finally {
        await service.stop();
      }
    }
    report.passed = true;
  } finally {
    try {
      await writeFile(join(output, "report.json"), JSON.stringify(report, null, 2));
    } finally {
      await rm(scratch, { recursive: true, force: true });
    }
  }
  console.log(output);
}

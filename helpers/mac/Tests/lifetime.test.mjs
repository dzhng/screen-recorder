import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { once } from "node:events";
import {
  closeSync,
  constants,
  existsSync,
  mkdtempSync,
  openSync,
  readFileSync,
  readSync,
  readdirSync,
  fstatSync,
  rmSync,
  writeSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const executable =
  process.env.SCREENREC_NATIVE ??
  fileURLToPath(new URL("../.build/debug/screenrec-native", import.meta.url));

/**
 * Stands in for the service that spawns the worker: the worker inherits this owner's stdio,
 * so its stdin is a pipe the test process holds open. Killing the owner then removes the
 * parent without closing stdin, which is what separates parent death from end of input.
 */
const owner = `
import { spawn } from "node:child_process";
import { writeSync } from "node:fs";
const worker = spawn(process.env.WORKER, [], { stdio: "inherit" });
writeSync(1, JSON.stringify({ workerPid: worker.pid }) + "\\n");
if (process.env.OWNER_EXITS === "1") process.exit(0);
setInterval(() => {}, 1000);
`;

function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** Milliseconds until the process is gone, or null once the bounded deadline passes. */
async function waitForExit(pid, deadlineMs) {
  const started = Date.now();
  while (Date.now() - started <= deadlineMs) {
    if (!alive(pid)) return Date.now() - started;
    await delay(25);
  }
  return null;
}

/**
 * The worker's stdin, stdout and stderr belong to this test rather than to the process that
 * spawns it, so an owner's death cannot take the worker's input or its diagnostics with it.
 */
function harness() {
  const directory = mkdtempSync(join(tmpdir(), "screenrec-lifetime-"));
  const fifo = join(directory, "stdin.fifo");
  assert.equal(spawnSync("mkfifo", [fifo]).status, 0);
  const outputPath = join(directory, "stdout.log");
  const diagnosticsPath = join(directory, "stderr.log");
  // Read-write keeps this end of the FIFO open no matter who else has it.
  const input = openSync(fifo, constants.O_RDWR);
  const stdio = [openSync(fifo, "r"), openSync(outputPath, "a"), openSync(diagnosticsPath, "a")];
  const read = (path) => readFileSync(path, "utf8");
  return {
    stdio,
    request: (line) => writeSync(input, `${line}\n`),
    diagnostics: () => read(diagnosticsPath),
    responses: () => read(outputPath).split("\n").filter(Boolean),
    async nextResponse(index, deadlineMs) {
      const started = Date.now();
      while (Date.now() - started <= deadlineMs) {
        const lines = read(outputPath).split("\n").filter(Boolean);
        if (lines.length > index) return lines[index];
        await delay(25);
      }
      return null;
    },
    close() {
      closeSync(input);
      for (const handle of stdio) closeSync(handle);
      rmSync(directory, { recursive: true, force: true });
    },
  };
}

test("the worker stops when its spawning owner dies, while its stdin stays open", async () => {
  const fixture = harness();
  const parent = spawn(process.execPath, ["--input-type=module", "-e", owner], {
    stdio: fixture.stdio,
    env: { ...process.env, WORKER: executable },
  });
  // Attached before the owner can exit: an exit already delivered is never announced again.
  const exited = once(parent, "exit");
  let workerPid = 0;
  try {
    workerPid = JSON.parse(await fixture.nextResponse(0, 10_000)).workerPid;
    // The worker has to serve a real request first: a process that never started cannot
    // prove anything about what parent death does to a worker that is running.
    fixture.request('{"id":"lifetime-ping","operation":"system.ping","params":{}}');
    assert.deepEqual(JSON.parse(await fixture.nextResponse(1, 10_000)), {
      id: "lifetime-ping",
      ok: true,
      data: { platform: "macos" },
    });
    assert.equal(alive(workerPid), true);

    parent.kill("SIGKILL");
    await exited;
    const elapsed = await waitForExit(workerPid, 10_000);
    assert.notEqual(elapsed, null, `worker ${workerPid} outlived its owner ${parent.pid}`);
    assert.match(fixture.diagnostics(), new RegExp(`owning parent ${parent.pid} exited`));
  } finally {
    if (alive(parent.pid)) parent.kill("SIGKILL");
    if (workerPid && alive(workerPid)) process.kill(workerPid, "SIGKILL");
    fixture.close();
  }
});

test("a worker whose owner exits during startup does not survive the race", async () => {
  const fixture = harness();
  const parent = spawn(process.execPath, ["--input-type=module", "-e", owner], {
    stdio: fixture.stdio,
    env: { ...process.env, WORKER: executable, OWNER_EXITS: "1" },
  });
  // Attached before the owner can exit: an exit already delivered is never announced again.
  const exited = once(parent, "exit");
  let workerPid = 0;
  try {
    workerPid = JSON.parse(await fixture.nextResponse(0, 10_000)).workerPid;
    await exited;
    const elapsed = await waitForExit(workerPid, 10_000);
    assert.notEqual(elapsed, null, `worker ${workerPid} outlived the owner that spawned it`);
    assert.match(fixture.diagnostics(), /owning parent \d+ exited/);
  } finally {
    if (alive(parent.pid)) parent.kill("SIGKILL");
    if (workerPid && alive(workerPid)) process.kill(workerPid, "SIGKILL");
    fixture.close();
  }
});

test("a worker started with no living owner refuses the work waiting on its stdin", async () => {
  // The owning shell exits before its backgrounded child reaches the worker, so the worker's
  // first instruction already runs under launchd. The worker reports which parent it saw, so
  // this case is confirmed by what the worker read rather than by the delay that arranged it.
  const fixture = harness();
  // The request pipe is handed on explicitly because a shell sends a background job's stdin
  // to /dev/null, and a worker reading /dev/null would end for want of input, not for want
  // of an owner.
  const orphan = `exec 3<&0; { sleep 0.5; exec "$0" 0<&3; } & echo $!; exit 0`;
  spawn("/bin/sh", ["-c", orphan, executable], { stdio: fixture.stdio });
  let workerPid = 0;
  try {
    workerPid = Number(await fixture.nextResponse(0, 10_000));
    fixture.request('{"id":"orphan-ping","operation":"system.ping","params":{}}');
    const elapsed = await waitForExit(workerPid, 10_000);
    assert.notEqual(elapsed, null, `worker ${workerPid} kept running without an owner`);
    assert.match(fixture.diagnostics(), /owning parent 1 exited/);
    assert.deepEqual(fixture.responses().slice(1), [], "an unowned worker answers nothing");
  } finally {
    if (workerPid && alive(workerPid)) process.kill(workerPid, "SIGKILL");
    fixture.close();
  }
});

test("an owner that dies mid-operation ends the worker and leaves the source untouched", async () => {
  const fixture = harness();
  const directory = mkdtempSync(join(tmpdir(), "screenrec-lifetime-media-"));
  const source = join(directory, "source.wav");
  const output = join(directory, "audio.wav");
  const encode = spawnSync(
    "ffmpeg",
    [
      "-v",
      "error",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=440:sample_rate=192000:duration=30",
      "-ac",
      "2",
      "-c:a",
      "pcm_f32le",
      source,
    ],
    { encoding: "utf8", timeout: 60_000 },
  );
  assert.equal(encode.status, 0, encode.stderr);
  const sourceDigest = createHash("sha256").update(readFileSync(source)).digest("hex");
  const parent = spawn(process.execPath, ["--input-type=module", "-e", owner], {
    stdio: fixture.stdio,
    env: { ...process.env, WORKER: executable },
  });
  // Attached before the owner can exit: an exit already delivered is never announced again.
  const exited = once(parent, "exit");
  let workerPid = 0;
  try {
    workerPid = JSON.parse(await fixture.nextResponse(0, 10_000)).workerPid;
    fixture.request(
      JSON.stringify({
        id: "lifetime-audio",
        operation: "media.sourceAudio",
        params: {
          source: {
            source,
            sourceOffsetUs: 0,
            available: [{ startUs: 0, endUs: 30_000_000 }],
          },
          output,
          range: { startUs: 0, endUs: 30_000_000 },
        },
      }),
    );
    const deadline = Date.now() + 10_000;
    let progress;
    while (!progress) {
      assert.equal(fixture.responses().length, 1, "the audio finished before it was interrupted");
      assert.ok(Date.now() < deadline, "source audio never wrote nonzero PCM before the deadline");
      for (const name of readdirSync(directory).filter((name) =>
        name.startsWith(".screenrec-output-"),
      )) {
        const staged = join(directory, name, "mix.wav");
        if (!existsSync(staged)) continue;
        const handle = openSync(staged, "r");
        try {
          const bytes = Buffer.alloc(64 * 1024);
          const read = readSync(handle, bytes, 0, bytes.length, 0);
          if (bytes.toString("ascii", 0, 4) !== "RIFF" || bytes.toString("ascii", 8, 12) !== "WAVE")
            continue;
          for (let position = 12; position + 8 <= read;) {
            const tag = bytes.toString("ascii", position, position + 4);
            const size = bytes.readUInt32LE(position + 4);
            position += 8;
            if (tag === "data") {
              // AVAudioFile can leave the data length unfinished while appending PCM.
              for (let offset = position; offset + 4 <= read; offset += 4) {
                const sample = bytes.readFloatLE(offset);
                if (Number.isFinite(sample) && Math.abs(sample) > 0.05) {
                  progress = { bytes: fstatSync(handle).size, sample };
                  break;
                }
              }
              break;
            }
            position += size + (size % 2);
          }
        } finally {
          closeSync(handle);
        }
      }
      if (!progress) await delay(5);
    }
    assert.equal(existsSync(output), false, "the audio was already published");
    assert.deepEqual(fixture.responses().length, 1, "the audio finished before it was interrupted");
    assert.equal(alive(workerPid), true);

    parent.kill("SIGKILL");
    await exited;
    const elapsed = await waitForExit(workerPid, 10_000);
    assert.notEqual(
      elapsed,
      null,
      `worker ${workerPid} kept decoding for a dead owner ${parent.pid}`,
    );
    assert.match(fixture.diagnostics(), new RegExp(`owning parent ${parent.pid} exited`));
    assert.deepEqual(fixture.responses().slice(1), [], "abandoned work reports no result");
    assert.equal(existsSync(output), false, "unfinished audio is never left at the output path");
    assert.equal(createHash("sha256").update(readFileSync(source)).digest("hex"), sourceDigest);
    console.log({ observedPCM: progress, parentExitMs: elapsed });
  } finally {
    if (alive(parent.pid)) parent.kill("SIGKILL");
    if (workerPid && alive(workerPid)) process.kill(workerPid, "SIGKILL");
    fixture.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

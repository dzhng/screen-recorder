import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createInterface } from "node:readline";
import {
  DEFAULT_CALL_TIMEOUT_MS,
  CONTROL_FRAME_BYTES,
  MAX_PENDING_CONTROL_CALLS,
} from "@yap/protocol";
import { JourneyService, poll, root } from "./source-evidence-fixture.mjs";

/** Only the physical input is prerecorded; controller, host, public transport and service are real. */
export class ControllerJourneyService extends JourneyService {
  constructor(home, report, fixture) {
    super(home, report);
    this.fixture = fixture;
    this.messages = new Map();
  }
  async start() {
    await mkdir(this.home, { recursive: true });
    const configuration = join(this.home, "controller.json");
    await writeFile(
      configuration,
      JSON.stringify({
        ...this.fixture,
        script: join(root, "packages/test-harness/editing/controller-service.mjs"),
        node: process.execPath,
        controlFrameBytes: CONTROL_FRAME_BYTES,
        maxPendingCalls: MAX_PENDING_CONTROL_CALLS,
        callTimeoutMs: DEFAULT_CALL_TIMEOUT_MS,
      }),
    );
    this.child = spawn(this.fixture.executable, [configuration], {
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        YAP_CONTROLLER_HOME: this.home,
        ...(this.fixture.evidence ? { YAP_CONTROLLER_EVIDENCE: this.fixture.evidence } : {}),
        ...(this.fixture.recoveryHold
          ? { YAP_CONTROLLER_RECOVERY_HOLD: this.fixture.recoveryHold }
          : {}),
        ...(this.fixture.importFault
          ? { YAP_CONTROLLER_IMPORT_FAULT: this.fixture.importFault }
          : {}),
      },
    });
    this.child.stderr.on("data", (bytes) => this.logs.push(bytes.toString()));
    this.lines = createInterface({ input: this.child.stdout });
    this.lines.on("line", (line) => {
      const value = JSON.parse(line);
      this.messages.set(value.id ?? value.event, value);
    });
    const ready = await poll(
      () => {
        assert.equal(this.child.exitCode, null, this.logs.join(""));
        assert.equal(
          this.messages.has("unavailable"),
          false,
          JSON.stringify(this.messages.get("unavailable")),
        );
        return this.messages.get("ready") ?? {};
      },
      (value) => value.event === "ready",
      "controller readiness",
    );
    this.servicePid = ready.pid;
    await this.connect(ready.socketPath);
  }
  async fixtureCall(operation, params = {}) {
    const id = randomUUID();
    this.child.stdin.write(JSON.stringify({ id, operation, params }) + "\n");
    const reply = await poll(
      () => this.messages.get(id) ?? {},
      (value) => value.id === id,
      operation,
    );
    assert.equal(reply.ok, true, JSON.stringify(reply));
    this.report.fixture?.push({ operation, params, reply });
    return reply;
  }
  async stop(crash = false) {
    await this.mcp?.close();
    this.mcp = undefined;
    if (!this.child || this.child.exitCode !== null || this.child.signalCode !== null) return;
    const exited = once(this.child, "exit");
    const timer = setTimeout(() => this.child.kill("SIGKILL"), 15000);
    try {
      if (crash) {
        process.kill(this.servicePid, "SIGKILL");
        await poll(
          () => this.messages.get("unavailable") ?? {},
          (value) => value.event === "unavailable",
          "native settles lost service",
        );
      }
      await this.fixtureCall("close");
      const [code, signal] = await exited;
      assert.equal(signal, null, this.logs.join(""));
      assert.equal(code, 0, this.logs.join(""));
    } finally {
      clearTimeout(timer);
      this.lines?.close();
      this.started = false;
    }
  }
  async crashController() {
    await this.mcp?.close();
    this.mcp = undefined;
    const exited = once(this.child, "exit");
    this.child.kill("SIGKILL");
    const [, signal] = await exited;
    assert.equal(signal, "SIGKILL");
    await poll(
      () => {
        try {
          process.kill(this.servicePid, 0);
          return false;
        } catch (error) {
          if (error.code === "ESRCH") return true;
          throw error;
        }
      },
      (gone) => gone,
      "service closes after controller crash",
    );
    this.lines?.close();
    this.started = false;
  }
}

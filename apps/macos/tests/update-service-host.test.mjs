import assert from "node:assert/strict";
import { test } from "node:test";
import { checkServiceHost as check } from "./fixtures/swift-service-host.mjs";

test("private update progress preserves the control channel and correlated permit calls", (t) => {
  const result = check(
    t,
    `
import { createInterface } from 'node:readline';
const send = (message) => process.stdout.write(JSON.stringify(message) + '\\n');
send({event:'started', pid:process.pid, socketPath:'/scratch/service.sock'});
setTimeout(() => send({event:'update.progress'}), 20);
createInterface({input:process.stdin}).on('line', (line) => {
  const {request} = JSON.parse(line);
  send({event:'result', response:{id:request.id, ok:true, data:{kind:'prepared',permitId:'real-channel-permit'}}});
}).on('close', () => process.exit(0));
`,
    `
    try? await Task.sleep(for: .milliseconds(100))
    do {
        let result = try await host.call("update.prepare")
        print(String(decoding: result, as: UTF8.self))
    } catch { print(error.code); exit(1) }
`,
  );
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), {
    kind: "prepared",
    permitId: "real-channel-permit",
  });
});

test("updater EOF times out without signaling a live child or promising restored admission", (t) => {
  const result = check(
    t,
    `
const send = (message) => process.stdout.write(JSON.stringify(message) + '\\n');
send({event:'started', pid:process.pid, socketPath:'/scratch/service.sock'});
process.stdin.resume();
process.stdin.on('end', () => process.stdout.write('broken\\n'));
process.on('SIGTERM', () => process.exit(42));
setInterval(() => {}, 1000);
`,
    `
    guard case .ready(let pid, _) = observed else { exit(1) }
    do { try await host.shutdownForUpdate(timeout: 0.15); print("unexpected clean exit"); exit(1) }
    catch { print(error.code) }
    guard case .unavailable = observed else { print("closing service falsely reported ready"); exit(1) }
    guard kill(pid, 0) == 0 else { print("child was forced to exit"); exit(1) }
    do { _ = try await host.call("service.health"); print("admission falsely restored"); exit(1) }
    catch { print(error.code) }
`,
  );
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.deepEqual(result.stdout.trim().split("\n"), [
    "UPDATE_SHUTDOWN_TIMEOUT",
    "SERVICE_STOPPED",
  ]);
});

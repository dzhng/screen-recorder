import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { RevisionStore } from "@screenrec/core/library";
import { journalRows } from "./fixtures/generated-capture.mjs";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const sources = join(root, "apps/macos/Sources");

/** Builds the real controls module and links the named app sources and a check against it. */
function compile(scratch, appSources, check) {
  const controls = join(sources, "ScreenRecorderControls");
  execFileSync(
    "swiftc",
    [
      "-emit-library",
      "-emit-module",
      "-module-name",
      "ScreenRecorderControls",
      "-emit-module-path",
      join(scratch, "ScreenRecorderControls.swiftmodule"),
      "-o",
      join(scratch, "libScreenRecorderControls.dylib"),
      ...readdirSync(controls)
        .filter((name) => name.endsWith(".swift"))
        .map((name) => join(controls, name)),
    ],
    { timeout: 60_000, stdio: "pipe" },
  );
  const main = join(scratch, "Check.swift");
  writeFileSync(main, check);
  const executable = join(scratch, "check");
  execFileSync(
    "swiftc",
    [
      "-swift-version",
      "6",
      "-parse-as-library",
      "-I",
      scratch,
      "-L",
      scratch,
      "-lScreenRecorderControls",
      "-Xlinker",
      "-rpath",
      "-Xlinker",
      scratch,
      ...appSources.map((name) => join(sources, "ScreenRecorder", `${name}.swift`)),
      main,
      "-o",
      executable,
    ],
    { timeout: 60_000, stdio: "pipe" },
  );
  return executable;
}

test(
  "native exports pin the revision, keep one identity through lost replies and rediscover pages",
  { timeout: 120_000 },
  () => {
    const scratch = mkdtempSync(join(tmpdir(), "screenrec-export-controls-"));
    try {
      const executable = compile(
        scratch,
        ["ExportController", "ServiceBundle", "NodeRuntime"],
        String.raw`
import AppKit
import ScreenRecorderControls

@MainActor final class Script {
    var calls: [(String, [String: Any])] = []
    var createFailures: [(ServiceFailure, admitted: Bool)] = []
    var admitted: [String: [String: Any]] = [:]
    var revision = "r3"
    var pages: [[String: Any]] = []

    func json(_ value: Any) -> Data { try! JSONSerialization.data(withJSONObject: value) }
    func status(_ params: [String: Any]) -> [String: Any] {
        ["exportId": params["exportId"]!, "recordingId": params["recordingId"]!, "kind": params["kind"]!,
         "snapshot": ["revisionId": params["revisionId"]!], "state": "queued", "abandoning": false,
         "destination": ["directory": params["directory"]!, "leaf": params["leaf"]!],
         "cleanupPending": false, "output": NSNull(), "reason": NSNull(), "retryable": false]
    }
    func call(_ operation: String, _ params: [String: Any]) async throws(ServiceFailure) -> Data {
        calls.append((operation, params))
        let id = params["exportId"] as? String ?? ""
        switch operation {
        case "recording.get":
            return json(["recordingId": "take", "createdAt": "2026-09-17T10:11:12.345Z", "currentRevisionId": revision])
        case "export.create":
            if !createFailures.isEmpty {
                let (failure, admit) = createFailures.removeFirst()
                if admit { admitted[id] = params }
                throw failure
            }
            admitted[id] = params
            return json(status(params))
        case "export.status":
            guard let params = admitted[id] else { throw ServiceFailure(code: "NOT_FOUND", message: "Export does not exist") }
            return json(status(params))
        case "export.list":
            return json(pages.removeFirst())
        case "export.abandon":
            try? await Task.sleep(for: .milliseconds(50))
            admitted[id] = nil
            return json(["exportId": id, "abandoned": true])
        default:
            throw ServiceFailure(code: "UNKNOWN_OPERATION", message: operation)
        }
    }
    func count(_ operation: String) -> Int { calls.filter { $0.0 == operation }.count }
}

@main struct Check {
    @MainActor static func until(line: Int = #line, _ condition: () -> Bool) async {
        for _ in 0..<200 where !condition() { try? await Task.sleep(for: .milliseconds(10)) }
        precondition(condition(), "Timed out waiting for the controller at line \(line)")
    }
    @MainActor static func main() async {
        let script = Script()
        var failures: [String] = []
        var chosen: [(ExportsState.Kind, String)] = []
        var destination: URL? = nil
        let exports = ExportController(
            call: { operation, params throws(ServiceFailure) in try await script.call(operation, params) },
            choose: { kind, name in
                chosen.append((kind, name))
                // An edit lands while the person is still choosing a folder.
                script.revision = "r4"
                return destination
            },
            reveal: { _ in }, changed: {}, failure: { failures.append($0) })

        exports.export("take", kind: .video)
        await until { exports.state.choosing == nil && chosen.count == 1 }
        precondition(script.count("export.create") == 0 && exports.state.requests.isEmpty,
            "Choosing no destination exports nothing")
        precondition(chosen[0].1.hasSuffix(" r3.mp4"), "The suggested name states the pinned revision: \(chosen[0].1)")

        // A reply lost after admission: status adopts the admitted export under the same identity.
        script.revision = "r3"
        destination = URL(fileURLWithPath: "/Users/me/Exports/demo.mp4")
        script.createFailures = [(ServiceFailure(code: "TIMEOUT", message: "export.create did not answer in time"), true)]
        exports.export("take", kind: .video)
        await until { exports.state.requests.first?.unconfirmed != nil }
        let sent = script.calls.last { $0.0 == "export.create" }!.1
        let first = sent["exportId"] as! String
        precondition(sent["revisionId"] as? String == "r3", "The revision is pinned before the panel opens")
        precondition(sent["directory"] as? String == "/Users/me/Exports" && sent["leaf"] as? String == "demo.mp4")
        precondition(sent["kind"] as? String == "video")
        precondition(first == first.lowercased() && UUID(uuidString: first) != nil, "Export IDs are lowercase UUIDs")
        exports.tick()
        await until { exports.state.requests.isEmpty }
        precondition(exports.state.records.map(\.exportId) == [first] && script.count("export.create") == 1,
            "An admitted request is found by status without being sent again")

        // A reply lost before admission: sending again reuses the identity and destination.
        destination = URL(fileURLWithPath: "/Volumes/Work/take.zip")
        script.createFailures = [(ServiceFailure(code: "SERVICE_STOPPED", message: "Service is shutting down"), false)]
        exports.export("take", kind: .package)
        await until { exports.state.requests.first?.unconfirmed != nil }
        let second = exports.state.requests[0].exportId
        exports.tick()
        await until { script.calls.contains { $0.0 == "export.status" && $0.1["exportId"] as? String == second } }
        try? await Task.sleep(for: .milliseconds(50))
        precondition(exports.state.requests.first?.exportId == second, "An unadmitted request stays unconfirmed")
        exports.resend(second)
        await until { exports.state.requests.isEmpty }
        let resent = script.calls.filter { $0.0 == "export.create" }.suffix(2).map { $0.1 }
        precondition(resent.allSatisfy { $0["exportId"] as? String == second && $0["leaf"] as? String == "take.zip"
            && $0["kind"] as? String == "processed-package" }, "Sending again names the same export")
        precondition(exports.state.records.map(\.exportId) == [second, first])

        // A definite refusal ends the request and says why.
        script.createFailures = [(ServiceFailure(code: "INVALID_PARAMS", message: "Parameters do not match"), false)]
        exports.export("take", kind: .video)
        await until { !failures.isEmpty }
        precondition(exports.state.requests.isEmpty && failures == ["INVALID_PARAMS: Parameters do not match"])

        // A restarted app rediscovers every unfinished page, then acts on what it found.
        let restarted = ExportController(
            call: { operation, params throws(ServiceFailure) in try await script.call(operation, params) },
            choose: { _, _ in nil }, reveal: { _ in }, changed: {}, failure: { failures.append($0) })
        let cursor: [String: Any] = ["recordingId": NSNull(), "unfinishedOnly": true, "afterExportId": first]
        script.pages = [
            ["exports": [["exportId": first]], "nextCursor": cursor],
            ["exports": [["exportId": second]], "nextCursor": NSNull()],
        ]
        restarted.discover()
        await until { restarted.state.records.count == 2 }
        let lists = script.calls.filter { $0.0 == "export.list" }.map { $0.1 }
        precondition(lists.count == 2 && lists.allSatisfy { $0["unfinishedOnly"] as? Bool == true },
            "Discovery asks only for unfinished exports")
        precondition((lists[1]["cursor"] as? [String: Any])?["afterExportId"] as? String == first,
            "Discovery follows the service's continuation")
        precondition(restarted.state.records.map(\.exportId) == [first, second], "Discovered exports keep page order")
        restarted.abandon(second)
        restarted.abandon(second)
        await until { restarted.state.records.count == 1 }
        precondition(script.count("export.abandon") == 1, "Abandonment is sent once")
        print("PASS native exports pin revisions, replay lost requests and rediscover every page")
    }
}
`,
      );
      assert.match(
        execFileSync(executable, [], { encoding: "utf8", timeout: 30_000 }),
        /PASS native exports pin revisions/,
      );
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  },
);

test(
  "native exports commit through the bundled service and rediscover an unfinished export after restart",
  { timeout: 180_000 },
  async () => {
    const home = mkdtempSync("/tmp/screenrec-export-controls-home-");
    const output = await realpath(mkdtempSync("/tmp/screenrec-export-controls-output-"));
    const scratch = mkdtempSync(join(tmpdir(), "screenrec-export-controls-build-"));
    let safeToRemove = true;
    try {
      const store = new RevisionStore(join(home, "library.sqlite"), {
        now: () => new Date().toISOString(),
        newId: randomUUID,
      });
      const take = store.allocate().recording;
      store.ingestLifecycle(take.recordingId, {
        sourceId: take.sourceId,
        sequence: 1,
        state: "interrupted",
        reason: "generated native export fixture",
        sourceDurationUs: 2_000_000,
      });
      store.close();
      const source = join(home, "recordings", take.recordingId, "source");
      await mkdir(source, { recursive: true });
      execFileSync(
        "ffmpeg",
        [
          "-nostdin",
          "-v",
          "error",
          "-f",
          "lavfi",
          "-i",
          "color=c=gray:s=160x90:r=1:d=2",
          "-an",
          "-c:v",
          "libx264",
          "-pix_fmt",
          "yuv420p",
          join(source, "video.mov"),
        ],
        { timeout: 20_000 },
      );
      const rows = journalRows({
        sourceId: take.sourceId,
        width: 160,
        height: 90,
        samples: [],
        pauses: [],
      });
      await writeFile(
        join(source, "capture.journal.jsonl"),
        rows.map((row, i) => JSON.stringify({ sequence: i + 1, ...row }) + "\n").join(""),
      );
      const executable = compile(
        scratch,
        ["ExportController", "ServiceHost", "ServiceBundle", "NodeRuntime"],
        String.raw`
import AppKit
import ScreenRecorderControls

@MainActor final class Service {
    var state: ServiceHost.State = .starting
    var host: ServiceHost!
    static func start(_ resolved: ServiceBundle) async -> Service {
        let service = Service()
        service.host = ServiceHost(bundle: resolved, onNativeCall: { _, _, answer in
            answer(.failure(ServiceFailure(code: "UNKNOWN_OPERATION", message: "This check owns no capture session")))
        }) { state in Task { @MainActor in service.state = state } }
        service.host.start()
        for _ in 0..<150 {
            if case .ready = service.state { return service }
            if case .unavailable(let code, let message) = service.state { fatalError("\(code): \(message)") }
            try? await Task.sleep(for: .milliseconds(100))
        }
        fatalError("Bundled service did not become ready")
    }
    func call(_ operation: String, _ params: [String: Any]) async throws(ServiceFailure) -> Data {
        try await host.call(operation, params)
    }
}

@main struct Check {
    @MainActor static func main() {
        let app = NSApplication.shared
        Task { @MainActor in
            await run()
            app.terminate(nil)
        }
        app.run()
    }
    @MainActor static func until(_ seconds: Int, _ poll: () -> Void, _ condition: () -> Bool) async {
        for _ in 0..<(seconds * 10) where !condition() {
            poll()
            try? await Task.sleep(for: .milliseconds(100))
        }
        precondition(condition(), "Timed out waiting for the bundled service")
    }
    @MainActor static func run() async {
        NSApp.setActivationPolicy(.accessory)
        let arguments = CommandLine.arguments
        let (bundlePath, recordingId, directory) = (arguments[1], arguments[2], arguments[3])
        let resolved: ServiceBundle = try! await withCheckedThrowingContinuation { continuation in
            ServiceBundle.resolve(in: Bundle(path: bundlePath)!) { continuation.resume(with: $0) }
        }
        var service = await Service.start(resolved)
        var failures: [String] = []
        var revealed: [URL] = []
        let first = ExportController(
            call: { operation, params throws(ServiceFailure) in try await service.call(operation, params) },
            choose: { kind, _ in
                precondition(kind == .video)
                // An edit made while the panel is open does not change the pinned export.
                _ = try? await service.call("edit.cut", ["recordingId": recordingId, "requestId": UUID().uuidString,
                    "expectedRevisionId": "r0", "ranges": [["startUs": 500_000, "endUs": 1_000_000]]])
                return URL(fileURLWithPath: directory).appendingPathComponent("demo.mp4")
            },
            reveal: { revealed.append($0) }, changed: {}, failure: { failures.append($0) })

        first.export(recordingId, kind: .video)
        await until(60, first.tick) { first.state.records.first?.committed == true || !failures.isEmpty }
        precondition(failures.isEmpty, "Export failed: \(failures)")
        let committed = first.state.records[0]
        precondition(committed.revisionId == "r0" && committed.leaf == "demo.mp4" && committed.directory == directory,
            "The committed export is the revision pinned before the edit: \(committed)")
        first.reveal(committed.exportId)
        precondition(revealed == [URL(fileURLWithPath: directory).appendingPathComponent("demo.mp4")])
        let current = try! JSONSerialization.jsonObject(with: await service.call("recording.get", ["recordingId": recordingId])) as! [String: Any]
        precondition(current["currentRevisionId"] as? String != "r0", "The library edit did advance")

        // The same destination is occupied now, so the service refuses to replace it.
        let occupied = ExportController(
            call: { operation, params throws(ServiceFailure) in try await service.call(operation, params) },
            choose: { _, _ in URL(fileURLWithPath: directory).appendingPathComponent("demo.mp4") },
            reveal: { _ in }, changed: {}, failure: { failures.append($0) })
        occupied.export(recordingId, kind: .video)
        await until(60, occupied.tick) { occupied.state.records.first?.state == "failed" || !failures.isEmpty }
        precondition(failures.isEmpty, "Occupied export was refused before admission: \(failures)")
        let failed = occupied.state.records[0].exportId
        print("EXPORTS committed=\(committed.exportId) failed=\(failed)")

        service.host.shutdown()
        service = await Service.start(resolved)
        let restarted = ExportController(
            call: { operation, params throws(ServiceFailure) in try await service.call(operation, params) },
            choose: { _, _ in nil }, reveal: { _ in }, changed: {}, failure: { failures.append($0) })
        restarted.discover()
        await until(20, {}) { !restarted.state.records.isEmpty || restarted.state.discoveryFailure != nil }
        precondition(restarted.state.discoveryFailure == nil, "\(restarted.state.discoveryFailure!)")
        precondition(restarted.state.records.map(\.exportId) == [failed],
            "Only the unfinished export is rediscovered: \(restarted.state.records.map(\.exportId))")
        let found = restarted.state.records[0]
        precondition(found.state == "failed" && found.directory == directory && found.leaf == "demo.mp4",
            "The rediscovered export states its admitted destination without app storage")
        restarted.abandon(failed)
        await until(30, {}) { restarted.state.records.isEmpty || !restarted.state.failures.isEmpty }
        precondition(restarted.state.failures.isEmpty, "\(restarted.state.failures)")
        do throws(ServiceFailure) {
            _ = try await service.call("export.status", ["exportId": failed])
            preconditionFailure("An abandoned export has no status")
        } catch {
            precondition(error.code == "NOT_FOUND", error.localizedDescription)
        }
        service.host.shutdown()
        print("PASS native exports commit, rediscover an unfinished export after restart and abandon it")
    }
}
`,
      );
      safeToRemove = false;
      const result = await new Promise((resolve, reject) => {
        const child = spawn(
          executable,
          [join(root, "dist/ScreenRecorder.app"), take.recordingId, output],
          { env: { ...process.env, SCREENREC_HOME: home }, stdio: ["ignore", "pipe", "pipe"] },
        );
        let stdout = "",
          stderr = "";
        child.stdout.on("data", (chunk) => (stdout += chunk));
        child.stderr.on("data", (chunk) => (stderr += chunk));
        child.once("error", reject);
        const timeout = setTimeout(() => child.kill("SIGKILL"), 150_000);
        child.once("close", (code, signal) => {
          clearTimeout(timeout);
          resolve({ code, signal, stdout, stderr });
        });
      });
      assert.equal(result.code, 0, result.stderr + result.stdout);
      assert.match(result.stdout, /PASS native exports commit/);
      const [, committed] = result.stdout.match(/EXPORTS committed=(\S+) failed=(\S+)/);
      assert.deepEqual(
        readdirSync(output),
        ["demo.mp4"],
        "abandonment leaves no private staging behind",
      );
      const exported = await readFile(join(output, "demo.mp4"));
      assert.ok(exported.length > 0, `committed export ${committed} has bytes`);
      const info = JSON.parse(
        execFileSync(
          "ffprobe",
          ["-v", "error", "-show_format", "-of", "json", join(output, "demo.mp4")],
          {
            encoding: "utf8",
          },
        ),
      );
      assert.equal(
        Number(info.format.duration),
        2,
        "the export stays pinned before the concurrent cut",
      );
      safeToRemove = true;
      console.log(result.stdout.trim());
    } finally {
      rmSync(scratch, { recursive: true, force: true });
      if (safeToRemove) {
        rmSync(home, { recursive: true, force: true });
        rmSync(output, { recursive: true, force: true });
      }
    }
  },
);

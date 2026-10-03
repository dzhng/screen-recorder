@preconcurrency import AVFoundation
import CryptoKit
import Foundation
import ObjectiveC
import Synchronization

@testable import ScreenRecorderWire

// These callbacks originate on the SDK executor, outside the helper's top-level actor.
private final class MovieFinishing: @unchecked Sendable {
  struct Event: Codable, Sendable {
    let phase: String
    let output: String
    let status: Int
  }
  struct State: Sendable {
    var task: Task<Data, Never>?
    var events: [Event] = []
    var cancellationRequested = false
    var finishingQualified = false
    var completionSawCanceledCaller = false
    var activeCalls = 0
    var activeCallbacks = 0
    var callsReturned = 0
    var completionsReturned = 0
  }
  private final class Counter: Sendable { let value = Mutex(State()) }
  private let counter = Counter()
  private let method: Method
  private let original: IMP
  private let replacement: IMP
  let encoding: String

  init(in directory: URL) throws {
    let selector = NSSelectorFromString("finishWritingWithCompletionHandler:")
    guard let method = class_getInstanceMethod(AVAssetWriter.self, selector),
      let type = method_getTypeEncoding(method)
    else { throw NSError(domain: "MovieFinishing", code: 1) }
    encoding = String(cString: type)
    guard encoding == "v24@0:8@?16" else {
      throw NSError(domain: "Unexpected finishWriting ABI: \(encoding)", code: 2)
    }
    self.method = method
    original = method_getImplementation(method)
    typealias Finish =
      @convention(c) (AnyObject, Selector, @escaping @convention(block) () -> Void) -> Void
    let forward = unsafeBitCast(original, to: Finish.self)
    let counter = self.counter
    let observe:
      @convention(block) (AVAssetWriter, @escaping @convention(block) () -> Void) -> Void = {
        writer, completion in
        let output = writer.outputURL
        guard output.lastPathComponent == "movie.mp4",
          output.deletingLastPathComponent().lastPathComponent.hasPrefix(".screenrec-output-"),
          output.deletingLastPathComponent().deletingLastPathComponent() == directory
        else {
          forward(writer, selector, completion)
          return
        }
        let task = counter.value.withLock { state in
          state.events.append(
            Event(phase: "entered", output: output.path, status: writer.status.rawValue))
          state.activeCalls += 1
          return state.task
        }
        let observedCompletion: @convention(block) () -> Void = {
          counter.value.withLock { state in
            state.activeCallbacks += 1
            state.completionSawCanceledCaller = state.task?.isCancelled == true
            state.events.append(
              Event(phase: "completion", output: output.path, status: writer.status.rawValue))
          }
          completion()
          counter.value.withLock { state in
            state.activeCallbacks -= 1
            state.completionsReturned += 1
          }
        }
        forward(writer, selector, observedCompletion)
        let finishing = counter.value.withLock { state in
          state.events.append(
            Event(phase: "sdk-started", output: output.path, status: writer.status.rawValue))
          state.finishingQualified =
            task != nil && writer.status == .writing
            && !state.events.contains { $0.phase == "completion" }
          state.callsReturned += 1
          return state.finishingQualified
        }
        if finishing {
          task?.cancel()
          counter.value.withLock { $0.cancellationRequested = task?.isCancelled == true }
        }
        counter.value.withLock { $0.activeCalls -= 1 }
      }
    replacement = imp_implementationWithBlock(observe)
    method_setImplementation(method, replacement)
  }

  func attach(_ task: Task<Data, Never>) { counter.value.withLock { $0.task = task } }
  var state: State { counter.value.withLock { $0 } }
  func restore() {
    precondition(state.activeCalls == 0 && state.activeCallbacks == 0)
    precondition(method_getImplementation(method) == replacement)
    method_setImplementation(method, original)
    precondition(method_getImplementation(method) == original)
    imp_removeBlock(replacement)
  }
}

func checkMovieFinishingCancellation(requestFile: String) async throws {
  let manager = FileManager.default
  let request = try Data(contentsOf: URL(fileURLWithPath: requestFile))
  let params = try JSONSerialization.jsonObject(with: request) as! [String: Any]
  let output = URL(fileURLWithPath: params["output"] as! String)
  let directory = output.deletingLastPathComponent()
  let assets = params["assets"] as! [[String: Any]]
  let sources = Set(assets.map { $0["path"] as! String } + [params["frames"] as! String]).sorted()
  func hashes() throws -> [String: String] {
    try Dictionary(
      uniqueKeysWithValues: sources.map { path in
        (
          path,
          SHA256.hash(data: try Data(contentsOf: URL(fileURLWithPath: path)))
            .map { String(format: "%02x", $0) }.joined()
        )
      })
  }
  let before = try hashes()
  let line = String(
    data: try JSONSerialization.data(withJSONObject: [
      "id": "finish-cancel", "operation": "media.renderCompositionMovie", "params": params,
    ]), encoding: .utf8)!
  let observer = try MovieFinishing(in: directory)
  let work = Task { await NativeWire.respond(to: line) }
  observer.attach(work)
  let reply = await work.value
  let atReply = observer.state
  let deadline = ContinuousClock.now.advanced(by: .seconds(10))
  while observer.state.activeCalls != 0 || observer.state.activeCallbacks != 0 {
    precondition(ContinuousClock.now < deadline, "SDK finishing callback did not drain")
    try await Task.sleep(for: .milliseconds(1))
  }
  let drained = observer.state
  observer.restore()
  let after = try hashes()
  let remaining = try manager.contentsOfDirectory(atPath: directory.path)
  try reply.write(to: directory.appendingPathComponent("finish-cancel-response.json"))
  let eventData = try JSONEncoder().encode(drained.events)
  let evidence: [String: Any] = [
    "sdkEncoding": observer.encoding,
    "events": try JSONSerialization.jsonObject(with: eventData),
    "completionEventsAtReply": atReply.events.filter { $0.phase == "completion" }.count,
    "cancellationRequested": drained.cancellationRequested,
    "finishingQualified": drained.finishingQualified,
    "completionSawCanceledCaller": drained.completionSawCanceledCaller,
    "callsReturned": drained.callsReturned,
    "completionsReturned": drained.completionsReturned,
    "activeCalls": drained.activeCalls, "activeCallbacks": drained.activeCallbacks,
    "sourceBefore": before, "sourceAfter": after,
    "outputExists": manager.fileExists(atPath: output.path), "remaining": remaining,
    "methodRestored": true,
  ]
  try JSONSerialization.data(withJSONObject: evidence, options: [.sortedKeys, .prettyPrinted])
    .write(to: directory.appendingPathComponent("finish-cancel-observation.json"))
  let response = try JSONSerialization.jsonObject(with: reply) as! [String: Any]
  let error = response["error"] as? [String: Any]
  precondition(
    drained.finishingQualified && drained.completionSawCanceledCaller,
    "Nonqualifying observation: SDK finish was not writing before completion when caller cancellation arrived"
  )
  precondition(
    response["ok"] as? Bool == false && error?["code"] as? String == "CANCELED",
    "Cancellation at outer SDK writer finish must return CANCELED: \(response)")
  precondition(drained.cancellationRequested && drained.events.count == 3)
  precondition(
    drained.events[0].phase == "entered"
      && drained.events[0].status == AVAssetWriter.Status.writing.rawValue)
  precondition(
    drained.events[1].phase == "sdk-started"
      && drained.events[1].status == AVAssetWriter.Status.writing.rawValue
      && drained.events[2].phase == "completion"
      && drained.events[1].output == drained.events[0].output
      && drained.events[2].output == drained.events[0].output)
  precondition(
    atReply.events.filter { $0.phase == "completion" }.count == 1,
    "Native operation returned before SDK writer completion")
  precondition(
    drained.callsReturned == 1 && drained.completionsReturned == 1 && drained.activeCalls == 0
      && drained.activeCallbacks == 0)
  precondition(!manager.fileExists(atPath: output.path), "Canceled finish published output")
  precondition(
    !remaining.contains { $0.hasPrefix(".screenrec-output-") }, "Canceled finish leaked staging")
  precondition(before == after, "Canceled finish changed source bytes")
  print(
    "PASS actual outer AVAssetWriter finishing cancellation, drained completion, no publication/staging and unchanged source bytes"
  )
}

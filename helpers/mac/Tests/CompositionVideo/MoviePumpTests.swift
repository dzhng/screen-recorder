@preconcurrency import AVFoundation
import CryptoKit
import Foundation
import ObjectiveC
import Synchronization

@testable import YapWire

// Readiness interleave is controlled scheduling; all original SDK calls and samples still run.
private final class MoviePumps {
  struct Event: Encodable {
    let writer: String
    let phase: String
    let role: String
    let writerStatus: Int
    let sdkReturned: Bool?
    let deliveredReady: Bool?
    let audioAppends: Int
    let audioFrames: Int
    let videoAppends: Int
    let audioFinished: Bool
    let videoFinished: Bool
    let error: String?
  }
  struct State: @unchecked Sendable {
    var writer: AVAssetWriter?
    var task: Task<Data, Never>?
    var roles: [ObjectIdentifier: String] = [:]
    var audio = 0, video = 0
    var audioFrames = 0
    var audioFinished = false, videoFinished = false
    var active = 0, fault: ContinuousClock.Instant?
    var handoff = false
    var overlap = false
    var videoGateObserved = false, audioGateObserved = false
    var faultStatus: Int?
    var callerCanceledAtFault: Bool?
    var faultReturned: Bool?
    var logError: String?
  }
  final class Counter: Sendable {
    let state = Mutex(State())
    let log: FileHandle
    init(_ log: FileHandle) { self.log = log }
    func record(
      _ phase: String, _ role: String, _ writer: AVAssetWriter, _ accepted: Bool? = nil,
      deliveredReady: Bool? = nil
    ) {
      state.withLock { value in
        let event = Event(
          writer: writer.outputURL.path, phase: phase, role: role,
          writerStatus: writer.status.rawValue,
          sdkReturned: accepted, deliveredReady: deliveredReady, audioAppends: value.audio,
          audioFrames: value.audioFrames,
          videoAppends: value.video,
          audioFinished: value.audioFinished, videoFinished: value.videoFinished,
          error: writer.error?.localizedDescription)
        do { try log.write(contentsOf: JSONEncoder().encode(event) + Data([10])) } catch {
          value.logError = String(describing: error)
        }
      }
    }
  }
  private let counter: Counter
  private var methods: [(Method, IMP, IMP)] = []
  init(directory: URL, faultRequested: Bool, expectedAudioFrames: Int) throws {
    let file = directory.appendingPathComponent("sdk-prefix.jsonl")
    precondition(FileManager.default.createFile(atPath: file.path, contents: nil))
    counter = Counter(try FileHandle(forWritingTo: file))
    let c = counter
    let startSelector = #selector(AVAssetWriter.startWriting)
    let appendSelector = #selector(AVAssetWriterInput.append(_:))
    let finishSelector = #selector(AVAssetWriterInput.markAsFinished)
    let readySelector = NSSelectorFromString("isReadyForMoreMediaData")
    func method(_ type: AnyClass, _ selector: Selector, _ expected: String) throws -> Method {
      guard let m = class_getInstanceMethod(type, selector), let e = method_getTypeEncoding(m)
      else {
        throw NSError(domain: "Missing SDK observation method", code: 1)
      }
      let encoding = String(cString: e)
      print(NSStringFromSelector(selector), encoding)
      guard encoding == expected else {
        throw NSError(domain: "Unexpected ABI: \(encoding)", code: 2)
      }
      return m
    }
    let start = try method(AVAssetWriter.self, startSelector, "B16@0:8")
    let append = try method(
      AVAssetWriterInput.self, appendSelector, "B24@0:8^{opaqueCMSampleBuffer=}16")
    let finish = try method(AVAssetWriterInput.self, finishSelector, "v16@0:8")
    let ready = try method(AVAssetWriterInput.self, readySelector, "B16@0:8")
    typealias Start = @convention(c) (AnyObject, Selector) -> Bool
    typealias Append = @convention(c) (AnyObject, Selector, CMSampleBuffer) -> Bool
    typealias Finish = @convention(c) (AnyObject, Selector) -> Void
    typealias Ready = @convention(c) (AnyObject, Selector) -> Bool
    let originalStart = method_getImplementation(start)
    let originalAppend = method_getImplementation(append)
    let originalFinish = method_getImplementation(finish)
    let forwardStart = unsafeBitCast(originalStart, to: Start.self)
    let forwardAppend = unsafeBitCast(originalAppend, to: Append.self)
    let forwardFinish = unsafeBitCast(originalFinish, to: Finish.self)
    let originalReady = method_getImplementation(ready)
    let forwardReady = unsafeBitCast(originalReady, to: Ready.self)
    let startBlock: @convention(block) (AVAssetWriter) -> Bool = { writer in
      c.state.withLock { $0.active += 1 }
      defer { c.state.withLock { $0.active -= 1 } }
      let accepted = forwardStart(writer, startSelector)
      let url = writer.outputURL
      if accepted, url.lastPathComponent == "movie.mp4",
        url.deletingLastPathComponent().lastPathComponent.hasPrefix(".yap-output-"),
        url.deletingLastPathComponent().deletingLastPathComponent() == directory
      {
        c.state.withLock { value in
          value.writer = writer
          value.roles = Dictionary(
            uniqueKeysWithValues: writer.inputs.map { input in
              (
                ObjectIdentifier(input),
                input.mediaType == .video ? "video" : input.mediaType == .audio ? "audio" : "other"
              )
            })
        }
        c.record("started", "outer", writer, accepted)
      }
      return accepted
    }
    let appendBlock: @convention(block) (AVAssetWriterInput, CMSampleBuffer) -> Bool = {
      input, sample in
      c.state.withLock { $0.active += 1 }
      defer { c.state.withLock { $0.active -= 1 } }
      let selected = c.state.withLock { value -> (AVAssetWriter, String)? in
        guard let writer = value.writer, let role = value.roles[ObjectIdentifier(input)] else {
          return nil
        }
        return (writer, role)
      }
      guard let (writer, role) = selected else {
        return forwardAppend(input, appendSelector, sample)
      }
      c.record("append-enter", role, writer)
      let handoff = c.state.withLock { value in
        guard role == "video", value.audioFrames > 0, value.audioFrames < expectedAudioFrames,
          !value.audioFinished, !value.videoFinished,
          writer.status == .writing, !value.handoff, value.task != nil
        else { return false }
        value.handoff = true
        value.overlap = true
        if faultRequested { value.fault = .now }
        value.callerCanceledAtFault = value.task?.isCancelled
        return true
      }
      if handoff {
        c.record("qualified-handoff", role, writer)
        if faultRequested {
          c.record("fault-before-cancelWriting", role, writer)
          writer.cancelWriting()
          c.state.withLock { $0.faultStatus = writer.status.rawValue }
          c.record("fault-after-cancelWriting", role, writer)
        }
      }
      let accepted = forwardAppend(input, appendSelector, sample)
      c.state.withLock { value in
        if accepted {
          if role == "audio" {
            value.audio += 1
            value.audioFrames += CMSampleBufferGetNumSamples(sample)
          }
          if role == "video" { value.video += 1 }
        }
        if handoff && faultRequested { value.faultReturned = accepted }
      }
      c.record("append-return", role, writer, accepted)
      return accepted
    }
    let finishBlock: @convention(block) (AVAssetWriterInput) -> Void = { input in
      c.state.withLock { $0.active += 1 }
      defer { c.state.withLock { $0.active -= 1 } }
      forwardFinish(input, finishSelector)
      let selected = c.state.withLock { value -> (AVAssetWriter, String)? in
        guard let writer = value.writer, let role = value.roles[ObjectIdentifier(input)] else {
          return nil
        }
        if role == "audio" { value.audioFinished = true }
        if role == "video" { value.videoFinished = true }
        return (writer, role)
      }
      if let (writer, role) = selected { c.record("finished", role, writer) }
    }
    let readyBlock: @convention(block) (AVAssetWriterInput) -> Bool = { input in
      c.state.withLock { $0.active += 1 }
      defer { c.state.withLock { $0.active -= 1 } }
      let original = forwardReady(input, readySelector)
      let gate = c.state.withLock { value -> (AVAssetWriter, String, Bool)? in
        guard let writer = value.writer, let role = value.roles[ObjectIdentifier(input)],
          !value.handoff
        else { return nil }
        let held = role == "video" ? value.audio == 0 : role == "audio" && value.audio > 0
        guard held else { return nil }
        let first = role == "video" ? !value.videoGateObserved : !value.audioGateObserved
        if role == "video" {
          value.videoGateObserved = true
        } else {
          value.audioGateObserved = true
        }
        return (writer, role, first)
      }
      if let (writer, role, first) = gate {
        if first {
          c.record("controlled-ready-hold", role, writer, original, deliveredReady: false)
        }
        return false
      }
      return original
    }
    let blocks = [
      (start, originalStart, imp_implementationWithBlock(startBlock)),
      (append, originalAppend, imp_implementationWithBlock(appendBlock)),
      (finish, originalFinish, imp_implementationWithBlock(finishBlock)),
      (ready, originalReady, imp_implementationWithBlock(readyBlock)),
    ]
    for (m, _, replacement) in blocks { method_setImplementation(m, replacement) }
    methods = blocks
  }
  func attach(_ task: Task<Data, Never>) { counter.state.withLock { $0.task = task } }
  var state: State { counter.state.withLock { $0 } }
  func restore() {
    precondition(state.active == 0)
    for (m, original, replacement) in methods.reversed() {
      precondition(method_getImplementation(m) == replacement)
      method_setImplementation(m, original)
      precondition(method_getImplementation(m) == original)
      imp_removeBlock(replacement)
    }
    try? counter.log.close()
  }
}

func checkMoviePumpFailure(requestFile: String, faultRequested: Bool) async throws {
  let data = try Data(contentsOf: URL(fileURLWithPath: requestFile))
  let params = try JSONSerialization.jsonObject(with: data) as! [String: Any]
  let output = URL(fileURLWithPath: params["output"] as! String)
  let directory = output.deletingLastPathComponent()
  let assets = params["assets"] as! [[String: Any]]
  let paths = Set(assets.map { $0["path"] as! String } + [params["frames"] as! String]).sorted()
  func hashes() throws -> [String: String] {
    try Dictionary(
      uniqueKeysWithValues: paths.map {
        (
          $0,
          SHA256.hash(data: try Data(contentsOf: URL(fileURLWithPath: $0))).map {
            String(format: "%02x", $0)
          }.joined()
        )
      })
  }
  let before = try hashes()
  let line = String(
    data: try JSONSerialization.data(withJSONObject: [
      "id": "pump-fault", "operation": "media.renderCompositionMovie", "params": params,
    ]), encoding: .utf8)!
  let observer = try MoviePumps(
    directory: directory, faultRequested: faultRequested, expectedAudioFrames: 48_000)
  let work = Task { await NativeWire.respond(to: line) }
  observer.attach(work)
  let reply = await work.value
  let returned = ContinuousClock.now
  let state = observer.state
  observer.restore()
  let after = try hashes()
  let elapsed = state.fault.map { $0.duration(to: returned).components }
  let seconds = elapsed.map { Double($0.seconds) + Double($0.attoseconds) / 1e18 }
  let remaining = try FileManager.default.contentsOfDirectory(atPath: directory.path)
  let record: [String: Any] = [
    "controlledReadinessInterleave": true,
    "videoGateObserved": state.videoGateObserved, "audioGateObserved": state.audioGateObserved,
    "overlapObserved": state.overlap, "faultRequested": faultRequested,
    "faultTriggered": state.fault != nil,
    "faultWriterStatus": state.faultStatus as Any? ?? NSNull(),
    "faultToReplySeconds": seconds as Any? ?? NSNull(),
    "faultSDKReturned": state.faultReturned as Any? ?? NSNull(),
    "callerCanceledAtHandoff": state.callerCanceledAtFault as Any? ?? NSNull(),
    "callerCanceledAtReply": work.isCancelled,
    "sdkCallsActiveAtReply": state.active, "sourceBefore": before, "sourceAfter": after,
    "outputExists": FileManager.default.fileExists(atPath: output.path), "remaining": remaining,
    "methodRestored": true,
    "logError": state.logError as Any? ?? NSNull(),
  ]
  try reply.write(to: directory.appendingPathComponent("response.json"))
  try JSONSerialization.data(withJSONObject: record, options: [.prettyPrinted, .sortedKeys]).write(
    to: directory.appendingPathComponent("observation.json"))
  precondition(
    state.logError == nil && state.videoGateObserved && state.overlap,
    "Controlled fixture did not observe both pumps active at video append")
  precondition(state.callerCanceledAtFault == false && !work.isCancelled)
  precondition(state.active == 0 && before == after)
  precondition(
    !remaining.contains { $0.hasPrefix(".yap-output-") }, "Mux attempt leaked staging")
  let response = try JSONSerialization.jsonObject(with: reply) as! [String: Any]
  if faultRequested {
    let error = response["error"] as? [String: Any]
    precondition(
      state.fault != nil && state.faultReturned == false
        && state.faultStatus == AVAssetWriter.Status.cancelled.rawValue)
    precondition(
      response["ok"] as? Bool == false && error?["code"] as? String == "NATIVE_DECODE_FAILED")
    precondition(
      (error?["message"] as? String)?.hasPrefix("Cannot copy rendered video samples:") == true,
      "Sibling must preserve the first video append failure: \(response)")
    precondition(seconds! <= 3, "Sibling failure did not drain within original3s fault budget")
    precondition(
      !FileManager.default.fileExists(atPath: output.path), "Failed mux published output")
  } else {
    let result = response["data"] as? [String: Any]
    precondition(response["ok"] as? Bool == true && state.fault == nil)
    precondition(result?["durationUs"] as? Int == 1_000_000 && result?["frameCount"] as? Int == 20)
    precondition((result?["audio"] as? [String: Any])?["frames"] as? Int == 48_000)
    precondition(FileManager.default.fileExists(atPath: output.path))
  }
  print(
    "PASS controlled readiness interleave \(faultRequested ? "SDK video refusal" : "no-fault success"), drained mux, restored SDK methods and unchanged sources"
  )
}

@preconcurrency import AVFoundation
import Foundation
import Darwin
import ObjectiveC
import Synchronization
import ScreenRecorderCapture

/// Delegates the SDK call unchanged; the retry case faults receipt staging through filesystem permissions.
final class CameraReaderStarts: @unchecked Sendable {
    struct Clock: Codable, Sendable {
        let value: Int64; let timescale: Int32; let flags: UInt32; let epoch: Int64
        init(_ time: CMTime) { value = time.value; timescale = time.timescale; flags = time.flags.rawValue; epoch = time.epoch }
    }
    struct Reading: Codable, Sendable {
        let url: String; let role: String; let phase: String; let started: Bool
        let rangeStart: Clock; let rangeEnd: Clock; let hostUs: Int64
        let retainedView: String?; let retentionSeconds: Double
    }
    private struct Counts: Sendable {
        var raw = 0; var canonical = 0; var active = 0; var blocked = 0
        var snapshots = 0
        var retainedCounts: [String: Int] = [:]
        var stopping = false; var readings: [Reading] = []; var error: String?
    }
    private final class Counter: Sendable { let values = Mutex(Counts()) }
    private let counter = Counter()
    private let method: Method
    private let original: IMP
    private let replacement: IMP
    private let directoryMethod: Method
    private let directoryOriginal: IMP
    private let directoryReplacement: IMP
    private let log: FileHandle?
    init(directory: URL, blockPublication: Bool = false, logURL: URL? = nil,
        diagnosticDirectory: URL? = nil, beforeReading: (@Sendable (URL) -> Void)? = nil) throws {
        if let diagnosticDirectory {
            try FileManager.default.createDirectory(at: diagnosticDirectory, withIntermediateDirectories: false)
        }
        if let logURL {
            let fd = open(logURL.path, O_WRONLY | O_CREAT | O_EXCL | O_NOFOLLOW | O_CLOEXEC, 0o600)
            guard fd >= 0 else { throw CaptureFailure("OBSERVATION_FAILED", "Cannot create camera reader log.") }
            log = FileHandle(fileDescriptor: fd, closeOnDealloc: true)
        } else { log = nil }
        guard let method = class_getInstanceMethod(AVAssetReader.self, #selector(AVAssetReader.startReading)),
            let encoding = method_getTypeEncoding(method), String(cString: encoding) == "B16@0:8" else {
            throw CaptureFailure("UNSUPPORTED_OBSERVATION", "Unexpected SDK startReading ABI.")
        }
        self.method = method; original = method_getImplementation(method)
        typealias Start = @convention(c) (AnyObject, Selector) -> Bool
        let forward = unsafeBitCast(original, to: Start.self)
        let counter = self.counter
        let log = self.log
        let callback: @convention(block) (AVAssetReader) -> Bool = { reader in
            counter.values.withLock { $0.active += 1 }
            if let asset = reader.asset as? AVURLAsset,
                let scope = Self.resolved(directory), let path = Self.resolved(asset.url), path.hasPrefix(scope + "/") {
                beforeReading?(asset.url)
            }
            let started = forward(reader, #selector(AVAssetReader.startReading))
            if let asset = reader.asset as? AVURLAsset,
                let scope = Self.resolved(directory), let path = Self.resolved(asset.url), path.hasPrefix(scope + "/") {
                counter.values.withLock { state in
                    let name = asset.url.lastPathComponent
                    if started && name == "camera.raw.mov" { state.raw += 1 }
                    if started && name == "camera.mov" {
                        state.canonical += 1
                        if blockPublication, state.blocked == 0,
                            FileManager.default.fileExists(atPath: directory.appendingPathComponent("camera.closed.json").path),
                            chmod(directory.path, 0o500) == 0 { state.blocked = 1 }
                    }
                    let role = name == "camera.raw.mov" ? "raw" : name == "camera.mov" ? "canonical" : "published"
                    let phase = state.stopping ? "stop" : "acquisition"
                    let began = ContinuousClock.now
                    var retained: String?
                    if let diagnosticDirectory, asset.url.deletingLastPathComponent().lastPathComponent.hasPrefix(".camera-snapshot-") {
                        let key = role + "-" + phase
                        let count = state.retainedCounts[key, default: 0]
                        let destination = diagnosticDirectory.appendingPathComponent("unverified-\(key)-\(count % 2).mov")
                        do {
                            if FileManager.default.fileExists(atPath: destination.path) { try FileManager.default.removeItem(at: destination) }
                            try FileManager.default.linkItem(at: asset.url, to: destination)
                            state.retainedCounts[key] = count + 1; retained = destination.path
                        } catch { state.error = String(describing: error) }
                    }
                    let elapsed = began.duration(to: .now).components
                    let reading = Reading(url: asset.url.path, role: role, phase: phase, started: started,
                        rangeStart: Clock(reader.timeRange.start), rangeEnd: Clock(reader.timeRange.end), hostUs: CaptureHostTime.nowUs(),
                        retainedView: retained, retentionSeconds: Double(elapsed.seconds) + Double(elapsed.attoseconds) / 1e18)
                    state.readings.append(reading)
                    do { try log?.write(contentsOf: JSONEncoder().encode(reading) + Data([10])) }
                    catch { state.error = String(describing: error) }
                }
            }
            counter.values.withLock { $0.active -= 1 }
            return started
        }
        replacement = imp_implementationWithBlock(callback)
        let selector = NSSelectorFromString("createDirectoryAtURL:withIntermediateDirectories:attributes:error:")
        guard let directoryMethod = class_getInstanceMethod(FileManager.self, selector),
            let encoding = method_getTypeEncoding(directoryMethod), String(cString: encoding) == "B44@0:8@16B24@28^@36" else {
            imp_removeBlock(replacement)
            throw CaptureFailure("UNSUPPORTED_OBSERVATION", "Unexpected SDK directory ABI.")
        }
        self.directoryMethod = directoryMethod; directoryOriginal = method_getImplementation(directoryMethod)
        typealias Create = @convention(c) (AnyObject, Selector, NSURL, Bool, NSDictionary?, UnsafeMutableRawPointer?) -> Bool
        let create = unsafeBitCast(directoryOriginal, to: Create.self)
        let observeDirectory: @convention(block) (FileManager, NSURL, Bool, NSDictionary?, UnsafeMutableRawPointer?) -> Bool = { manager, url, intermediates, attributes, error in
            counter.values.withLock { $0.active += 1 }
            let created = create(manager, selector, url, intermediates, attributes, error)
            if created, (url as URL).lastPathComponent.hasPrefix(".camera-snapshot-"),
                let scope = Self.resolved(directory), let path = Self.resolved(url as URL), path.hasPrefix(scope + "/") {
                counter.values.withLock { $0.snapshots += 1 }
            }
            counter.values.withLock { $0.active -= 1 }
            return created
        }
        directoryReplacement = imp_implementationWithBlock(observeDirectory)
        method_setImplementation(method, replacement)
        method_setImplementation(directoryMethod, directoryReplacement)
    }
    var observed: [String: Int] { counter.values.withLock { ["raw": $0.raw, "canonical": $0.canonical, "active": $0.active, "blocked": $0.blocked, "snapshots": $0.snapshots] } }
    var readings: [Reading] { counter.values.withLock { $0.readings } }
    func retainActive(_ sources: [URL], in directory: URL) throws {
        for source in sources {
            guard let path = Self.resolved(source) else { throw CaptureFailure("OBSERVATION_FAILED", "Cannot resolve active camera media.") }
            let destination = directory.appendingPathComponent("unverified-before-stop-" + source.lastPathComponent)
            guard clonefile(path, destination.path, 0) == 0 else {
                throw CaptureFailure("OBSERVATION_FAILED", "Cannot isolate active camera diagnostic view.")
            }
        }
    }
    func markStop() { counter.values.withLock { $0.stopping = true } }
    func checkLog() throws {
        if let error = counter.values.withLock({ $0.error }) { throw CaptureFailure("OBSERVATION_FAILED", error) }
    }
    private static func resolved(_ url: URL) -> String? {
        guard let path = realpath(url.path, nil) else { return nil }
        defer { free(path) }
        return String(cString: path)
    }
    func restore() {
        precondition(counter.values.withLock { $0.active == 0 })
        precondition(method_getImplementation(method) == replacement)
        method_setImplementation(method, original)
        precondition(method_getImplementation(method) == original)
        imp_removeBlock(replacement)
        precondition(method_getImplementation(directoryMethod) == directoryReplacement)
        method_setImplementation(directoryMethod, directoryOriginal)
        precondition(method_getImplementation(directoryMethod) == directoryOriginal)
        imp_removeBlock(directoryReplacement)
        try? log?.close()
    }
}

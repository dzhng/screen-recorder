@preconcurrency import AVFoundation
import Darwin
import Foundation
import ScreenRecorderFrames
import ScreenRecorderMedia

func verifyDescriptorLifetime(source: URL, parent: URL) async throws {
    let directory = parent.appendingPathComponent("descriptor-lifetime-\(UUID().uuidString)")
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: false)
    defer { try? FileManager.default.removeItem(at: directory) }
    let copy = directory.appendingPathComponent("source.mp4")
    try FileManager.default.copyItem(at: source, to: copy)
    var identity = stat()
    precondition(stat(copy.path, &identity) == 0)
    func matchingHandles() -> Int {
        (0..<1024).filter { fd in
            var info = stat()
            return fstat(Int32(fd), &info) == 0 && info.st_dev == identity.st_dev
                && info.st_ino == identity.st_ino
        }.count
    }
    func retainedRead() async throws {
        var original = open(copy.path, O_RDONLY)
        precondition(original >= 0)
        defer { if original >= 0 { close(original) } }
        let frames = try await FrameSource(url: URL(fileURLWithPath: "/dev/fd/\(original)"))
        precondition(matchingHandles() == 2, "Input must retain one duplicate")
        close(original)
        original = -1
        try FileManager.default.removeItem(at: copy)
        _ = try await frames.decodeFrame(
            FrameRequest(
                atSourceUs: 700_000, kept: TimeSpan(startUs: 0, endUs: 3_000_000),
                output: directory.appendingPathComponent("frame.png")))
    }
    try await retainedRead()
    let deadline = ContinuousClock.now.advanced(by: .seconds(3))
    while matchingHandles() != 0 {
        precondition(ContinuousClock.now < deadline, "Retired source leaked its retained handle")
        try await Task.sleep(for: .milliseconds(2))
    }
    print("PASS descriptor source survives caller close/unlink and releases its duplicate")
}

@preconcurrency import AVFoundation
import Darwin
import Foundation
import ScreenRecorderAudio
import ScreenRecorderMedia

func verifyDescriptorLifetime(source: URL, parent: URL) async throws {
    let directory = parent.appendingPathComponent("descriptor-lifetime-\(UUID().uuidString)")
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: false)
    defer { try? FileManager.default.removeItem(at: directory) }
    let expectedFile = try AVAudioFile(
        forReading: source, commonFormat: .pcmFormatFloat32, interleaved: true)
    let expectedBuffer = AVAudioPCMBuffer(
        pcmFormat: expectedFile.processingFormat,
        frameCapacity: AVAudioFrameCount(expectedFile.length))!
    try expectedFile.read(into: expectedBuffer)
    let expected = Array(UnsafeBufferPointer(
        start: expectedBuffer.floatChannelData![0], count: Int(expectedBuffer.frameLength)))
    try expected.withUnsafeBufferPointer { buffer in
        try Data(buffer: buffer).write(to: parent.appendingPathComponent("descriptor-expected.f32"))
    }
    let copy = directory.appendingPathComponent("source.caf")
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
        let stream = try await AudioPCMStream.open(
            source: AudioSourceSelection(
                source: "/dev/fd/\(original)", sourceOffsetUs: ExactTime(0),
                available: [ExactRange(startUs: 0, endUs: 100_000)]),
            range: ExactRange(startUs: 0, endUs: 100_000))
        precondition(matchingHandles() == 2, "Input must retain one duplicate")
        close(original)
        original = -1
        try FileManager.default.removeItem(at: copy)
        var actual: [Float] = []
        try await stream.consume { block in actual.append(contentsOf: block.samples) }
        try actual.withUnsafeBufferPointer { buffer in
            try Data(buffer: buffer).write(to: parent.appendingPathComponent("descriptor-actual.f32"))
        }
        precondition(actual.count == 4_800 && actual == expected,
            "Selected source PCM must survive caller close and unlink without changing samples")
        precondition(actual.allSatisfy { $0.isFinite } && actual.contains { abs($0) > 0.05 },
            "Descriptor lifetime must cover actual nonzero PCM consumption")
    }
    try await retainedRead()
    let deadline = ContinuousClock.now.advanced(by: .seconds(3))
    while matchingHandles() != 0 {
        precondition(ContinuousClock.now < deadline, "Retired source leaked its retained handle")
        try await Task.sleep(for: .milliseconds(2))
    }
    print("PASS selected source retains one descriptor duplicate, decodes all 4800 unchanged PCM samples after caller close/unlink, and releases its duplicate")
}

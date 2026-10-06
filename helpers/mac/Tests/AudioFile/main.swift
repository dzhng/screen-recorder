import AVFoundation
import Darwin
import Foundation
import YapWire

@main
struct AudioFileTests {
    static func main() async throws {
        let input = CommandLine.arguments[1]
        let output = CommandLine.arguments[2]
        let parent = URL(fileURLWithPath: output).deletingLastPathComponent()
        let descriptor = open(input, O_RDONLY | O_CLOEXEC)
        precondition(descriptor >= 3)
        defer { close(descriptor) }
        let frames = try AVAudioFile(forReading: URL(fileURLWithPath: input)).length
        let request: [String: Any] = [
            "id": "cancel-after-staging", "operation": "media.encodeAudioFile",
            "params": [
                "source": "/dev/fd/\(descriptor)", "output": output,
                "input": ["sampleRate": 48000, "channels": 2, "frames": frames],
                "settings": [
                    "container": "m4a",
                    "audio": [
                        "codec": "aac", "sampleRate": 48000,
                        "layout": "stereo", "quality": "high",
                        "rateControl": ["mode": "constant", "bitrate": 192000],
                    ],
                ],
            ],
        ]
        let line = String(
            decoding: try JSONSerialization.data(withJSONObject: request), as: UTF8.self)
        let task = Task.detached { await NativeWire.respond(to: line) }
        var observed = false
        for _ in 0..<5000 {
            if try FileManager.default.contentsOfDirectory(atPath: parent.path).contains(where: {
                $0.hasPrefix(".yap-output-")
            }) {
                observed = true
                task.cancel()
                break
            }
            try await Task.sleep(for: .milliseconds(1))
        }
        precondition(observed, "Writer never reached its private staging")
        let reply = await task.value
        FileHandle.standardOutput.write(reply + Data([10]))
        let object = try JSONSerialization.jsonObject(with: reply) as! [String: Any]
        precondition(object["ok"] as? Bool == false, "Canceled task published output")
        precondition(!FileManager.default.fileExists(atPath: output))
        let remaining = try FileManager.default.contentsOfDirectory(atPath: parent.path)
        precondition(remaining.allSatisfy { !$0.hasPrefix(".yap-output-") })
        print(
            "PASS cancellation after allocated staging preserves absent final output and removes partial staging"
        )
    }
}

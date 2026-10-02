@preconcurrency import AVFoundation
import Foundation
import ScreenRecorderMedia

@main enum Inspect {
    static func main() async throws {
        let url = URL(fileURLWithPath: CommandLine.arguments[1])
        let asset = AVURLAsset(url: url)
        let tracks = try await asset.loadTracks(withMediaType: .video)
        precondition(tracks.count == 1)
        let track = tracks[0]
        let descriptions = try await track.load(.formatDescriptions)
        precondition(descriptions.count == 1)
        let format = descriptions[0]
        let codec = CMFormatDescriptionGetMediaSubType(format)
        precondition(codec == kCMVideoCodecType_H264, "Qualification requires H264")
        var parameterSets = 0
        var header: Int32 = 0
        let status = CMVideoFormatDescriptionGetH264ParameterSetAtIndex(format, parameterSetIndex: 0,
            parameterSetPointerOut: nil, parameterSetSizeOut: nil,
            parameterSetCountOut: &parameterSets, nalUnitHeaderLengthOut: &header)
        precondition(status == noErr && header == 4)
        let cursor = track.makeSampleCursor(presentationTimeStamp: .zero)!
        let bytes = try Data(contentsOf: url)
        var samples: [[String: Any]] = []
        repeat {
            let range = cursor.currentSampleStorageRange
            precondition(cursor.currentChunkStorageURL == url && range.offset >= 0 && range.length > 4)
            let start = Int(range.offset), end = Int(range.offset + range.length)
            precondition(end <= bytes.count)
            var offset = start
            var units: [[String: Int]] = []
            while offset < end {
                precondition(offset + 4 < end)
                let length = bytes[offset..<(offset + 4)].reduce(0) { ($0 << 8) | Int($1) }
                precondition(length > 0 && offset + 4 + length <= end)
                units.append(["lengthOffset": offset, "length": length, "type": Int(bytes[offset + 4] & 31)])
                offset += 4 + length
            }
            precondition(offset == end)
            samples.append(["ordinal": samples.count, "pts": cursor.presentationTimeStamp.value,
                "scale": cursor.presentationTimeStamp.timescale, "duration": cursor.currentSampleDuration.value,
                "durationScale": cursor.currentSampleDuration.timescale,
                "offset": range.offset, "length": range.length, "units": units])
        } while cursor.stepInPresentationOrder(byCount: 1) == 1
        precondition(samples.count == 3)
        let result: [String: Any] = ["codec": "avc1", "headerLength": header,
            "parameterSets": parameterSets, "samples": samples]
        let output = URL(fileURLWithPath: CommandLine.arguments[2])
        try JSONSerialization.data(withJSONObject: result, options: [.prettyPrinted, .sortedKeys]).write(to: output)
        let encoder = JSONEncoder(); encoder.outputFormatting = [.sortedKeys]
        try encoder.encode(await MediaProbe.inspect(url: url)).write(to: output.deletingLastPathComponent().appendingPathComponent("original-timing.json"))
        print("QUALIFIED H264 metadata: four-byte lengths, complete three-sample access-unit inventory; no decode")
    }
}

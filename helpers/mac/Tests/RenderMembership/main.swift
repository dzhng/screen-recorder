@preconcurrency import AVFoundation
import CoreImage
import Foundation

// A bounded SDK feasibility fixture, not the product renderer.
struct Interval: Codable {
    let startUs: Int64
    let endUs: Int64
}
struct Span: Codable {
    let source: Interval
    let playback: Interval
}
struct Request: Decodable {
    let source: String
    let outputDirectory: String
    let plan: [Span]
}
@main struct Probe {
    static func main() async throws {
        let request = try JSONDecoder().decode(
            Request.self, from: Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1])))
        let source = request.source
        let directory = request.outputDirectory
        let asset = AVURLAsset(url: URL(fileURLWithPath: source))
        let track = try await asset.loadTracks(withMediaType: .video).first!
        let segments = try await track.load(.segments)
        var ledger: [String: Any] = [
            "source": source, "durationUs": microseconds(try await asset.load(.duration)),
            "segments": segments.map {
                [
                    "empty": $0.isEmpty, "mediaStartUs": microseconds($0.timeMapping.source.start),
                    "mediaDurationUs": microseconds($0.timeMapping.source.duration),
                    "assetStartUs": microseconds($0.timeMapping.target.start),
                    "assetDurationUs": microseconds($0.timeMapping.target.duration),
                ]
            },
        ]
        var cursorRows: [[String: Any]] = []
        if let cursor = track.makeSampleCursorAtFirstSampleInDecodeOrder() {
            repeat {
                let segment = SourceSegment.occupied(of: segments).first(where: {
                    $0.media.containsTime(cursor.presentationTimeStamp)
                })
                cursorRows.append([
                    "ptsMediaUs": microseconds(cursor.presentationTimeStamp),
                    "dtsMediaUs": microseconds(cursor.decodeTimeStamp),
                    "durationMediaUs": microseconds(cursor.currentSampleDuration),
                    "ptsAssetUs": segment.map {
                        microseconds($0.assetTime(ofMedia: cursor.presentationTimeStamp))
                    } as Any? ?? NSNull(),
                ])
            } while cursor.stepInDecodeOrder(byCount: 1) != 0 && cursorRows.count < 100
        }
        ledger["cursor"] = cursorRows
        let reader = try AVAssetReader(asset: asset)
        let output = AVAssetReaderTrackOutput(
            track: track,
            outputSettings: [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA])
        output.alwaysCopiesSampleData = false
        reader.add(output)
        reader.startReading()
        var decoded: [[String: Any]] = []
        var buffers: [CVPixelBuffer] = []
        var support: [(Int64, Int64?)] = []
        while let sample = output.copyNextSampleBuffer() {
            let pts = CMSampleBufferGetPresentationTimeStamp(sample)
            let duration = CMSampleBufferGetDuration(sample)
            guard buffers.count < 16 else {
                fatalError("Fixture exceeds bounded sixteen-frame probe")
            }
            buffers.append(CMSampleBufferGetImageBuffer(sample)!)
            support.append(
                (
                    microseconds(pts),
                    assetEnd(
                        ofSamplePresentedAt: pts, in: SourceSegment.occupied(of: segments),
                        of: track
                    ).map { microseconds($0) }
                ))
            decoded.append([
                "ptsUs": microseconds(pts),
                "sampleDurationUs": duration.isNumeric ? microseconds(duration) : NSNull(),
                "provenEndUs": assetEnd(
                    ofSamplePresentedAt: pts, in: SourceSegment.occupied(of: segments), of: track
                ).map { microseconds($0) } as Any? ?? NSNull(),
            ])
        }
        ledger["decoded"] = decoded
        var events: [(Int, Int64, Int64)] = []
        var proven = true
        for span in request.plan {
            var through = span.source.startUs
            for (index, pair) in support.enumerated() {
                guard let end = pair.1 else { continue }
                let begin = max(pair.0, span.source.startUs)
                let finish = min(end, span.source.endUs)
                if begin < finish {
                    if begin != through { proven = false }
                    events.append(
                        (index, span.playback.startUs + begin - span.source.startUs, finish - begin)
                    )
                    through = finish
                }
            }
            if through != span.source.endUs { proven = false }
        }
        ledger["membership"] = [
            "fullyProven": proven,
            "events": events.map { ["sourceFrame": $0.0, "playbackUs": $0.1, "durationUs": $0.2] },
        ]
        ledger["plan"] = try JSONSerialization.jsonObject(with: JSONEncoder().encode(request.plan))
        let composition = AVMutableComposition()
        let destination = composition.addMutableTrack(
            withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid)!
        for span in request.plan {
            try destination.insertTimeRange(
                CMTimeRange(
                    start: time(microseconds: span.source.startUs),
                    duration: time(microseconds: span.source.endUs - span.source.startUs)),
                of: track, at: time(microseconds: span.playback.startUs))
        }
        let exporter = AVAssetExportSession(
            asset: composition, presetName: AVAssetExportPresetHighestQuality)!
        let compositionPath = directory + "/composition.mp4"
        do {
            try await exporter.export(to: URL(fileURLWithPath: compositionPath), as: .mp4)
            ledger["composition"] = try await inspect(compositionPath)
        } catch { ledger["composition"] = ["error": String(describing: error)] }
        if proven {
            let writerPath = directory + "/writer.mp4"
            let writer = try AVAssetWriter(
                outputURL: URL(fileURLWithPath: writerPath), fileType: .mp4)
            let input = AVAssetWriterInput(
                mediaType: .video,
                outputSettings: [
                    AVVideoCodecKey: AVVideoCodecType.h264,
                    AVVideoWidthKey: CVPixelBufferGetWidth(buffers[0]),
                    AVVideoHeightKey: CVPixelBufferGetHeight(buffers[0]),
                    AVVideoCompressionPropertiesKey: [AVVideoAllowFrameReorderingKey: false],
                ])
            input.mediaTimeScale = 1_000_000
            writer.add(input)
            let adaptor = AVAssetWriterInputPixelBufferAdaptor(
                assetWriterInput: input, sourcePixelBufferAttributes: nil)
            guard writer.startWriting() else { throw writer.error! }
            writer.startSession(atSourceTime: .zero)
            for (index, pts, _) in events {
                let deadline = Date().addingTimeInterval(10)
                while !input.isReadyForMoreMediaData {
                    guard Date() < deadline, writer.status == .writing else {
                        fatalError("Writer made no progress")
                    }
                    try await Task.sleep(nanoseconds: 1_000_000)
                }
                guard adaptor.append(buffers[index], withPresentationTime: time(microseconds: pts))
                else { throw writer.error! }
            }
            writer.endSession(atSourceTime: time(microseconds: request.plan.last!.playback.endUs))
            input.markAsFinished()
            await writer.finishWriting()
            ledger["writer"] = try await inspect(writerPath)
        } else {
            ledger["writer"] = [
                "unsupported": "Retained time has no proven nonempty sample support"
            ]
        }
        let bytes = try JSONSerialization.data(
            withJSONObject: ledger, options: [.prettyPrinted, .sortedKeys])
        try bytes.write(to: URL(fileURLWithPath: directory + "/ledger.json"))
    }
    static func inspect(_ path: String) async throws -> [String: Any] {
        let asset = AVURLAsset(url: URL(fileURLWithPath: path))
        guard let track = try await asset.loadTracks(withMediaType: .video).first else {
            return [
                "error": "Export contains no video track",
                "durationUs": microseconds(try await asset.load(.duration)),
            ]
        }
        let reader = try AVAssetReader(asset: asset)
        let output = AVAssetReaderTrackOutput(
            track: track,
            outputSettings: [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA])
        reader.add(output)
        reader.startReading()
        var rows: [[String: Any]] = []
        while let sample = output.copyNextSampleBuffer() {
            rows.append([
                "ptsUs": microseconds(CMSampleBufferGetPresentationTimeStamp(sample)),
                "durationUs": CMSampleBufferGetDuration(sample).isNumeric
                    ? microseconds(CMSampleBufferGetDuration(sample)) : NSNull(),
            ])
        }
        return [
            "file": path, "durationUs": microseconds(try await asset.load(.duration)),
            "samples": rows,
        ]
    }
}

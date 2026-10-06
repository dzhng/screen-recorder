import Foundation
import YapAudio
import YapMedia

/// The service owns WAV validation and supplies the pinned descriptor, never a pathname.
struct RetainedAudioInput: Codable {
    let descriptor: Int32
    let identity: ArchiveOperation.FileVersion
    let bytes: Int64
    let dataOffset: Int64
    let frames: Int64
    let range: CompositionAudioPlan.Samples
    let unavailable: [CompositionAudioReport.Missing]

    func open(expected: CompositionAudioPlan.Samples) throws -> RetainedPCMSource {
        guard range == expected, try ArchiveOperation.FileVersion(of: descriptor) == identity else {
            throw NativeFailure("ARTIFACT_CHANGED", "Retained PCM identity or selected range changed.")
        }
        return try RetainedPCMSource(descriptor: descriptor, bytes: bytes, dataOffset: dataOffset,
                                     frames: frames, range: range, unavailable: unavailable)
    }
}

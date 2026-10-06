@preconcurrency import AVFoundation
import YapMedia

/// Color admission shared by raw-source and compiled pictures.
enum VideoColorPolicy {
    static func requireSupportedColor(_ track: AVAssetTrack) async throws {
        for format in try await track.load(.formatDescriptions) {
            let color = ProbedVideoColor(format)
            func permits(_ actual: String?, _ supported: [CFString]) -> Bool {
                guard let actual else { return true }
                return supported.contains { ($0 as String) == actual }
            }
            guard
                color.invalidColorDeclarations.isEmpty,
                permits(color.colorPrimaries, [kCMFormatDescriptionColorPrimaries_ITU_R_709_2]),
                permits(color.transferFunction, [
                    kCMFormatDescriptionTransferFunction_ITU_R_709_2,
                    kCMFormatDescriptionTransferFunction_sRGB,
                ]),
                permits(color.ycbcrMatrix, [
                    kCMFormatDescriptionYCbCrMatrix_ITU_R_709_2,
                    kCMFormatDescriptionYCbCrMatrix_ITU_R_601_4,
                ]),
                color.interpretationExtensions.isEmpty
            else {
                throw NativeFailure("NOT_READY",
                    "Source color profile requires an explicit HDR, wide-gamut or custom-profile conversion."
                )
            }
        }
    }

}

@preconcurrency import AVFoundation
import ScreenRecorderMedia

/// Color admission shared by raw-source and compiled pictures.
enum VideoColorPolicy {
    static func requireSupportedColor(_ track: AVAssetTrack) async throws {
        for format in try await track.load(.formatDescriptions) {
            func value(_ key: CFString) -> CFPropertyList? {
                CMFormatDescriptionGetExtension(format, extensionKey: key)
            }
            func permits(_ key: CFString, _ supported: [CFString]) -> Bool {
                guard let actual = value(key) else { return true }
                return (actual as? String).map { text in
                    supported.contains { ($0 as String) == text }
                } ?? false
            }
            guard
                permits(
                    kCMFormatDescriptionExtension_ColorPrimaries,
                    [kCMFormatDescriptionColorPrimaries_ITU_R_709_2]),
                permits(
                    kCMFormatDescriptionExtension_TransferFunction,
                    [
                        kCMFormatDescriptionTransferFunction_ITU_R_709_2,
                        kCMFormatDescriptionTransferFunction_sRGB,
                    ]),
                permits(
                    kCMFormatDescriptionExtension_YCbCrMatrix,
                    [
                        kCMFormatDescriptionYCbCrMatrix_ITU_R_709_2,
                        kCMFormatDescriptionYCbCrMatrix_ITU_R_601_4,
                    ]),
                [
                    kCMFormatDescriptionExtension_ICCProfile,
                    kCMFormatDescriptionExtension_GammaLevel,
                    kCMFormatDescriptionExtension_AlternativeTransferCharacteristics,
                    kCMFormatDescriptionExtension_LogTransferFunction,
                    kCMFormatDescriptionExtension_MasteringDisplayColorVolume,
                    kCMFormatDescriptionExtension_ContentLightLevelInfo,
                ]
                .allSatisfy({ value($0) == nil })
            else {
                throw NativeFailure("NOT_READY",
                    "Source color profile requires an explicit HDR, wide-gamut or custom-profile conversion."
                )
            }
        }
    }

}

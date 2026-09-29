import CoreText
import CryptoKit
import Foundation

public struct FontAssetBinding: Codable, Sendable {
    public let assetId: String
    public let path: String
}

public enum FontFile {
    static func descriptors(_ data: Data) throws -> [CTFontDescriptor] {
        guard let descriptors = CTFontManagerCreateFontDescriptorsFromData(data as CFData)
            as? [CTFontDescriptor], !descriptors.isEmpty, descriptors.count <= 256 else {
            throw NativeFailure("UNSUPPORTED_MEDIA", "Font bytes must contain between 1 and 256 faces.")
        }
        var names = Set<String>()
        for descriptor in descriptors {
            guard let name = CTFontDescriptorCopyAttribute(descriptor, kCTFontNameAttribute) as? String,
                !name.isEmpty, names.insert(name).inserted else {
                throw NativeFailure("UNSUPPORTED_MEDIA", "Font faces require unique PostScript names within the file.")
            }
        }
        return descriptors
    }

    public static func load(_ binding: FontAssetBinding, postScriptName: String, size: Double) throws -> CTFont {
        let data = try Data(contentsOf: URL(fileURLWithPath: binding.path), options: .mappedIfSafe)
        let digest = SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
        guard digest == binding.assetId else { throw NativeFailure("UNSUPPORTED_MEDIA", "FONT_CHANGED") }
        let matches = try descriptors(data).filter {
            CTFontDescriptorCopyAttribute($0, kCTFontNameAttribute) as? String == postScriptName
        }
        guard matches.count == 1 else { throw NativeFailure("UNSUPPORTED_MEDIA", "FONT_UNAVAILABLE: \(postScriptName)") }
        let font = CTFontCreateWithFontDescriptor(matches[0], size, nil)
        guard CTFontCopyPostScriptName(font) as String == postScriptName else {
            throw NativeFailure("UNSUPPORTED_MEDIA", "FONT_SUBSTITUTED: \(CTFontCopyPostScriptName(font))")
        }
        return font
    }
}

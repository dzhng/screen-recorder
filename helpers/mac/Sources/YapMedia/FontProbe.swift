import CoreText
import Foundation

public struct ProbedFontFace: Encodable, Sendable {
    public let postScriptName: String
    public let familyName: String
    public let styleName: String?
}

enum FontProbe {
    static func inspect(url: URL) throws -> [ProbedFontFace]? {
        guard CTFontManagerCreateFontDescriptorsFromURL(url as CFURL) != nil else { return nil }
        // Only the hashed data fork supplies faces; URL/resource-fork or installed-font state is not a dependency.
        let data = try Data(contentsOf: url, options: .mappedIfSafe)
        let descriptors = try FontFile.descriptors(data)
        var faces: [ProbedFontFace] = []
        for descriptor in descriptors {
            try Task.checkCancellation()
            guard let name = CTFontDescriptorCopyAttribute(descriptor, kCTFontNameAttribute)
                as? String, !name.isEmpty else {
                throw NativeFailure("UNSUPPORTED_MEDIA", "Font faces require unique PostScript names within the file.")
            }
            let font = CTFontCreateWithFontDescriptor(descriptor, 12, nil)
            guard CTFontCopyPostScriptName(font) as String == name else {
                throw NativeFailure("UNSUPPORTED_MEDIA", "Font face could not be resolved from its file descriptor.")
            }
            faces.append(ProbedFontFace(
                postScriptName: name, familyName: CTFontCopyFamilyName(font) as String,
                styleName: CTFontCopyName(font, kCTFontStyleNameKey) as String?))
        }
        return faces.sorted { $0.postScriptName < $1.postScriptName }
    }
}

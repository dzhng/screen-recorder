import CoreImage
import CoreVideo
import Foundation

public struct OrientedPixelBounds: Codable, Sendable {
    public let x: Double
    public let y: Double
    public let width: Double
    public let height: Double
    public init(x: Double, y: Double, width: Double, height: Double) {
        self.x = x
        self.y = y
        self.width = width
        self.height = height
    }
}

/// Raster domain and transformed encoded rectangle come from the same orientation operation.
/// The latter preserves affine-fusion placement when the raster domain includes rounded padding.
public func videoDisplayGeometry(size: CGSize, transform: CGAffineTransform) -> (
    extent: CGSize, pixelBounds: OrientedPixelBounds
) {
    let image = CIImage(color: .clear).cropped(to: CGRect(origin: .zero, size: size))
    let geometry = orient(image, transform: transform)
    let bounds = geometry.pixelBounds
    return (
        geometry.image.extent.size,
        OrientedPixelBounds(
            x: bounds.minX,
            y: geometry.image.extent.height - bounds.maxY, width: bounds.width,
            height: bounds.height)
    )
}

public func orientedVideoImage(_ buffer: CVPixelBuffer, transform: CGAffineTransform) -> CIImage {
    orientedVideoImage(CIImage(cvPixelBuffer: buffer), transform: transform)
}

/// Display-coordinate orientation shared by still delivery and full-canvas rendering.
public func orientedVideoImage(_ decoded: CIImage, transform: CGAffineTransform) -> CIImage {
    // Preserve whole boundary pixels before orientation rather than cropping to their centers.
    let bounded = decoded.clampedToExtent().cropped(to: decoded.extent)
    return orient(bounded, transform: transform).image
}

private func orient(_ decoded: CIImage, transform: CGAffineTransform) -> (
    image: CIImage, pixelBounds: CGRect
) {
    // A track's preferred transform is stated in display coordinates, where y grows downward;
    // Core Image grows y upward, so applying it directly turns a quarter turn into a
    // three-quarter turn. Flipping into and out of display space keeps both agreeing.
    let flipDecoded = CGAffineTransform(
        a: 1, b: 0, c: 0, d: -1, tx: 0, ty: decoded.extent.height)
    let displayed = decoded.extent.applying(transform)
    let flipDisplayed = CGAffineTransform(a: 1, b: 0, c: 0, d: -1, tx: 0, ty: displayed.height)
    let matrix = flipDecoded.concatenating(transform).concatenating(flipDisplayed)
    let oriented = decoded.transformed(by: matrix)
    let normalize = CGAffineTransform(
        translationX: -oriented.extent.origin.x, y: -oriented.extent.origin.y)
    return (
        oriented.transformed(by: normalize), decoded.extent.applying(matrix).applying(normalize)
    )
}

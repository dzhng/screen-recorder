import CoreGraphics

/**
 Turns a drag across one display into the rectangle a capture start carries. The native capture
 contract states a region in the display's own points with a top-left origin, so the conversion
 from AppKit's bottom-left drag coordinates happens once, here, and nothing downstream flips it
 again. This is the whole of region selection's geometry: there is no drawing, stroke or shape.
 */
public enum RegionGeometry {
    /// Ignore a drag this small: it is a click that happened to move, not a chosen rectangle.
    public static let minimumSide: CGFloat = 16

    /// The chosen rectangle in display-local top-left points, or nil when the drag was too small
    /// to be a selection. Points outside the display are clamped to it, so a drag that leaves the
    /// screen selects the edge rather than a rectangle the display does not contain.
    public static func region(
        from start: CGPoint, to end: CGPoint, inDisplayOfSize size: CGSize
    ) -> CGRect? {
        let left = clamp(min(start.x, end.x), 0, size.width)
        let right = clamp(max(start.x, end.x), 0, size.width)
        let bottom = clamp(min(start.y, end.y), 0, size.height)
        let top = clamp(max(start.y, end.y), 0, size.height)
        let width = right - left
        let height = top - bottom
        guard width >= minimumSide, height >= minimumSide else { return nil }
        return CGRect(x: left, y: size.height - top, width: width, height: height)
    }

    /// The rectangle to highlight while dragging, in the same bottom-left coordinates the drag
    /// arrives in. Selection draws this and nothing else.
    public static func highlight(from start: CGPoint, to end: CGPoint) -> CGRect {
        CGRect(
            x: min(start.x, end.x), y: min(start.y, end.y),
            width: abs(end.x - start.x), height: abs(end.y - start.y))
    }

    private static func clamp(_ value: CGFloat, _ low: CGFloat, _ high: CGFloat) -> CGFloat {
        min(max(value, low), high)
    }
}

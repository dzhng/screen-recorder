import CoreGraphics
import Foundation

/// Rasterizes the supplied pointer and trail into a transparent image the size of the oriented
/// source frame, so the caller can composite it before cropping and scaling.
///
/// Every coordinate and time comes from the core. Nothing here selects history, decides a cutoff,
/// interpolates a missing sample or joins one run of points to the next.
enum CursorOverlay {
    /// Pointer height as a share of the source long edge. A real macOS pointer covers about this
    /// much of a Retina display, and sizing against the source keeps both marks proportional after
    /// the frame is bounded to its requested long edge.
    private static let pointerShare = 0.012
    private static let trailShare = 0.0025
    /// Magenta: neither the recorded surfaces nor the fixture's own markers use it, so the trail
    /// reads as an annotation rather than as content.
    private static let trailColor = CGColor(red: 1, green: 0.22, blue: 0.70, alpha: 1)
    private static let newestAlpha = 0.95
    private static let oldestAlpha = 0.15
    /// Segments are stroked in age bands rather than one at a time: overlapping round caps on every
    /// 60 Hz segment would bead the trail with darker joints.
    private static let bands = 12

    /// One run of points sharing an age band, drawn as a single polyline.
    private struct Stroke {
        let alpha: Double
        let points: [CGPoint]
    }

    static func image(_ overlay: FrameOverlay, agedFromUs: Int64, width: Int, height: Int)
        throws -> CGImage?
    {
        guard width > 0, height > 0 else {
            throw FrameFailure("NATIVE_DECODE_FAILED", "Overlay raster has no pixels.")
        }
        guard overlay.pointer != nil || overlay.trail.contains(where: { !$0.isEmpty }) else {
            return nil
        }
        guard
            let context = CGContext(
                data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: 0,
                space: CGColorSpaceCreateDeviceRGB(),
                bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)
        else {
            throw FrameFailure("NATIVE_DECODE_FAILED", "Cannot allocate the cursor overlay raster.")
        }
        // Overlay points are stated in top-left source pixels; Core Graphics grows y upward.
        context.translateBy(x: 0, y: CGFloat(height))
        context.scaleBy(x: 1, y: -1)
        context.setLineCap(.round)
        context.setLineJoin(.round)
        let longEdge = Double(max(width, height))
        let core = max(2, (longEdge * trailShare).rounded())
        let strokes = strokes(for: overlay, agedFromUs: agedFromUs)
        // The whole trail is haloed before any of it is coloured, so one run crossing another is
        // never buried under the second run's dark outline. That outline is what keeps a thin
        // stroke legible over a light button and over dark text alike.
        draw(strokes, in: context, width: core + max(2, (core * 0.8).rounded()),
            color: CGColor(red: 0, green: 0, blue: 0, alpha: 1), alphaShare: 0.6)
        draw(strokes, in: context, width: core, color: trailColor, alphaShare: 1)
        if let pointer = overlay.pointer {
            drawPointer(
                context, at: CGPoint(x: pointer.x, y: pointer.y),
                size: max(16, (longEdge * pointerShare).rounded()))
        }
        guard let image = context.makeImage() else {
            throw FrameFailure("NATIVE_DECODE_FAILED", "Cannot produce the cursor overlay image.")
        }
        return image
    }

    private static func strokes(for overlay: FrameOverlay, agedFromUs: Int64) -> [Stroke] {
        var strokes: [Stroke] = []
        for run in overlay.trail {
            let aged = run.map {
                (
                    point: CGPoint(x: $0.x, y: $0.y),
                    band: band(of: $0, agedFromUs: agedFromUs, trailUs: overlay.trailUs)
                )
            }
            guard let first = aged.first else { continue }
            guard aged.count > 1 else {
                strokes.append(Stroke(alpha: alpha(inBand: first.band), points: [first.point]))
                continue
            }
            var open: (band: Int, points: [CGPoint])?
            for (previous, next) in zip(aged, aged.dropFirst()) {
                let band = (previous.band + next.band + 1) / 2
                if open?.band != band {
                    if let closing = open {
                        strokes.append(
                            Stroke(alpha: alpha(inBand: closing.band), points: closing.points))
                    }
                    // A new band reopens at the point the previous one ended on, so consecutive
                    // bands meet instead of leaving a hole in the path.
                    open = (band, [previous.point])
                }
                open?.points.append(next.point)
            }
            if let closing = open {
                strokes.append(Stroke(alpha: alpha(inBand: closing.band), points: closing.points))
            }
        }
        return strokes
    }

    private static func draw(
        _ strokes: [Stroke], in context: CGContext, width: Double, color: CGColor, alphaShare: Double
    ) {
        for stroke in strokes {
            let faded = color.copy(alpha: stroke.alpha * alphaShare) ?? color
            guard stroke.points.count > 1 else {
                // A run of one point is a real observation with nothing to connect it to.
                context.setFillColor(faded)
                context.fillEllipse(
                    in: CGRect(
                        x: stroke.points[0].x - width / 2, y: stroke.points[0].y - width / 2,
                        width: width, height: width))
                continue
            }
            context.setStrokeColor(faded)
            context.setLineWidth(width)
            context.beginPath()
            context.addLines(between: stroke.points)
            context.strokePath()
        }
    }

    /// A point's age band, oldest last. Points at or after the requested frame time are newest: the
    /// pointer sample nearest that time can legitimately sit just after it.
    private static func band(of point: CursorPoint, agedFromUs: Int64, trailUs: Int64) -> Int {
        guard trailUs > 0 else { return 0 }
        let age = max(0, agedFromUs - point.atSourceUs)
        return min(bands - 1, Int(Double(age) / Double(trailUs) * Double(bands)))
    }

    private static func alpha(inBand band: Int) -> Double {
        newestAlpha - (newestAlpha - oldestAlpha) * ((Double(band) + 0.5) / Double(bands))
    }

    /// An arrow whose tip is the hot spot and whose body extends down and to the right. The shape
    /// is deliberately asymmetric: a mirrored or transposed render is visible rather than plausible.
    private static func drawPointer(_ context: CGContext, at hotSpot: CGPoint, size: Double) {
        let outline = [
            (0.0, 0.0), (0.0, 0.75), (0.19, 0.58), (0.31, 0.88), (0.45, 0.82), (0.33, 0.53),
            (0.56, 0.52),
        ].map { CGPoint(x: hotSpot.x + $0.0 * size, y: hotSpot.y + $0.1 * size) }
        context.beginPath()
        context.addLines(between: outline)
        context.closePath()
        context.setFillColor(CGColor(red: 1, green: 1, blue: 1, alpha: 1))
        context.setStrokeColor(CGColor(red: 0, green: 0, blue: 0, alpha: 1))
        context.setLineWidth(max(1, size * 0.08))
        context.drawPath(using: .fillStroke)
    }
}

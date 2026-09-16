import AppKit
import ScreenRecorderControls

/**
 A schematic rendering of the menu's current values for copy and state inspection.
 This manually draws rows and symbols; it is not a native menu screenshot and cannot verify
 AppKit layout, tracking, or the real status bar. It captures nothing outside this process.
 */
@MainActor
enum MenuImage {
    private static let rowHeight: CGFloat = 22
    private static let separatorHeight: CGFloat = 11
    private static let corner: CGFloat = 10
    private static let inset: CGFloat = 5
    private static let leading: CGFloat = 24
    private static let trailing: CGFloat = 26
    private static let gap: CGFloat = 26
    private static let barHeight: CGFloat = 32
    private static let margin: CGFloat = 16

    static func png(
        of menu: NSMenu, statusSymbol: String, statusTitle: String, recording: Bool,
        opening path: [String] = [], scale: CGFloat = 2
    ) -> Data? {
        // One panel per menu the path opens, each remembering the row that opened the next.
        var panels: [(row: Int?, panel: Panel)] = [(nil, Panel(menu: menu))]
        var current = menu
        for title in path {
            guard let row = current.items.firstIndex(where: { $0.title == title }),
                let submenu = current.items[row].submenu
            else { break }
            panels[panels.count - 1].row = row
            panels.append((nil, Panel(menu: submenu)))
            current = submenu
        }
        var tops: [CGFloat] = [0]
        for (index, entry) in panels.enumerated().dropLast() {
            tops.append(tops[index] + (entry.row.map { entry.panel.offset(ofRow: $0) } ?? 0))
        }
        let width =
            margin * 2 + panels.reduce(0) { $0 + $1.panel.width } + gap * CGFloat(panels.count - 1)
        let height =
            margin * 2 + barHeight
            + zip(tops, panels).reduce(0) { max($0, $1.0 + $1.1.panel.height) }
        return draw(width: width, height: height, scale: scale) { bounds in
            NSColor(white: 0.12, alpha: 1).setFill()
            bounds.fill()
            drawStatusBar(
                in: NSRect(
                    x: margin, y: bounds.maxY - margin - barHeight, width: panels[0].panel.width,
                    height: barHeight), symbol: statusSymbol, title: statusTitle,
                recording: recording)
            let menuTop = bounds.maxY - margin - barHeight - 4
            var x = margin
            for (index, entry) in panels.enumerated() {
                entry.panel.draw(
                    at: NSPoint(x: x, y: menuTop - tops[index] - entry.panel.height),
                    highlighting: entry.row)
                x += entry.panel.width + gap
            }
        }
    }

    private static func drawStatusBar(
        in rect: NSRect, symbol: String, title: String, recording: Bool
    ) {
        NSColor(white: 0.22, alpha: 1).setFill()
        NSBezierPath(roundedRect: rect, xRadius: 6, yRadius: 6).fill()
        let tint: NSColor = recording ? .systemRed : .white
        var x = rect.minX + 10
        if let image = NSImage(systemSymbolName: symbol, accessibilityDescription: nil)?
            .withSymbolConfiguration(.init(pointSize: 15, weight: .regular))
        {
            let tinted = NSImage(size: image.size, flipped: false) { frame in
                image.draw(in: frame)
                tint.set()
                frame.fill(using: .sourceAtop)
                return true
            }
            tinted.draw(
                in: NSRect(
                    x: x, y: rect.midY - image.size.height / 2, width: image.size.width,
                    height: image.size.height))
            x += image.size.width + 5
        }
        guard !title.isEmpty else { return }
        (title as NSString).draw(
            at: NSPoint(x: x, y: rect.midY - 8),
            withAttributes: [
                .font: NSFont.monospacedDigitSystemFont(ofSize: 13, weight: .regular),
                .foregroundColor: tint,
            ])
    }

    private static func draw(
        width: CGFloat, height: CGFloat, scale: CGFloat, _ body: (NSRect) -> Void
    ) -> Data? {
        guard
            let bitmap = NSBitmapImageRep(
                bitmapDataPlanes: nil, pixelsWide: Int(width * scale), pixelsHigh: Int(height * scale),
                bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
                colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0),
            let context = NSGraphicsContext(bitmapImageRep: bitmap)
        else { return nil }
        bitmap.size = NSSize(width: width, height: height)
        NSGraphicsContext.saveGraphicsState()
        NSGraphicsContext.current = context
        context.cgContext.scaleBy(x: scale, y: scale)
        body(NSRect(x: 0, y: 0, width: width, height: height))
        NSGraphicsContext.restoreGraphicsState()
        return bitmap.representation(using: .png, properties: [:])
    }

    /// One menu's rows, measured and drawn the way AppKit lays a menu out.
    @MainActor
    private struct Panel {
        let menu: NSMenu
        let width: CGFloat
        let height: CGFloat

        init(menu: NSMenu) {
            self.menu = menu
            let widest = menu.items.reduce(CGFloat(120)) { widest, item in
                var needed = Panel.title(of: item).size(withAttributes: Panel.attributes(of: item)).width
                if !item.keyEquivalent.isEmpty {
                    needed += 18 + Panel.shortcut(of: item).size(withAttributes: Panel.shortcutAttributes).width
                }
                return max(widest, needed)
            }
            width = leading + widest + trailing
            height = inset * 2 + menu.items.reduce(0) { $0 + Panel.height(of: $1) }
        }

        func offset(ofRow row: Int) -> CGFloat {
            inset + menu.items.prefix(row).reduce(0) { $0 + Panel.height(of: $1) }
        }

        func draw(at origin: NSPoint, highlighting row: Int? = nil) {
            let frame = NSRect(x: origin.x, y: origin.y, width: width, height: height)
            NSColor(white: 0.18, alpha: 1).setFill()
            let shape = NSBezierPath(roundedRect: frame, xRadius: corner, yRadius: corner)
            shape.fill()
            NSColor(white: 0.32, alpha: 1).setStroke()
            shape.lineWidth = 1
            shape.stroke()
            var y = frame.maxY - inset
            for (index, item) in menu.items.enumerated() {
                let rowHeight = Panel.height(of: item)
                let bounds = NSRect(x: frame.minX, y: y - rowHeight, width: width, height: rowHeight)
                Panel.draw(item, in: bounds, highlighted: index == row)
                y -= rowHeight
            }
        }

        private static func height(of item: NSMenuItem) -> CGFloat {
            item.isSeparatorItem ? separatorHeight : rowHeight
        }

        private static func title(of item: NSMenuItem) -> NSString {
            item.title as NSString
        }

        private static func shortcut(of item: NSMenuItem) -> NSString {
            var written = ""
            let flags = item.keyEquivalentModifierMask
            if flags.contains(.control) { written += "⌃" }
            if flags.contains(.option) { written += "⌥" }
            if flags.contains(.shift) { written += "⇧" }
            if flags.contains(.command) { written += "⌘" }
            return (written + item.keyEquivalent.uppercased()) as NSString
        }

        private static var shortcutAttributes: [NSAttributedString.Key: Any] {
            [.font: NSFont.menuFont(ofSize: 0), .foregroundColor: NSColor(white: 0.62, alpha: 1)]
        }

        private static func attributes(of item: NSMenuItem) -> [NSAttributedString.Key: Any] {
            if item.isSectionHeader {
                return [
                    .font: NSFont.systemFont(ofSize: 11, weight: .semibold),
                    .foregroundColor: NSColor(white: 0.60, alpha: 1),
                ]
            }
            return [
                .font: NSFont.menuFont(ofSize: 0),
                .foregroundColor: item.isEnabled
                    ? NSColor.white : NSColor(white: 0.45, alpha: 1),
            ]
        }

        private static func draw(_ item: NSMenuItem, in bounds: NSRect, highlighted: Bool) {
            if item.isSeparatorItem {
                NSColor(white: 0.35, alpha: 1).setFill()
                NSRect(x: bounds.minX + 12, y: bounds.midY, width: bounds.width - 24, height: 1).fill()
                return
            }
            if highlighted {
                NSColor.controlAccentColor.setFill()
                NSBezierPath(
                    roundedRect: bounds.insetBy(dx: inset, dy: 1), xRadius: 5, yRadius: 5
                ).fill()
            }
            let baseline = bounds.midY - 8
            if item.state == .on {
                ("✓" as NSString).draw(
                    at: NSPoint(x: bounds.minX + 8, y: baseline),
                    withAttributes: [
                        .font: NSFont.menuFont(ofSize: 0), .foregroundColor: NSColor.white,
                    ])
            }
            let indent = item.isSectionHeader ? leading - 10 : leading
            title(of: item).draw(
                at: NSPoint(x: bounds.minX + indent, y: baseline), withAttributes: attributes(of: item))
            if item.submenu != nil {
                ("›" as NSString).draw(
                    at: NSPoint(x: bounds.maxX - 18, y: baseline),
                    withAttributes: [
                        .font: NSFont.menuFont(ofSize: 0),
                        .foregroundColor: item.isEnabled ? NSColor.white : NSColor(white: 0.45, alpha: 1),
                    ])
            } else if !item.keyEquivalent.isEmpty {
                let written = shortcut(of: item)
                written.draw(
                    at: NSPoint(
                        x: bounds.maxX - 14 - written.size(withAttributes: shortcutAttributes).width,
                        y: baseline), withAttributes: shortcutAttributes)
            }
        }
    }
}

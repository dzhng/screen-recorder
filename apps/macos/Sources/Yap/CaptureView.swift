import AppKit
import YapControls

/// Presentation requests. Existing operations retain ControlsAction; new source/device intents
/// are admitted by RecordingControls when the production shell binds this view.
enum CaptureViewIntent: Equatable {
    case controls(ControlsAction)
    case chooseSource(CaptureViewInput.Source)
    case camera(String?)
    case cameraEnabled(Bool)
    case countdown(Bool)
    case openLibrary
}

/// Immutable rendering facts, never an owner of selections, permission, recording state or time.
struct CaptureViewInput: Equatable {
    enum Source: String, CaseIterable { case display, window, area, cameraOnly }
    struct Choice: Equatable {
        let title: String
        let intent: CaptureViewIntent
    }
    let selectedSource: Source
    let selectedSourceChoice: Int
    let sourceChoices: [Choice]
    let cameraChoices: [Choice]
    let selectedCamera: Int
    let cameraOn: Bool
    let microphoneChoices: [Choice]
    let selectedMicrophone: Int
    let microphoneOn: Bool
    let systemAudio: Bool
    let countdown: Bool
    let inputsEnabled: Bool
    let startEnabled: Bool
    let status: String
    var screenSourcesEnabled = true
    var notices: [String] = []
    var permissionActions: [PresentedControlsAction] = []
    var transport: [PresentedControlsAction] = []
    var startTitle: String = "Start Recording"
    var startShortcut: String? = nil
}

/// The production capture surface. Its caller supplies a fresh value after any accepted action.
/// Scrolling preserves approved control sizes when the native container has less vertical room.
@MainActor
final class CaptureView: NSView {
    static let preferredWidth: CGFloat = 352
    private(set) var input: CaptureViewInput
    private let perform: (CaptureViewIntent) -> Void
    private let appIcon: NSImage?
    let scrollView = NSScrollView()
    private let document = CaptureDocument()
    private let footer = CaptureDocument()
    private static let footerHeight: CGFloat = 62
    private var controls: [String: NSControl] = [:]
    private var intents: [ObjectIdentifier: CaptureViewIntent] = [:]
    private var usedControls = Set<String>()
    private var choices: [ObjectIdentifier: [CaptureViewInput.Choice]] = [:]
    private(set) var contentHeight: CGFloat = 0
    override var isFlipped: Bool { true }

    init(appIcon: NSImage? = Bundle.main.url(forResource: "BrandMark", withExtension: "png").flatMap { NSImage(contentsOf: $0) }, input: CaptureViewInput, perform: @escaping (CaptureViewIntent) -> Void) {
        self.input = input
        self.appIcon = appIcon
        self.perform = perform
        super.init(frame: .zero)
        appearance = NSAppearance(named: .darkAqua)
        wantsLayer = true
        scrollView.drawsBackground = false
        scrollView.hasVerticalScroller = true
        scrollView.scrollerStyle = .overlay
        scrollView.verticalScrollElasticity = .none
        scrollView.documentView = document
        addSubview(scrollView)
        footer.wantsLayer = true
        addSubview(footer)
        build()
    }
    required init?(coder: NSCoder) { nil }

    /// Replace rendering facts while retaining native chooser/control identities and focus.
    func update(_ input: CaptureViewInput) {
        guard self.input != input else { return }
        let origin = scrollView.contentView.bounds.origin
        self.input = input
        build()
        scrollView.contentView.scroll(to: origin)
        scrollView.reflectScrolledClipView(scrollView.contentView)
        needsLayout = true
    }

    override func viewDidChangeEffectiveAppearance() {
        super.viewDidChangeEffectiveAppearance()
        build()
        document.needsDisplay = true
        for child in document.subviews { child.needsDisplay = true }
    }

    override func layout() {
        super.layout()
        let frame = bounds.insetBy(dx: 1, dy: 1)
        footer.frame = NSRect(x: frame.minX, y: frame.maxY - Self.footerHeight,
                              width: frame.width, height: Self.footerHeight)
        scrollView.frame = NSRect(x: frame.minX, y: frame.minY, width: frame.width,
                                   height: max(1, frame.height - Self.footerHeight))
        document.frame = NSRect(x: 0, y: 0, width: scrollView.contentView.bounds.width,
                                height: max(contentHeight - Self.footerHeight - 2, scrollView.contentView.bounds.height))
    }

    /// Identifiers address native controls by user-visible purpose, including accessibility/probes.
    func control(identifier: String) -> NSControl? { controls[identifier] }

    private func label(_ text: String, _ frame: NSRect, size: CGFloat, weight: NSFont.Weight = .regular,
                       color: NSColor = .labelColor, host: NSView? = nil) {
        let field = NSTextField(labelWithString: text)
        field.font = .systemFont(ofSize: size, weight: weight)
        field.textColor = color
        field.frame = frame
        field.lineBreakMode = .byTruncatingTail
        field.maximumNumberOfLines = 1
        (host ?? document).addSubview(field)
    }

    private func button(_ title: String, id: String, frame: NSRect, intent: CaptureViewIntent?,
                        kind: CaptureButton.Kind = .plain, symbol: String? = nil, enabled: Bool = true,
                        host: NSView? = nil) {
        usedControls.insert(id)
        let button = controls[id] as? CaptureButton ?? CaptureButton(title: title, kind: kind, symbol: symbol)
        button.configure(title: title, kind: kind, symbol: symbol)
        button.frame = frame
        button.isEnabled = enabled && intent != nil
        button.target = self
        button.action = #selector(activate(_:))
        button.identifier = .init(id)
        if case .permission(let role) = kind { button.setAccessibilityLabel("\(role). \(title)") }
        else { button.setAccessibilityLabel(title) }
        let parent = host ?? document
        if button.superview !== parent { parent.addSubview(button, positioned: .above, relativeTo: nil) }
        controls[id] = button
        intents[ObjectIdentifier(button)] = intent
    }

    private func toggle(_ title: String, id: String, frame: NSRect, intent: CaptureViewIntent?, on: Bool, enabled: Bool) {
        usedControls.insert(id)
        let toggle = controls[id] as? NSSwitch ?? NSSwitch()
        toggle.controlSize = .small
        toggle.sizeToFit()
        let nativeSize = toggle.frame.size
        // NSSwitch keeps its regular intrinsic size even for small/mini on macOS 26.
        // Scale its native drawing instead of clipping it into a narrower frame.
        toggle.frame = frame
        toggle.bounds = NSRect(origin: .zero, size: nativeSize)
        toggle.state = on ? .on : .off
        toggle.isEnabled = enabled && intent != nil
        toggle.target = self
        toggle.action = #selector(activate(_:))
        toggle.identifier = .init(id)
        toggle.setAccessibilityLabel(title)
        if toggle.superview !== document { document.addSubview(toggle, positioned: .above, relativeTo: nil) }
        controls[id] = toggle
        intents[ObjectIdentifier(toggle)] = intent
    }

    private func popup(_ values: [CaptureViewInput.Choice], selected: Int, id: String, frame: NSRect) {
        usedControls.insert(id)
        let popup = controls[id] as? CapturePopup ?? CapturePopup(frame: frame, pullsDown: false)
        popup.frame = frame
        popup.isBordered = false
        popup.font = .systemFont(ofSize: 12, weight: .regular)
        if choices[ObjectIdentifier(popup)] != values {
            let menu = NSMenu()
            menu.autoenablesItems = false
            for value in values { menu.addItem(NSMenuItem(title: value.title, action: nil, keyEquivalent: "")) }
            popup.menu = menu
        }
        if popup.indexOfSelectedItem != selected { popup.selectItem(at: values.indices.contains(selected) ? selected : -1) }
        popup.isEnabled = input.inputsEnabled && !values.isEmpty && (id != "source.device" || input.screenSourcesEnabled)
        popup.target = self
        popup.action = #selector(selectChoice(_:))
        popup.identifier = .init(id)
        popup.setAccessibilityLabel(id == "source.device" ? "Capture source" : id == "camera.device" ? "Camera" : "Microphone")
        if values.indices.contains(selected) { popup.setAccessibilityHelp(values[selected].title) }
        if popup.superview !== document { document.addSubview(popup, positioned: .above, relativeTo: nil) }
        controls[id] = popup
        choices[ObjectIdentifier(popup)] = values
    }

    private func icon(_ name: String, frame: NSRect, color: NSColor = NSColor.labelColor.withAlphaComponent(0.65)) {
        let image = NSImageView(frame: frame)
        image.image = captureSymbol(name, color: color)
        image.imageScaling = .scaleProportionallyUpOrDown
        document.addSubview(image)
    }

    private func build() {
        effectiveAppearance.performAsCurrentDrawingAppearance { buildContents() }
    }

    private func buildContents() {
        usedControls = []
        for child in document.subviews where child.identifier == nil { child.removeFromSuperview() }
        footer.subviews.forEach { $0.removeFromSuperview() }
        let brand = NSImageView(frame: NSRect(x: 16, y: 14, width: 30, height: 30))
        brand.image = appIcon
        brand.imageScaling = .scaleProportionallyUpOrDown
        brand.setAccessibilityLabel("Yap")
        document.addSubview(brand)
        label("Yap", NSRect(x: 54, y: 20, width: 180, height: 22), size: 16, weight: .semibold)
        button("Open library", id: "header.library", frame: NSRect(x: 258, y: 12, width: 34, height: 34), intent: .openLibrary, symbol: "play.rectangle.on.rectangle")
        button("Settings", id: "header.settings", frame: NSRect(x: 307, y: 12, width: 34, height: 34), intent: .controls(.openSettings), symbol: "gearshape")
        label("Record", NSRect(x: 16, y: 58, width: 100, height: 16), size: 11, weight: .medium, color: .secondaryLabelColor)
        let titles = ["Display", "Window", "Area", "Camera"]
        let symbols = ["display", "macwindow", "viewfinder", "video"]
        for (index, source) in CaptureViewInput.Source.allCases.enumerated() {
            button(titles[index], id: "source.\(source.rawValue)",
                frame: NSRect(x: 16 + CGFloat(index) * 82, y: 80, width: 74, height: 64),
                intent: .chooseSource(source), kind: .tile(selected: source == input.selectedSource), symbol: symbols[index],
                enabled: input.inputsEnabled && (source == .cameraOnly || input.screenSourcesEnabled))
        }
        var y: CGFloat = 156
        if input.selectedSource != .cameraOnly {
            let sourceChoices = input.screenSourcesEnabled ? input.sourceChoices
                : [.init(title: "Screen Recording access required", intent: .chooseSource(input.selectedSource))]
            popup(sourceChoices, selected: input.screenSourcesEnabled ? input.selectedSourceChoice : 0,
                  id: "source.device", frame: NSRect(x: 22, y: y, width: 306, height: 28))
            y += 36
        }
        let microphoneIntent: CaptureViewIntent? = input.microphoneOn ? .controls(.disableMicrophone)
            : input.microphoneChoices.indices.contains(input.selectedMicrophone) ? input.microphoneChoices[input.selectedMicrophone].intent : nil
        let rows: [(String, String, String?, Bool, CaptureViewIntent?)] = [
            ("camera", "video", input.selectedSource == .cameraOnly ? "Camera is the recording source" : nil, input.cameraOn, .cameraEnabled(!input.cameraOn)),
            ("microphone", "mic", nil, input.microphoneOn, microphoneIntent),
            ("systemAudio", "speaker.wave.2", "Everything your Mac plays", input.systemAudio, .controls(.toggleSystemAudio)),
            ("countdown", "stopwatch", nil, input.countdown, .countdown(!input.countdown)),
        ]
        for (id, symbol, subtitle, on, intent) in rows {
            let rowHeight: CGFloat = subtitle == nil ? 38 : 48
            let centerY = y + rowHeight / 2
            icon(symbol, frame: NSRect(x: 22, y: centerY - 8, width: 16, height: 16))
            let textY = subtitle == nil ? centerY - 9 : y + 6
            if id == "camera" {
                popup(input.cameraChoices, selected: input.selectedCamera, id: "camera.device", frame: NSRect(x: 48, y: textY - 3, width: input.selectedSource == .cameraOnly ? 210 : 236, height: 24))
            } else if id == "microphone" {
                popup(input.microphoneChoices, selected: input.selectedMicrophone, id: "microphone.device", frame: NSRect(x: 48, y: textY - 3, width: 236, height: 24))
            } else {
                label(id == "systemAudio" ? "System audio" : "3-second countdown", NSRect(x: 46, y: textY, width: 238, height: 18), size: 12, color: input.inputsEnabled ? .labelColor : .secondaryLabelColor)
            }
            if let subtitle { label(subtitle, NSRect(x: 46, y: y + 25, width: 232, height: 16), size: 10, color: .secondaryLabelColor) }
            if id == "camera", CapturePresentation.cameraIsRequired(cameraOnly: input.selectedSource == .cameraOnly, selectedCameraIndex: input.selectedCamera) {
                label("Required", NSRect(x: 280, y: centerY - 8, width: 56, height: 16), size: 10, weight: .medium, color: .systemBlue)
            } else {
                toggle(id == "systemAudio" ? "System audio" : id.capitalized, id: "\(id).toggle", frame: NSRect(x: 296, y: centerY - 9, width: 38, height: 18), intent: intent, on: on, enabled: input.inputsEnabled)
            }
            y += rowHeight
        }
        y += 12
        if !input.notices.isEmpty || !input.permissionActions.isEmpty {
            for notice in input.notices {
                let font = NSFont.systemFont(ofSize: 11)
                let text = NSTextField(wrappingLabelWithString: notice)
                text.font = font
                let measured = text.cell?.cellSize(forBounds: NSRect(x: 0, y: 0, width: 292, height: CGFloat.greatestFiniteMagnitude)) ?? .zero
                let height = max(18, ceil(measured.height))
                text.frame = NSRect(x: 29, y: y, width: 292, height: height)
                text.textColor = .secondaryLabelColor
                document.addSubview(text)
                y += height + 6
            }
            if input.permissionActions.contains(where: {
                switch $0.action {
                case .requestScreenPermission, .requestMicrophonePermission, .requestCameraPermission: true
                default: false
                }
            }) {
                label("Recording permissions", NSRect(x: 24, y: y, width: 292, height: 16), size: 10, color: .secondaryLabelColor)
                y += 20
            }
            for action in input.permissionActions {
                let role: String
                let symbol: String
                switch action.action {
                case .requestScreenPermission: role = "Screen recording"; symbol = "display"
                case .requestMicrophonePermission: role = "Microphone"; symbol = "mic"
                case .requestCameraPermission: role = "Camera"; symbol = "video"
                default:
                    button(action.title, id: action.action.id, frame: NSRect(x: 17, y: y, width: 320, height: 30), intent: .controls(action.action), kind: .secondary, enabled: action.enabled)
                    y += 32
                    continue
                }
                button(action.title, id: action.action.id, frame: NSRect(x: 17, y: y, width: 320, height: 30), intent: .controls(action.action), kind: .permission(role: role), symbol: symbol, enabled: action.enabled)
                y += 32
            }
            y += 8
        }
        button(input.startTitle == "Start Recording" ? "Start recording" : input.startTitle, id: "capture.start", frame: NSRect(x: 17, y: y, width: 320, height: 36), intent: .controls(.startOrStop), kind: .primary(shortcut: input.startShortcut), enabled: input.startEnabled)
        y += 36
        for action in input.transport {
            y += 8
            button(action.title, id: action.action.id, frame: NSRect(x: 17, y: y, width: 320, height: 28), intent: .controls(action.action), kind: .secondary, enabled: action.enabled)
            y += 28
        }
        let footerY = y
        // Keep the breathing space above status fixed even when content scrolls to its edge.
        let rule = NSBox(frame: NSRect(x: 0, y: 24, width: 350, height: 1))
        rule.boxType = .separator
        footer.addSubview(rule)
        let statusDot = NSView(frame: NSRect(x: 17, y: 40, width: 5, height: 5))
        statusDot.wantsLayer = true
        statusDot.layer?.cornerRadius = 2.5
        statusDot.layer?.backgroundColor = (input.startEnabled ? NSColor.systemGreen : NSColor.secondaryLabelColor).cgColor
        footer.addSubview(statusDot)
        label(input.status, NSRect(x: 28, y: 35, width: 247, height: 16), size: 11, color: .secondaryLabelColor, host: footer)
        button("Quit", id: "app.quit", frame: NSRect(x: 295, y: 32, width: 37, height: 22), intent: .controls(.quit), host: footer)
        for (id, control) in controls where !usedControls.contains(id) {
            control.removeFromSuperview()
            intents.removeValue(forKey: ObjectIdentifier(control))
            choices.removeValue(forKey: ObjectIdentifier(control))
        }
        controls = controls.filter { usedControls.contains($0.key) }
        contentHeight = footerY + Self.footerHeight + 2
        document.frame = NSRect(x: 0, y: 0, width: Self.preferredWidth,
                                height: max(1, footerY))
        footer.frame = NSRect(x: 1, y: max(1, contentHeight - Self.footerHeight),
                              width: Self.preferredWidth - 2, height: Self.footerHeight)
    }

    @objc private func activate(_ sender: NSControl) {
        guard sender.isEnabled, let intent = intents[ObjectIdentifier(sender)] else { return }
        perform(intent)
    }
    @objc private func selectChoice(_ sender: NSPopUpButton) {
        guard sender.isEnabled, let values = choices[ObjectIdentifier(sender)], values.indices.contains(sender.indexOfSelectedItem) else { return }
        perform(values[sender.indexOfSelectedItem].intent)
    }
}

@MainActor
private final class CaptureDocument: NSView {
    override var isFlipped: Bool { true }
}

/// Native momentary buttons draw the frozen geometry; they never mutate their supplied selection.
@MainActor
private final class CaptureButton: NSButton {
    enum Kind { case plain, tile(selected: Bool), primary(shortcut: String?), permission(role: String), secondary }
    private var kind: Kind
    private var symbol: String?
    override var isFlipped: Bool { true }
    init(title: String, kind: Kind, symbol: String?) {
        self.kind = kind
        self.symbol = symbol
        super.init(frame: .zero)
        self.title = title
        setButtonType(.momentaryChange)
        isBordered = false
        focusRingType = .exterior
        configure(title: title, kind: kind, symbol: symbol)
    }
    func configure(title: String, kind: Kind, symbol: String?) {
        self.title = title
        self.kind = kind
        self.symbol = symbol
        needsDisplay = true
        setAccessibilityElement(true)
        switch kind {
        case .tile(let selected):
            setAccessibilityRole(.radioButton)
            setAccessibilityValue(NSNumber(value: selected))
        default: setAccessibilityRole(.button)
        }
    }
    required init?(coder: NSCoder) { nil }
    override func draw(_ dirtyRect: NSRect) {
        let blue = NSColor.systemBlue
        let muted = NSColor.secondaryLabelColor
        func text(_ value: String, y: CGFloat, size: CGFloat, weight: NSFont.Weight, color: NSColor) {
            let attributes: [NSAttributedString.Key: Any] = [.font: NSFont.systemFont(ofSize: size, weight: weight), .foregroundColor: color]
            let width = (value as NSString).size(withAttributes: attributes).width
            (value as NSString).draw(at: NSPoint(x: (bounds.width - width) / 2, y: y), withAttributes: attributes)
        }
        func image(_ frame: NSRect, color: NSColor, name: String? = nil) {
            guard let symbol = name ?? symbol else { return }
            guard let image = captureSymbol(symbol, color: color), image.size.width > 0, image.size.height > 0 else { return }
            let scale = min(frame.width / image.size.width, frame.height / image.size.height)
            let size = NSSize(width: image.size.width * scale, height: image.size.height * scale)
            let fitted = NSRect(x: frame.midX - size.width / 2, y: frame.midY - size.height / 2, width: size.width, height: size.height)
            image.draw(in: fitted, from: .zero, operation: .sourceOver, fraction: 1, respectFlipped: true, hints: [.interpolation: NSImageInterpolation.high])
        }
        switch kind {
        case .tile(let selected):
            let selectionColor = isEnabled ? blue : muted
            let path = NSBezierPath(roundedRect: bounds.insetBy(dx: 0.75, dy: 0.75), xRadius: 9, yRadius: 9)
            (selected ? selectionColor.withAlphaComponent(0.12) : captureRaisedColor()).setFill()
            path.fill()
            if selected {
                selectionColor.withAlphaComponent(0.55).setStroke()
                path.lineWidth = 1
                path.stroke()
            }
            image(NSRect(x: (bounds.width - 18) / 2, y: 11, width: 18, height: 18), color: selected ? selectionColor : muted)
            text(title, y: 37, size: 11, weight: .medium, color: isEnabled ? .labelColor : muted)
        case .primary(let binding):
            (isEnabled ? blue : blue.withAlphaComponent(0.16)).setFill()
            let foreground = isEnabled ? NSColor.white : captureDisabledBlue()
            NSBezierPath(roundedRect: bounds, xRadius: 10, yRadius: 10).fill()
            let action = NSAttributedString(string: "●  \(title)", attributes: [.font: NSFont.systemFont(ofSize: 13, weight: .semibold), .foregroundColor: foreground])
            let shortcut = NSAttributedString(string: binding.map { "   \($0)" } ?? "", attributes: [.font: NSFont.systemFont(ofSize: 11), .foregroundColor: foreground.withAlphaComponent(0.8)])
            let x = (bounds.width - action.size().width - shortcut.size().width) / 2
            action.draw(at: NSPoint(x: x, y: (bounds.height - action.size().height) / 2))
            shortcut.draw(at: NSPoint(x: x + action.size().width, y: (bounds.height - shortcut.size().height) / 2))
        case .permission(let role):
            image(NSRect(x: 7, y: bounds.midY - 7, width: 14, height: 14), color: muted)
            let heading = NSAttributedString(string: role, attributes: [.font: NSFont.systemFont(ofSize: 11), .foregroundColor: NSColor.labelColor])
            heading.draw(at: NSPoint(x: 31, y: (bounds.height - heading.size().height) / 2))
            let actionTitle = title == "Allow in System Settings…" ? "Open Settings…" : "Allow…"
            let action = NSAttributedString(string: actionTitle, attributes: [.font: NSFont.systemFont(ofSize: 11, weight: .medium), .foregroundColor: isEnabled ? blue : muted])
            action.draw(at: NSPoint(x: bounds.width - action.size().width - 7, y: (bounds.height - action.size().height) / 2))
        case .secondary:
            captureRaisedColor().setFill()
            NSBezierPath(roundedRect: bounds, xRadius: 7, yRadius: 7).fill()
            text(title, y: (bounds.height - 14) / 2, size: 11, weight: .medium, color: isEnabled ? .labelColor : .secondaryLabelColor)
        case .plain:
            if symbol != nil { image(bounds.insetBy(dx: 6, dy: 6), color: muted) }
            else { text(title, y: (bounds.height - NSFont.systemFont(ofSize: 11).boundingRectForFont.height) / 2, size: 11, weight: .regular, color: muted) }
        }
    }
}

/// AppKit owns the chooser interaction; drawing its selected title avoids the platform's
/// borderless-popup emphasis overriding the supplied source/device text hierarchy.
@MainActor
private final class CapturePopup: NSPopUpButton {
    override var isFlipped: Bool { true }
    override func draw(_ dirtyRect: NSRect) {
        let paragraph = NSMutableParagraphStyle()
        paragraph.lineBreakMode = .byTruncatingTail
        let attributes: [NSAttributedString.Key: Any] = [
            .font: font ?? NSFont.systemFont(ofSize: 12),
            .foregroundColor: isEnabled ? NSColor.labelColor : NSColor.secondaryLabelColor,
            .paragraphStyle: paragraph,
        ]
        let title = selectedItem?.title ?? "Choose a source…"
        let measured = (title as NSString).size(withAttributes: attributes)
        let textWidth = min(measured.width, bounds.width - 22)
        let textY = (bounds.height - measured.height) / 2
        (title as NSString).draw(in: NSRect(x: 0, y: textY, width: textWidth, height: measured.height), withAttributes: attributes)
        if let image = captureSymbol("chevron.down", color: .secondaryLabelColor) {
            image.draw(in: NSRect(x: textWidth + 7, y: bounds.midY - 3, width: 8, height: 6), from: .zero, operation: .sourceOver, fraction: 1, respectFlipped: true, hints: nil)
        }
    }
}

/// Palette configurations do not tint symbols without a palette variant.
private func captureSymbol(_ name: String, color: NSColor) -> NSImage? {
    guard let image = NSImage(systemSymbolName: name, accessibilityDescription: nil) else { return nil }
    return NSImage(size: image.size, flipped: false) { rect in
        image.draw(in: rect)
        color.setFill()
        rect.fill(using: .sourceIn)
        return true
    }
}

private func captureRaisedColor() -> NSColor {
    NSColor(name: nil) { appearance in
        appearance.bestMatch(from: [.darkAqua, .aqua]) == .darkAqua
            ? NSColor.white.withAlphaComponent(0.065)
            : NSColor.black.withAlphaComponent(0.045)
    }
}

private func captureDisabledBlue() -> NSColor {
    NSColor(name: nil) { appearance in
        appearance.bestMatch(from: [.darkAqua, .aqua]) == .darkAqua
            ? NSColor.systemBlue.blended(withFraction: 0.4, of: .white)!
            : NSColor.systemBlue.blended(withFraction: 0.2, of: .black)!
    }
}

import AppKit
import ScreenRecorderControls

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
    private(set) var input: CaptureViewInput
    private let perform: (CaptureViewIntent) -> Void
    let scrollView = NSScrollView()
    private let document = CaptureDocument()
    private var controls: [String: NSControl] = [:]
    private var intents: [ObjectIdentifier: CaptureViewIntent] = [:]
    private var usedControls = Set<String>()
    private var choices: [ObjectIdentifier: [CaptureViewInput.Choice]] = [:]
    private(set) var contentHeight: CGFloat = 0
    override var isFlipped: Bool { true }

    init(input: CaptureViewInput, perform: @escaping (CaptureViewIntent) -> Void) {
        self.input = input
        self.perform = perform
        super.init(frame: .zero)
        wantsLayer = true
        layer?.cornerRadius = 19
        layer?.borderWidth = 1
        layer?.borderColor = NSColor.separatorColor.cgColor
        layer?.masksToBounds = true
        scrollView.drawsBackground = false
        scrollView.hasVerticalScroller = true
        scrollView.scrollerStyle = .overlay
        scrollView.documentView = document
        addSubview(scrollView)
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
        effectiveAppearance.performAsCurrentDrawingAppearance {
            layer?.borderColor = NSColor.separatorColor.cgColor
            build()
        }
        document.needsDisplay = true
        for child in document.subviews { child.needsDisplay = true }
    }

    override func layout() {
        super.layout()
        scrollView.frame = bounds.insetBy(dx: 1, dy: 1)
        document.frame = NSRect(x: 0, y: 0, width: bounds.width - 2, height: contentHeight - 2)
    }

    /// Identifiers address native controls by user-visible purpose, including accessibility/probes.
    func control(identifier: String) -> NSControl? { controls[identifier] }

    private func label(_ text: String, _ frame: NSRect, size: CGFloat, weight: NSFont.Weight = .regular,
                       color: NSColor = .labelColor) {
        let field = NSTextField(labelWithString: text)
        field.font = .systemFont(ofSize: size, weight: weight)
        field.textColor = color
        field.frame = frame
        field.lineBreakMode = .byTruncatingTail
        field.maximumNumberOfLines = 1
        document.addSubview(field)
    }

    private func button(_ title: String, id: String, frame: NSRect, intent: CaptureViewIntent?,
                        kind: CaptureButton.Kind = .plain, symbol: String? = nil, enabled: Bool = true) {
        usedControls.insert(id)
        let button = controls[id] as? CaptureButton ?? CaptureButton(title: title, kind: kind, symbol: symbol)
        button.configure(title: title, kind: kind, symbol: symbol)
        button.frame = frame
        button.isEnabled = enabled && intent != nil
        button.target = self
        button.action = #selector(activate(_:))
        button.identifier = .init(id)
        button.setAccessibilityLabel(title)
        if button.superview !== document { document.addSubview(button, positioned: .above, relativeTo: nil) }
        controls[id] = button
        intents[ObjectIdentifier(button)] = intent
    }

    private func popup(_ values: [CaptureViewInput.Choice], selected: Int, id: String, frame: NSRect) {
        usedControls.insert(id)
        let popup = controls[id] as? CapturePopup ?? CapturePopup(frame: frame, pullsDown: false)
        popup.frame = frame
        popup.isBordered = false
        popup.font = .systemFont(ofSize: 12, weight: id == "source.device" ? .regular : .semibold)
        if choices[ObjectIdentifier(popup)] != values {
            let menu = NSMenu()
            menu.autoenablesItems = false
            for value in values { menu.addItem(NSMenuItem(title: value.title, action: nil, keyEquivalent: "")) }
            popup.menu = menu
        }
        if popup.indexOfSelectedItem != selected { popup.selectItem(at: values.indices.contains(selected) ? selected : -1) }
        popup.isEnabled = input.inputsEnabled && !values.isEmpty
        popup.target = self
        popup.action = #selector(selectChoice(_:))
        popup.identifier = .init(id)
        popup.setAccessibilityLabel(id == "source.device" ? "Capture source" : id == "camera.device" ? "Camera" : "Microphone")
        if values.indices.contains(selected) { popup.setAccessibilityHelp(values[selected].title) }
        if popup.superview !== document { document.addSubview(popup, positioned: .above, relativeTo: nil) }
        controls[id] = popup
        choices[ObjectIdentifier(popup)] = values
    }

    private func card(_ frame: NSRect, radius: CGFloat = 11, fill: NSColor = .controlBackgroundColor) {
        let card = NSView(frame: frame)
        card.wantsLayer = true
        card.layer?.cornerRadius = radius
        card.layer?.backgroundColor = fill.cgColor
        card.layer?.borderWidth = 1
        card.layer?.borderColor = NSColor.separatorColor.cgColor
        document.addSubview(card, positioned: .below, relativeTo: nil)
    }

    private func icon(_ name: String, frame: NSRect, color: NSColor = .secondaryLabelColor) {
        let image = NSImageView(frame: frame)
        image.image = NSImage(systemSymbolName: name, accessibilityDescription: nil)
        image.contentTintColor = color
        image.imageScaling = .scaleProportionallyUpOrDown
        document.addSubview(image)
    }

    private func build() {
        usedControls = []
        for child in document.subviews where child.identifier == nil { child.removeFromSuperview() }
        card(NSRect(x: 18, y: 20, width: 39, height: 39))
        icon("record.circle", frame: NSRect(x: 24, y: 26, width: 27, height: 27), color: .systemBlue)
        label("Screen Recorder", NSRect(x: 66, y: 30, width: 181, height: 24), size: 17, weight: .semibold)
        button("Open library", id: "header.library", frame: NSRect(x: 253, y: 23, width: 34, height: 34), intent: .openLibrary, symbol: "play.rectangle.on.rectangle")
        button("Settings", id: "header.settings", frame: NSRect(x: 297, y: 23, width: 34, height: 34), intent: .controls(.openSettings), symbol: "gearshape")
        label("RECORD", NSRect(x: 17, y: 76, width: 100, height: 14), size: 11, weight: .semibold, color: .secondaryLabelColor)
        let titles = ["Display", "Window", "Area", "Camera Only"]
        let symbols = ["display", "macwindow", "viewfinder", "video"]
        for (index, source) in CaptureViewInput.Source.allCases.enumerated() {
            button(titles[index], id: "source.\(source.rawValue)",
                frame: NSRect(x: 17 + CGFloat(index % 2) * 162.5, y: 98 + CGFloat(index / 2) * 90, width: 153.5, height: 81),
                intent: .chooseSource(source), kind: .tile(selected: source == input.selectedSource), symbol: symbols[index], enabled: input.inputsEnabled)
        }
        var y: CGFloat = 282
        if input.selectedSource != .cameraOnly {
            card(NSRect(x: 17, y: y, width: 316, height: 40), radius: 10)
            popup(input.sourceChoices, selected: input.selectedSourceChoice, id: "source.device", frame: NSRect(x: 30, y: y + 8, width: 290, height: 24))
            y += 53
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
            card(NSRect(x: 17, y: y, width: 316, height: 55))
            icon(symbol, frame: NSRect(x: 30, y: y + 17.5, width: 20, height: 20))
            let textY = subtitle == nil ? y + 16 : y + 8
            if id == "camera" {
                popup(input.cameraChoices, selected: input.selectedCamera, id: "camera.device", frame: NSRect(x: 60, y: textY - 1, width: input.selectedSource == .cameraOnly ? 191 : 210, height: 24))
            } else if id == "microphone" {
                popup(input.microphoneChoices, selected: input.selectedMicrophone, id: "microphone.device", frame: NSRect(x: 60, y: textY - 1, width: 210, height: 24))
            } else {
                label(id == "systemAudio" ? "System audio" : "3-second countdown", NSRect(x: 60, y: textY, width: 210, height: 20), size: 13, weight: .semibold)
            }
            if let subtitle { label(subtitle, NSRect(x: 60, y: y + 30, width: 218, height: 16), size: 11, color: .secondaryLabelColor) }
            if id == "camera", input.selectedSource == .cameraOnly {
                card(NSRect(x: 260, y: y + 17, width: 59, height: 22), radius: 6, fill: NSColor.systemBlue.withAlphaComponent(0.12))
                label("Required", NSRect(x: 267, y: y + 20, width: 49, height: 16), size: 10, weight: .semibold, color: .systemBlue)
            } else {
                button(id == "systemAudio" ? "System audio" : id.capitalized, id: "\(id).toggle", frame: NSRect(x: 278, y: y + 15, width: 42, height: 25), intent: intent, kind: .toggle(on: on), enabled: input.inputsEnabled)
            }
            y += 64
        }
        y += 5
        if !input.notices.isEmpty || !input.permissionActions.isEmpty {
            let top = y
            y += 12
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
            for action in input.permissionActions {
                button(action.title, id: action.action.id, frame: NSRect(x: 29, y: y, width: 292, height: 30), intent: .controls(action.action), kind: .secondary, enabled: action.enabled)
                y += 36
            }
            y += 6
            card(NSRect(x: 17, y: top, width: 316, height: y - top), radius: 10, fill: NSColor.controlBackgroundColor)
            y += 14
        }
        button(input.startTitle == "Start Recording" ? "Start recording" : input.startTitle, id: "capture.start", frame: NSRect(x: 17, y: y, width: 316, height: 44), intent: .controls(.startOrStop), kind: .primary(shortcut: input.startShortcut), enabled: input.startEnabled)
        y += 53
        for action in input.transport {
            button(action.title, id: action.action.id, frame: NSRect(x: 17, y: y, width: 316, height: 30), intent: .controls(action.action), kind: .secondary, enabled: action.enabled)
            y += 39
        }
        button("Open library", id: "library.open", frame: NSRect(x: 17, y: y, width: 316, height: 37), intent: .openLibrary, kind: .library, symbol: "play.rectangle.on.rectangle")
        y += 45
        let rule = NSBox(frame: NSRect(x: 0, y: y, width: 350, height: 1))
        rule.boxType = .separator
        document.addSubview(rule)
        let statusDot = NSView(frame: NSRect(x: 17, y: y + 16, width: 5, height: 5))
        statusDot.wantsLayer = true
        statusDot.layer?.cornerRadius = 2.5
        statusDot.layer?.backgroundColor = (input.startEnabled ? NSColor.systemGreen : NSColor.secondaryLabelColor).cgColor
        document.addSubview(statusDot)
        label(input.status, NSRect(x: 28, y: y + 11, width: 247, height: 16), size: 11, color: .secondaryLabelColor)
        button("Quit", id: "app.quit", frame: NSRect(x: 295, y: y + 8, width: 37, height: 22), intent: .controls(.quit))
        for (id, control) in controls where !usedControls.contains(id) {
            control.removeFromSuperview()
            intents.removeValue(forKey: ObjectIdentifier(control))
            choices.removeValue(forKey: ObjectIdentifier(control))
        }
        controls = controls.filter { usedControls.contains($0.key) }
        contentHeight = y + 37
        document.frame = NSRect(x: 0, y: 0, width: 350, height: contentHeight - 2)
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
    override func draw(_ dirtyRect: NSRect) {
        NSColor.windowBackgroundColor.setFill()
        bounds.fill()
    }
}

/// Native momentary buttons draw the frozen geometry; they never mutate their supplied selection.
@MainActor
private final class CaptureButton: NSButton {
    enum Kind { case plain, tile(selected: Bool), toggle(on: Bool), primary(shortcut: String?), library, secondary }
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
        case .toggle(let on):
            setAccessibilityRole(.checkBox)
            setAccessibilityValue(NSNumber(value: on))
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
        func image(_ frame: NSRect, color: NSColor) {
            guard let symbol else { return }
            captureSymbol(symbol, color: color)?.draw(in: frame)
        }
        switch kind {
        case .tile(let selected):
            let path = NSBezierPath(roundedRect: bounds.insetBy(dx: 0.75, dy: 0.75), xRadius: 12, yRadius: 12)
            (selected ? NSColor.systemBlue.withAlphaComponent(0.12) : NSColor.controlBackgroundColor).setFill()
            path.fill()
            (selected ? blue : NSColor.separatorColor).setStroke()
            path.lineWidth = selected ? 1.5 : 1
            path.stroke()
            image(NSRect(x: (bounds.width - 26) / 2, y: 17, width: 26, height: 26), color: selected ? blue : muted)
            text(title, y: 49, size: 13, weight: .semibold, color: isEnabled ? .labelColor : muted)
            if selected {
                let attributes: [NSAttributedString.Key: Any] = [.font: NSFont.systemFont(ofSize: 11), .foregroundColor: blue]
                ("✓" as NSString).draw(at: NSPoint(x: bounds.width - 18, y: 7), withAttributes: attributes)
            }
        case .toggle(let on):
            (on ? blue : NSColor.tertiaryLabelColor).setFill()
            NSBezierPath(roundedRect: bounds, xRadius: 12.5, yRadius: 12.5).fill()
            NSColor.white.setFill()
            NSBezierPath(ovalIn: NSRect(x: on ? 20 : 3, y: 3, width: 19, height: 19)).fill()
        case .primary(let binding):
            (isEnabled ? blue : NSColor.systemGray).setFill()
            NSBezierPath(roundedRect: bounds, xRadius: 10, yRadius: 10).fill()
            let action = NSAttributedString(string: "●  \(title)", attributes: [.font: NSFont.systemFont(ofSize: 13, weight: .semibold), .foregroundColor: NSColor.white])
            let shortcut = NSAttributedString(string: binding.map { "   \($0)" } ?? "", attributes: [.font: NSFont.systemFont(ofSize: 11), .foregroundColor: NSColor.white.withAlphaComponent(0.85)])
            let x = (bounds.width - action.size().width - shortcut.size().width) / 2
            action.draw(at: NSPoint(x: x, y: 13))
            shortcut.draw(at: NSPoint(x: x + action.size().width, y: 14))
        case .library:
            image(NSRect(x: 94, y: 8, width: 22, height: 22), color: muted)
            text(title, y: 11, size: 12, weight: .regular, color: muted)
            ("›" as NSString).draw(at: NSPoint(x: 215, y: 6), withAttributes: [.font: NSFont.systemFont(ofSize: 23), .foregroundColor: muted])
        case .secondary:
            NSColor.controlBackgroundColor.setFill()
            NSBezierPath(roundedRect: bounds, xRadius: 7, yRadius: 7).fill()
            NSColor.separatorColor.setStroke()
            NSBezierPath(roundedRect: bounds.insetBy(dx: 0.5, dy: 0.5), xRadius: 7, yRadius: 7).stroke()
            text(title, y: 8, size: 11, weight: .medium, color: isEnabled ? .labelColor : .secondaryLabelColor)
        case .plain:
            if symbol != nil { image(bounds.insetBy(dx: 6, dy: 6), color: muted) }
            else { text(title, y: 4, size: 11, weight: .regular, color: muted) }
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
        ((selectedItem?.title ?? "Choose a source…") as NSString).draw(in: NSRect(x: 0, y: 5, width: bounds.width - 18, height: 18), withAttributes: attributes)
        if let image = captureSymbol("chevron.down", color: .secondaryLabelColor) {
            image.draw(in: NSRect(x: bounds.width - 12, y: 8, width: 10, height: 8))
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

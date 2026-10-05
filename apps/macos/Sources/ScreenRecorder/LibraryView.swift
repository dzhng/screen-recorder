import AppKit
import ScreenRecorderControls

/// Saved media presentation with only session-local tab/filter/scroll state. LibraryController
/// supplies observations; all explicit actions travel through the same ControlsAction dispatcher.
@MainActor
final class LibraryView: NSView, NSSearchFieldDelegate {
    enum Tab: String, CaseIterable { case recordings = "Recordings", projects = "Projects", exports = "Exports" }
    private var state: ControlsState
    private var exports: ExportsState
    private let perform: (ControlsAction) -> Void
    private(set) var tab: Tab = .recordings
    private var filter = ""
    private var scrollPositions: [Tab: NSPoint] = [:]
    let scrollView = NSScrollView()
    private let document = LibraryDocument()
    private var controls: [String: NSControl] = [:]
    private var actions: [ObjectIdentifier: ControlsAction] = [:]
    private var actionItems: [String: NSMenuItem] = [:]
    private var tabActions: [ObjectIdentifier: Tab] = [:]
    private let filterField = NSSearchField()
    override var isFlipped: Bool { true }

    init(state: ControlsState, exports: ExportsState, perform: @escaping (ControlsAction) -> Void) {
        self.state = state
        self.exports = exports
        self.perform = perform
        super.init(frame: NSRect(x: 0, y: 0, width: 768, height: 476))
        wantsLayer = true
        layer?.backgroundColor = NSColor.windowBackgroundColor.cgColor
        scrollView.drawsBackground = false
        scrollView.hasVerticalScroller = true
        scrollView.scrollerStyle = .overlay
        scrollView.documentView = document
        addSubview(scrollView)
        filterField.placeholderString = "Filter this page"
        filterField.font = .systemFont(ofSize: 10)
        filterField.delegate = self
        filterField.identifier = .init("library.filter")
        render()
    }
    required init?(coder: NSCoder) { nil }

    func update(state: ControlsState, exports: ExportsState) {
        let changed = state.library != self.state.library || state.service != self.state.service
            || state.storage != self.state.storage || state.storageRefreshing != self.state.storageRefreshing
            || state.storageFailure != self.state.storageFailure || exports != self.exports
            || state.libraryFailure != self.state.libraryFailure
        self.state = state
        self.exports = exports
        guard changed else { return }
        scrollPositions[tab] = scrollView.contentView.bounds.origin
        render()
    }
    /// The paging owner explicitly tells presentation when its page changes.
    func clearPageFilter() {
        filter = ""
        filterField.stringValue = ""
        scrollPositions[tab] = .zero
        scrollView.contentView.scroll(to: .zero)
        renderContent()
    }
    func control(identifier: String) -> NSControl? { controls[identifier] }
    func actionItem(identifier: String) -> NSMenuItem? { actionItems[identifier] }

    override func viewDidChangeEffectiveAppearance() {
        super.viewDidChangeEffectiveAppearance()
        effectiveAppearance.performAsCurrentDrawingAppearance {
            layer?.backgroundColor = NSColor.windowBackgroundColor.cgColor
            render()
        }
    }

    override func layout() {
        super.layout()
        render()
    }

    func controlTextDidChange(_ notification: Notification) {
        filter = filterField.stringValue
        renderContent()
    }

    private func label(_ text: String, frame: NSRect, size: CGFloat, weight: NSFont.Weight = .regular,
                       color: NSColor = .labelColor, in parent: NSView, wrap: Bool = false) {
        let field = NSTextField(wrappingLabelWithString: text)
        field.font = .systemFont(ofSize: size, weight: weight)
        field.textColor = color
        field.frame = frame
        field.lineBreakMode = wrap ? .byWordWrapping : .byTruncatingTail
        field.maximumNumberOfLines = wrap ? 0 : 1
        parent.addSubview(field)
    }
    private func button(_ title: String, id: String, frame: NSRect, action: ControlsAction?, enabled: Bool = true, in parent: NSView) {
        let button = NSButton(title: title, target: self, action: #selector(activate(_:)))
        button.bezelStyle = .rounded
        button.controlSize = .small
        button.font = .systemFont(ofSize: 10)
        button.frame = frame
        button.isEnabled = enabled
        button.identifier = .init(id)
        parent.addSubview(button)
        controls[id] = button
        if let action { actions[ObjectIdentifier(button)] = action }
    }
    private func render() {
        for view in subviews where view !== scrollView { view.removeFromSuperview() }
        controls = [:]
        actions = [:]
        tabActions = [:]
        actionItems = [:]
        let sidebar = NSView(frame: NSRect(x: 0, y: 0, width: 146, height: bounds.height))
        sidebar.wantsLayer = true
        sidebar.layer?.backgroundColor = NSColor.controlBackgroundColor.cgColor
        addSubview(sidebar)
        let divider = NSBox(frame: NSRect(x: 145, y: 0, width: 1, height: bounds.height))
        divider.boxType = .separator
        addSubview(divider)
        label("Your library", frame: NSRect(x: 20, y: 21, width: 116, height: 20), size: 12, weight: .semibold, in: self)
        for (index, value) in Tab.allCases.enumerated() {
            let button = LibraryTabButton(title: value.rawValue, selected: value == tab,
                symbol: value == .recordings ? "play.rectangle.on.rectangle" : value == .projects ? "doc.on.doc" : "square.and.arrow.up")
            button.frame = NSRect(x: 11, y: 54 + CGFloat(index) * 41, width: 124, height: 35)
            button.identifier = .init("tab.\(value.rawValue.lowercased())")
            button.target = self
            button.action = #selector(selectTab(_:))
            addSubview(button)
            controls["tab.\(value.rawValue.lowercased())"] = button
            tabActions[ObjectIdentifier(button)] = value
        }
        let storage = state.storage.map { ByteCountFormatter.string(fromByteCount: $0.totalBytes, countStyle: .file) } ?? "not measured"
        label("Stored on this Mac\nStorage: \(storage)", frame: NSRect(x: 20, y: max(200, bounds.height - 80), width: 114, height: 40), size: 10, color: .secondaryLabelColor, in: self, wrap: true)
        button("Refresh storage", id: "storage.refresh", frame: NSRect(x: 11, y: max(244, bounds.height - 36), width: 124, height: 24), action: .refreshStorage, enabled: state.service == .ready && !state.storageRefreshing, in: self)
        renderContent()
    }

    private func renderContent() {
        let oldOrigin = scrollView.contentView.bounds.origin
        for view in document.subviews where view !== filterField { view.removeFromSuperview() }
        controls = controls.filter { $0.key.hasPrefix("tab.") || $0.key == "storage.refresh" }
        let retained = Set(controls.values.map(ObjectIdentifier.init))
        actions = actions.filter { retained.contains($0.key) }
        actionItems = [:]
        let width = max(420, bounds.width - 146)
        scrollView.frame = NSRect(x: 146, y: 0, width: bounds.width - 146, height: bounds.height)
        label(tab.rawValue, frame: NSRect(x: 22, y: 23, width: width - 200, height: 29), size: 21, weight: .semibold, in: document)
        filterField.frame = NSRect(x: width - 154, y: 25, width: 132, height: 25)
        if filterField.superview !== document { document.addSubview(filterField) }
        controls["library.filter"] = filterField
        let subtitle = tab == .recordings ? "Your original captures. Always kept intact." : tab == .projects ? "Projects you explicitly created." : "Tracked deliveries and unfinished recovery."
        label(subtitle, frame: NSRect(x: 22, y: 55, width: width - 44, height: 20), size: 11, color: .secondaryLabelColor, in: document)
        label(tab == .exports ? "DELIVERIES" : "THIS PAGE", frame: NSRect(x: 22, y: 88, width: width - 44, height: 16), size: 10, weight: .semibold, color: .secondaryLabelColor, in: document)
        let page: SavedPage
        switch tab {
        case .recordings: page = LibraryPresentation.recordings(for: state)
        case .projects: page = LibraryPresentation.projects(for: state, exports: exports)
        case .exports: page = ExportPresentation.items(for: state, exports: exports)
        }
        var y: CGFloat = 114
        for failure in [state.libraryFailure, state.storageFailure].compactMap({ $0 }) {
            let measured = (failure as NSString).boundingRect(with: NSSize(width: width - 44, height: .greatestFiniteMagnitude), options: [.usesLineFragmentOrigin], attributes: [.font: NSFont.systemFont(ofSize: 12)])
            let height = max(38, ceil(measured.height))
            label(failure, frame: NSRect(x: 22, y: y, width: width - 44, height: height), size: 12, color: .secondaryLabelColor, in: document, wrap: true)
            y += height + 6
        }
        for row in page.items {
            guard row.kind != .message else {
                label(row.title, frame: NSRect(x: 22, y: y, width: width - 44, height: 38), size: 12, color: .secondaryLabelColor, in: document, wrap: true)
                y += 44
                continue
            }
            let details = row.details
            guard filter.isEmpty || ([row.title] + details).contains(where: { $0.localizedCaseInsensitiveContains(filter) }) else { continue }
            // Truthful fallback: a source/document symbol, never a generated media thumbnail.
            let thumbnail = NSImageView(frame: NSRect(x: 22, y: y + 13, width: 88, height: 56))
            thumbnail.wantsLayer = true
            thumbnail.layer?.backgroundColor = NSColor.controlBackgroundColor.cgColor
            thumbnail.layer?.cornerRadius = 7
            thumbnail.image = NSImage(systemSymbolName: tab == .recordings ? "video" : tab == .projects ? "doc.on.doc" : "square.and.arrow.up", accessibilityDescription: "Source icon; thumbnail unavailable")
            thumbnail.contentTintColor = .secondaryLabelColor
            document.addSubview(thumbnail)
            let titleWidth = width - 214
            label(row.title, frame: NSRect(x: 122, y: y + 13, width: titleWidth - 68, height: 20), size: 11, weight: .semibold, in: document)
            if let status = row.status {
                label(status, frame: NSRect(x: width - 119, y: y + 17, width: 63, height: 42), size: 9, color: .secondaryLabelColor, in: document, wrap: true)
            }
            var detailY = y + 39
            for detail in details {
                let font = NSFont.systemFont(ofSize: 11)
                let rect = (detail as NSString).boundingRect(with: NSSize(width: titleWidth, height: .greatestFiniteMagnitude), options: [.usesLineFragmentOrigin], attributes: [.font: font])
                let height = max(16, ceil(rect.height))
                label(detail, frame: NSRect(x: 122, y: detailY, width: titleWidth, height: height), size: 11, color: .secondaryLabelColor, in: document, wrap: true)
                detailY += height + 3
            }
            let commands = row.actions
            let more = NSPopUpButton(frame: NSRect(x: width - 49, y: y + 16, width: 27, height: 26), pullsDown: true)
            more.isBordered = false
            (more.cell as? NSPopUpButtonCell)?.arrowPosition = .noArrow
            more.font = .systemFont(ofSize: 18)
            let menu = NSMenu()
            menu.autoenablesItems = false
            menu.addItem(NSMenuItem(title: "⋯", action: nil, keyEquivalent: ""))
            for command in commands {
                let action = command.action
                let item = NSMenuItem(title: command.title, action: #selector(activateItem(_:)), keyEquivalent: "")
                item.target = self
                item.isEnabled = command.enabled
                item.representedObject = action
                actionItems[action.id] = item
                menu.addItem(item)
            }
            more.menu = menu
            more.setAccessibilityLabel("Actions for \(row.title)")
            let id = row.id
            more.identifier = .init("actions.\(id)")
            document.addSubview(more)
            controls["actions.\(id)"] = more
            y = max(y + 82, detailY + 13)
            let rule = NSBox(frame: NSRect(x: 22, y: y, width: width - 44, height: 1))
            rule.boxType = .separator
            document.addSubview(rule)
            y += 1
        }
        if y == 114 {
            label(filter.isEmpty ? "No tracked deliveries." : "No items match this page filter.", frame: NSRect(x: 22, y: y, width: width - 44, height: 44), size: 12, color: .secondaryLabelColor, in: document, wrap: true)
            y += 50
        }
        if !page.actions.isEmpty {
            y += 12
            let buttonWidth = min(142, (width - 44 - CGFloat(page.actions.count - 1) * 8) / CGFloat(page.actions.count))
            for (index, command) in page.actions.enumerated() {
                button(command.title, id: command.action.id, frame: NSRect(x: 22 + CGFloat(index) * (buttonWidth + 8), y: y, width: buttonWidth, height: 26), action: command.action, enabled: command.enabled, in: document)
            }
            y += 32
        }
        if tab == .recordings && page.items.contains(where: { $0.kind == .recording }) {
            y += 19
            let note = NSView(frame: NSRect(x: 22, y: y, width: width - 44, height: 76))
            note.wantsLayer = true
            note.layer?.cornerRadius = 9
            note.layer?.backgroundColor = NSColor.controlBackgroundColor.cgColor
            note.layer?.borderWidth = 1
            note.layer?.borderColor = NSColor.separatorColor.cgColor
            document.addSubview(note)
            label("Ready for your agent", frame: NSRect(x: 35, y: y + 12, width: width - 70, height: 18), size: 10, weight: .semibold, color: .secondaryLabelColor, in: document)
            label("Choose a recording, then ask your agent for the edit you want. Projects appear separately when explicitly created.", frame: NSRect(x: 35, y: y + 34, width: width - 70, height: 34), size: 10, color: .secondaryLabelColor, in: document, wrap: true)
            y += 76
        }
        document.frame = NSRect(x: 0, y: 0, width: width, height: max(bounds.height, y + 22))
        scrollView.contentView.scroll(to: oldOrigin)
        scrollView.reflectScrolledClipView(scrollView.contentView)
    }
    @objc private func activate(_ sender: NSControl) {
        guard sender.isEnabled, let action = actions[ObjectIdentifier(sender)] else { return }
        perform(action)
    }
    @objc private func activateItem(_ sender: NSMenuItem) {
        guard sender.isEnabled, let action = sender.representedObject as? ControlsAction else { return }
        perform(action)
    }
    @objc private func selectTab(_ sender: NSButton) {
        guard let value = tabActions[ObjectIdentifier(sender)] else { return }
        scrollPositions[tab] = scrollView.contentView.bounds.origin
        tab = value
        filter = ""
        filterField.stringValue = ""
        render()
        scrollView.contentView.scroll(to: scrollPositions[tab] ?? .zero)
        scrollView.reflectScrolledClipView(scrollView.contentView)
    }
}

@MainActor
private final class LibraryDocument: NSView { override var isFlipped: Bool { true } }

@MainActor
private final class LibraryTabButton: NSButton {
    private let selected: Bool
    private let symbol: String
    override var isFlipped: Bool { true }
    init(title: String, selected: Bool, symbol: String) {
        self.selected = selected
        self.symbol = symbol
        super.init(frame: .zero)
        self.title = title
        isBordered = false
        setButtonType(.momentaryChange)
        setAccessibilityElement(true)
        setAccessibilityRole(.radioButton)
        setAccessibilityLabel(title)
        setAccessibilityValue(NSNumber(value: selected))
    }
    required init?(coder: NSCoder) { nil }
    override func draw(_ dirtyRect: NSRect) {
        if selected {
            NSColor.systemBlue.withAlphaComponent(0.12).setFill()
            NSBezierPath(roundedRect: bounds, xRadius: 7, yRadius: 7).fill()
        }
        let color: NSColor = selected ? .systemBlue : .secondaryLabelColor
        if let image = NSImage(systemSymbolName: symbol, accessibilityDescription: nil)?.withSymbolConfiguration(.init(paletteColors: [color])) {
            image.draw(in: NSRect(x: 10, y: 9, width: 17, height: 17))
        }
        (title as NSString).draw(at: NSPoint(x: 35, y: 10), withAttributes: [.font: NSFont.systemFont(ofSize: 11, weight: selected ? .semibold : .regular), .foregroundColor: color])
    }
}

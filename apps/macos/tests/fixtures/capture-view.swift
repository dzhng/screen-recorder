import AppKit
import YapControls

@main struct CaptureViewCheck {
    @MainActor static func main() {
        NSApplication.shared.setActivationPolicy(.prohibited)
        var regions: [CGRect?] = []
        let regionView = RegionSelectionView(frame: NSRect(x: 0, y: 0, width: 200, height: 200)) { regions.append($0) }
        func mouse(_ type: NSEvent.EventType, _ x: CGFloat, _ y: CGFloat) -> NSEvent {
            NSEvent.mouseEvent(with: type, location: NSPoint(x: x, y: y), modifierFlags: [],
                              timestamp: 0, windowNumber: 0, context: nil, eventNumber: 0,
                              clickCount: 1, pressure: 1)!
        }
        regionView.mouseDown(with: mouse(.leftMouseDown, 10, 20))
        regionView.mouseUp(with: mouse(.leftMouseUp, 10, 20))
        precondition(regions.isEmpty, "A simple click must leave the area chooser open for a drag")
        regionView.mouseDown(with: mouse(.leftMouseDown, 10, 20))
        regionView.mouseUp(with: mouse(.leftMouseUp, 70, 100))
        precondition(regions == [CGRect(x: 10, y: 100, width: 60, height: 80)], "A drag completes selection in display-local coordinates")
        var recorded: [CaptureViewIntent] = []
        let input = fixture()
        let appIcon = NSImage(contentsOfFile: CommandLine.arguments[2])!
        let view = CaptureView(appIcon: appIcon, input: input) { recorded.append($0) }
        let rowIcons = view.scrollView.documentView!.subviews.compactMap { $0 as? NSImageView }.filter { $0.frame.width == 16 }
        for icon in rowIcons {
            let bitmap = NSBitmapImageRep(data: icon.image!.tiffRepresentation!)!
            var brightest: CGFloat = 0
            for y in 0..<bitmap.pixelsHigh {
                for x in 0..<bitmap.pixelsWide {
                    if let color = bitmap.colorAt(x: x, y: y)?.usingColorSpace(.deviceRGB), color.alphaComponent > 0.2 {
                        brightest = max(brightest, max(color.redComponent, color.greenComponent, color.blueComponent))
                    }
                }
            }
            precondition(brightest > 0.4, "Row icons must contrast with the dark surface on initial construction")
        }
        precondition(view.control(identifier: "library.open") == nil, "Library has one entry point in the header")
        let library = view.control(identifier: "header.library") as! NSButton
        library.performClick(nil)
        precondition(recorded == [.openLibrary], "Header library action reaches the caller")
        recorded.removeAll()
        view.frame.size = NSSize(width: CaptureView.preferredWidth, height: view.contentHeight)
        let window = NSWindow(contentRect: NSRect(x: -10000, y: -10000, width: CaptureView.preferredWidth, height: view.contentHeight),
            styleMask: .borderless, backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false
        window.contentView = view
        window.orderBack(nil)
        RunLoop.current.run(until: Date().addingTimeInterval(0.2))
        let popover = CapturePopover { recorded.append($0) }
        popover.update(input)
        popover.toggle(relativeTo: view)
        RunLoop.current.run(until: Date().addingTimeInterval(0.1))
        precondition(popover.view?.effectiveAppearance.bestMatch(from: [.aqua, .darkAqua]) == .darkAqua,
                     "First popover presentation must use dark appearance")
        precondition(!NSApp.isActive, "The prohibited offscreen fixture must not activate the desktop")
        popover.close()
        popover.toggle(relativeTo: view)
        RunLoop.current.run(until: Date().addingTimeInterval(0.1))
        precondition(popover.isShown, "The explicit dismissal panel must reopen cleanly")
        NotificationCenter.default.post(name: NSApplication.didResignActiveNotification, object: NSApp)
        precondition(!popover.isShown, "Switching applications must dismiss the recording panel")
        popover.close()
        guard let button = view.control(identifier: "source.cameraOnly") as? NSButton else {
            preconditionFailure("Camera Only must be an explicit source choice")
        }
        button.performClick(nil)
        precondition(recorded == [.chooseSource(.cameraOnly)], "Source choice reaches caller unchanged")
        guard let microphone = view.control(identifier: "microphone.toggle") as? NSSwitch else {
            preconditionFailure("Microphone uses the native macOS switch")
        }
        precondition(microphone.state == .on, "Assistive clients can read the supplied microphone on state")
        microphone.performClick(nil)
        let camera = view.control(identifier: "camera.device") as! NSPopUpButton
        camera.selectItem(at: 1)
        _ = camera.sendAction(camera.action!, to: camera.target)
        precondition(recorded == [.chooseSource(.cameraOnly), .controls(.disableMicrophone), .camera("fixture-camera")])
        window.orderOut(nil)
        window.close()
        let selectedSource = CaptureView(appIcon: appIcon, input: fixture(secondSource: true)) { recorded.append($0) }
        let sourcePopup = selectedSource.control(identifier: "source.device") as! NSPopUpButton
        precondition(sourcePopup.titleOfSelectedItem == "Studio Display", "Rebuilding preserves the owner-selected source device")
        let duplicate = CaptureView(appIcon: appIcon, input: fixture(duplicateNames: true)) { recorded.append($0) }
        let duplicateCamera = duplicate.control(identifier: "camera.device") as! NSPopUpButton
        duplicateCamera.selectItem(at: duplicateCamera.numberOfItems - 1)
        _ = duplicateCamera.sendAction(duplicateCamera.action!, to: duplicateCamera.target)
        precondition(duplicateCamera.titleOfSelectedItem == "Another camera")
        precondition(recorded.last == .camera("fixture-camera-third"), "A chooser preserves identity when device labels repeat")
        let silentMic = CaptureView(appIcon: appIcon, input: fixture(microphoneOn: false)) { recorded.append($0) }
        let micEnable = silentMic.control(identifier: "microphone.toggle") as! NSSwitch
        precondition(micEnable.state == .off, "Assistive clients can read the supplied microphone off state")
        micEnable.performClick(nil)
        precondition(recorded.last == .controls(.selectMicrophone("fixture-mic")), "Enabling a named microphone preserves its displayed identity")
        var lockedActions: [CaptureViewIntent] = []
        let locked = CaptureView(appIcon: appIcon, input: fixture(locked: true)) { lockedActions.append($0) }
        for id in ["source.cameraOnly", "microphone.toggle", "capture.start"] {
            let control = locked.control(identifier: id)!
            precondition(!control.isEnabled, "Locked take inputs and unavailable Start cannot accept actions")
            if let button = control as? NSButton { button.performClick(nil) }
            if let toggle = control as? NSSwitch { toggle.performClick(nil) }
        }
        precondition(lockedActions.isEmpty, "Inapplicable actions cannot escape the view")
        let permissions = CaptureView(appIcon: appIcon, input: permissionFixture()) { recorded.append($0) }
        for id in ["source.display", "source.window", "source.area", "source.device"] {
            precondition(!permissions.control(identifier: id)!.isEnabled, "Screen selection must be disabled without permission: \(id)")
        }
        precondition(permissions.control(identifier: "source.cameraOnly")!.isEnabled,
                     "Missing screen access must not disable camera-only capture")
        precondition((permissions.control(identifier: "source.device") as! NSPopUpButton).titleOfSelectedItem == "Screen Recording access required",
                     "The disabled source chooser must explain the missing permission")
        let screenAccess = permissions.control(identifier: "permission.screen") as! NSButton
        screenAccess.performClick(nil)
        precondition(recorded.last == .controls(.requestScreenPermission), "Permission rows dispatch the supplied access request")
        precondition(screenAccess.frame.height <= 30, "Permission actions fit a compact single-line row")
        var authorized = permissionFixture()
        authorized.screenSourcesEnabled = true
        authorized.permissionActions = []
        authorized.notices = []
        permissions.update(authorized)
        for id in ["source.display", "source.window", "source.area", "source.device"] {
            precondition(permissions.control(identifier: id)!.isEnabled, "Granting access must re-enable screen selection: \(id)")
        }
        let output = CommandLine.arguments[1]
        var observations: [[String: Any]] = []
        for (name, facts, limit) in [
            ("idle", fixture(), CGFloat(0)),
            ("camera-only", fixture(cameraOnly: true), CGFloat(0)),
            ("permissions", permissionFixture(), CGFloat(0)),
            ("permissions-dark", permissionFixture(), CGFloat(0)),
            ("dark", fixture(), CGFloat(0)),
            ("long-names", fixture(longNames: true), CGFloat(0)),
            ("short-screen", fixture(longNames: true), CGFloat(440)),
        ] {
            let capture = CaptureView(appIcon: appIcon, input: facts) { recorded.append($0) }
            let height = limit > 0 ? limit : capture.contentHeight
            let stage = NSView(frame: NSRect(x: 0, y: 0, width: CaptureView.preferredWidth + 40, height: height + 40))
            stage.wantsLayer = true
            // Layout shots supply a dark backing; they do not verify composited native glass.
            stage.layer?.backgroundColor = NSColor(white: 0.10, alpha: 1).cgColor
            capture.frame = NSRect(x: 20, y: 20, width: CaptureView.preferredWidth, height: height)
            stage.addSubview(capture)
            let caption = NSTextField(labelWithString: "Synthetic facts · presentation fixture")
            caption.font = .systemFont(ofSize: 9)
            caption.textColor = .secondaryLabelColor
            caption.frame = NSRect(x: 20, y: 2, width: CaptureView.preferredWidth, height: 14)
            stage.addSubview(caption)
            let shotWindow = NSWindow(contentRect: NSRect(x: -10000, y: -10000, width: CaptureView.preferredWidth + 40, height: height + 40), styleMask: .borderless, backing: .buffered, defer: false)
            shotWindow.isReleasedWhenClosed = false
            shotWindow.appearance = NSAppearance(named: name.contains("dark") ? .darkAqua : .aqua)
            shotWindow.contentView = stage
            shotWindow.orderBack(nil)
            RunLoop.current.run(until: Date().addingTimeInterval(0.15))
            capture.layoutSubtreeIfNeeded()
            if limit == 0 {
                let start = capture.control(identifier: "capture.start")!
                let rect = start.convert(start.bounds, to: capture.scrollView.documentView!)
                precondition(capture.scrollView.contentView.bounds.contains(rect), "The full-height view must show the complete Start button without scrolling")
            }
            func save(_ suffix: String) {
                let bitmap = stage.bitmapImageRepForCachingDisplay(in: stage.bounds)!
                stage.cacheDisplay(in: stage.bounds, to: bitmap)
                try! bitmap.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: "\(output)/\(name)\(suffix).png"))
            }
            save("")
            let scroll = capture.scrollView
            let doc = scroll.documentView!
            let quit = capture.control(identifier: "app.quit")!
            let anchoredQuit = quit.convert(quit.bounds, to: capture)
            let ids = ["header.library", "header.settings", "source.display", "source.window", "source.area", "source.cameraOnly", "camera.device", "microphone.device", "microphone.toggle", "systemAudio.toggle", "countdown.toggle", "capture.start", "app.quit"] + (facts.selectedSource == .cameraOnly ? [] : ["source.device", "camera.toggle"])
            var frames: [String: [Double]] = [:]
            for id in ids {
                let control = capture.control(identifier: id)!
                let rect = control.convert(control.bounds, to: doc)
                frames[id] = [rect.minX, rect.minY, rect.width, rect.height]
            }
            observations.append(["fixture": name, "facts": "synthetic; no service/devices/permissions", "appearance": name.contains("dark") ? "darkAqua" : "aqua", "widthPoints": CaptureView.preferredWidth, "heightPoints": height, "contentHeightPoints": capture.contentHeight, "backingScale": shotWindow.backingScaleFactor, "controls": frames])
            // Retain the complete operands before a reachability assertion can stop the run.
            let report = try! JSONSerialization.data(withJSONObject: observations, options: [.prettyPrinted, .sortedKeys])
            try! report.write(to: URL(fileURLWithPath: "\(output)/native-metadata.json"))
            for id in ids {
                let control = capture.control(identifier: id)!
                let rect = control.convert(control.bounds, to: doc)
                // The status footer is fixed to the capture surface rather than part of the
                // scrolling document. It is reachable without moving the document.
                if id == "app.quit" {
                    precondition(capture.bounds.contains(control.convert(control.bounds, to: capture)), "Fixed footer action must remain visible: \(id)")
                    continue
                }
                doc.scrollToVisible(rect)
                scroll.reflectScrolledClipView(scroll.contentView)
                precondition(scroll.contentView.bounds.contains(rect), "Scrolling must reveal the complete action: \(id)")
                precondition(quit.convert(quit.bounds, to: capture) == anchoredQuit, "Scrolling must not move the status footer")
            }
            if name == "short-screen" {
                doc.scrollToVisible(NSRect(x: 0, y: doc.bounds.height - 1, width: 1, height: 1))
                scroll.reflectScrolledClipView(scroll.contentView)
                RunLoop.current.run(until: Date().addingTimeInterval(0.1))
                save("-bottom")
                precondition(scroll.contentView.bounds.minY > 0, "Short-screen fixture must scroll")
                let start = capture.control(identifier: "capture.start") as! NSButton
                start.performClick(nil)
                precondition(recorded.last == .controls(.startOrStop), "Scrolled Start remains actionable")
            }
            shotWindow.orderOut(nil)
            shotWindow.close()
        }
    }

    @MainActor static func permissionFixture() -> CaptureViewInput {
        var input = fixture(startEnabled: false, status: "Idle")
        input.screenSourcesEnabled = false
        input.notices = [CapturePresentation.screenSelectionPermissionNotice]
        input.permissionActions = [.init(.requestScreenPermission, "Allow in System Settings…", enabled: true), .init(.requestMicrophonePermission, "Allow Microphone Access…", enabled: true)]
        return input
    }

    @MainActor static func fixture(locked: Bool = false, cameraOnly: Bool = false, longNames: Bool = false, duplicateNames: Bool = false, microphoneOn: Bool = true, secondSource: Bool = false, startEnabled: Bool? = nil, status: String = "Ready to record") -> CaptureViewInput {
        .init(selectedSource: cameraOnly ? .cameraOnly : .display, selectedSourceChoice: secondSource ? 1 : 0, sourceChoices: [.init(title: longNames ? "A very long external display name for a conference studio · 5120 × 2880" : "Built-in Retina Display · 3024 × 1964", intent: .controls(.selectDisplay(1)))] + (secondSource ? [.init(title: "Studio Display", intent: .controls(.selectDisplay(2)))] : []),
            cameraChoices: (cameraOnly ? [] : [.init(title: "No camera", intent: .camera(nil))]) + [.init(title: longNames ? "Conference room camera with an unusually long name" : "FaceTime HD Camera", intent: .camera("fixture-camera"))] + (duplicateNames ? [.init(title: "FaceTime HD Camera", intent: .camera("fixture-camera-second")), .init(title: "Another camera", intent: .camera("fixture-camera-third"))] : []),
            selectedCamera: cameraOnly ? 0 : longNames ? 1 : 0, cameraOn: cameraOnly || longNames,
            microphoneChoices: [.init(title: longNames ? "Conference room microphone with an unusually long name" : "MacBook Pro Microphone", intent: .controls(.selectMicrophone("fixture-mic")))],
            selectedMicrophone: 0, microphoneOn: microphoneOn, systemAudio: true, countdown: true,
            inputsEnabled: !locked, startEnabled: startEnabled ?? !locked, status: status)
    }
}

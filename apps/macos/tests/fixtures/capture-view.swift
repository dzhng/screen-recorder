import AppKit
import ScreenRecorderControls

@main struct CaptureViewCheck {
    @MainActor static func main() {
        NSApplication.shared.setActivationPolicy(.prohibited)
        var recorded: [CaptureViewIntent] = []
        let input = fixture()
        let view = CaptureView(input: input) { recorded.append($0) }
        view.frame.size = NSSize(width: 352, height: view.contentHeight)
        let window = NSWindow(contentRect: NSRect(x: -10000, y: -10000, width: 352, height: view.contentHeight),
            styleMask: .borderless, backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false
        window.contentView = view
        window.orderBack(nil)
        RunLoop.current.run(until: Date().addingTimeInterval(0.2))
        guard let button = view.control(identifier: "source.cameraOnly") as? NSButton else {
            preconditionFailure("Camera Only must be an explicit source choice")
        }
        button.performClick(nil)
        precondition(recorded == [.chooseSource(.cameraOnly)], "Source choice reaches caller unchanged")
        let microphone = view.control(identifier: "microphone.toggle") as! NSButton
        precondition((microphone.accessibilityValue() as? NSNumber)?.boolValue == true, "Assistive clients can read the supplied microphone on state")
        microphone.performClick(nil)
        let camera = view.control(identifier: "camera.device") as! NSPopUpButton
        camera.selectItem(at: 1)
        _ = camera.sendAction(camera.action!, to: camera.target)
        precondition(recorded == [.chooseSource(.cameraOnly), .controls(.disableMicrophone), .camera("fixture-camera")])
        window.orderOut(nil)
        window.close()
        let selectedSource = CaptureView(input: fixture(secondSource: true)) { recorded.append($0) }
        let sourcePopup = selectedSource.control(identifier: "source.device") as! NSPopUpButton
        precondition(sourcePopup.titleOfSelectedItem == "Studio Display", "Rebuilding preserves the owner-selected source device")
        let duplicate = CaptureView(input: fixture(duplicateNames: true)) { recorded.append($0) }
        let duplicateCamera = duplicate.control(identifier: "camera.device") as! NSPopUpButton
        duplicateCamera.selectItem(at: duplicateCamera.numberOfItems - 1)
        _ = duplicateCamera.sendAction(duplicateCamera.action!, to: duplicateCamera.target)
        precondition(duplicateCamera.titleOfSelectedItem == "Another camera")
        precondition(recorded.last == .camera("fixture-camera-third"), "A chooser preserves identity when device labels repeat")
        let silentMic = CaptureView(input: fixture(microphoneOn: false)) { recorded.append($0) }
        let micEnable = silentMic.control(identifier: "microphone.toggle") as! NSButton
        precondition((micEnable.accessibilityValue() as? NSNumber)?.boolValue == false, "Assistive clients can read the supplied microphone off state")
        micEnable.performClick(nil)
        precondition(recorded.last == .controls(.selectMicrophone("fixture-mic")), "Enabling a named microphone preserves its displayed identity")
        var lockedActions: [CaptureViewIntent] = []
        let locked = CaptureView(input: fixture(locked: true)) { lockedActions.append($0) }
        for id in ["source.cameraOnly", "microphone.toggle", "capture.start"] {
            let control = locked.control(identifier: id) as! NSButton
            precondition(!control.isEnabled, "Locked take inputs and unavailable Start cannot accept actions")
            control.performClick(nil)
        }
        precondition(lockedActions.isEmpty, "Inapplicable actions cannot escape the view")
        let output = CommandLine.arguments[1]
        var observations: [[String: Any]] = []
        for (name, facts, limit) in [
            ("idle", fixture(), CGFloat(0)),
            ("camera-only", fixture(cameraOnly: true), CGFloat(0)),
            ("long-names", fixture(longNames: true), CGFloat(0)),
            ("short-screen", fixture(longNames: true), CGFloat(440)),
        ] {
            let capture = CaptureView(input: facts) { recorded.append($0) }
            let height = limit > 0 ? limit : capture.contentHeight
            let stage = NSView(frame: NSRect(x: 0, y: 0, width: 392, height: height + 40))
            stage.wantsLayer = true
            stage.layer?.backgroundColor = NSColor(white: 0.93, alpha: 1).cgColor
            capture.frame = NSRect(x: 20, y: 20, width: 352, height: height)
            stage.addSubview(capture)
            let caption = NSTextField(labelWithString: "Synthetic facts · presentation fixture")
            caption.font = .systemFont(ofSize: 9)
            caption.textColor = .secondaryLabelColor
            caption.frame = NSRect(x: 20, y: 2, width: 352, height: 14)
            stage.addSubview(caption)
            let shotWindow = NSWindow(contentRect: NSRect(x: -10000, y: -10000, width: 392, height: height + 40), styleMask: .borderless, backing: .buffered, defer: false)
            shotWindow.isReleasedWhenClosed = false
            shotWindow.appearance = NSAppearance(named: .aqua)
            shotWindow.contentView = stage
            shotWindow.orderBack(nil)
            RunLoop.current.run(until: Date().addingTimeInterval(0.15))
            capture.layoutSubtreeIfNeeded()
            func save(_ suffix: String) {
                let bitmap = stage.bitmapImageRepForCachingDisplay(in: stage.bounds)!
                stage.cacheDisplay(in: stage.bounds, to: bitmap)
                try! bitmap.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: "\(output)/\(name)\(suffix).png"))
            }
            save("")
            let scroll = capture.scrollView
            let doc = scroll.documentView!
            let ids = ["header.library", "header.settings", "source.display", "source.window", "source.area", "source.cameraOnly", "camera.device", "microphone.device", "microphone.toggle", "systemAudio.toggle", "countdown.toggle", "capture.start", "library.open", "app.quit"] + (facts.selectedSource == .cameraOnly ? [] : ["source.device", "camera.toggle"])
            var frames: [String: [Double]] = [:]
            for id in ids {
                let control = capture.control(identifier: id)!
                let rect = control.convert(control.bounds, to: doc)
                frames[id] = [rect.minX, rect.minY, rect.width, rect.height]
            }
            observations.append(["fixture": name, "facts": "synthetic; no service/devices/permissions", "appearance": "aqua", "widthPoints": 352, "heightPoints": height, "contentHeightPoints": capture.contentHeight, "backingScale": shotWindow.backingScaleFactor, "controls": frames])
            // Retain the complete operands before a reachability assertion can stop the run.
            let report = try! JSONSerialization.data(withJSONObject: observations, options: [.prettyPrinted, .sortedKeys])
            try! report.write(to: URL(fileURLWithPath: "\(output)/native-metadata.json"))
            for id in ids {
                let control = capture.control(identifier: id)!
                let rect = control.convert(control.bounds, to: doc)
                doc.scrollToVisible(rect)
                scroll.reflectScrolledClipView(scroll.contentView)
                precondition(scroll.contentView.bounds.contains(rect), "Scrolling must reveal the complete action: \(id)")
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

    @MainActor static func fixture(locked: Bool = false, cameraOnly: Bool = false, longNames: Bool = false, duplicateNames: Bool = false, microphoneOn: Bool = true, secondSource: Bool = false) -> CaptureViewInput {
        .init(selectedSource: cameraOnly ? .cameraOnly : .display, selectedSourceChoice: secondSource ? 1 : 0, sourceChoices: [.init(title: longNames ? "A very long external display name for a conference studio · 5120 × 2880" : "Built-in Retina Display · 3024 × 1964", intent: .controls(.selectDisplay(1)))] + (secondSource ? [.init(title: "Studio Display", intent: .controls(.selectDisplay(2)))] : []),
            cameraChoices: (cameraOnly ? [] : [.init(title: "No camera", intent: .camera(nil))]) + [.init(title: longNames ? "Conference room camera with an unusually long name" : "FaceTime HD Camera", intent: .camera("fixture-camera"))] + (duplicateNames ? [.init(title: "FaceTime HD Camera", intent: .camera("fixture-camera-second")), .init(title: "Another camera", intent: .camera("fixture-camera-third"))] : []),
            selectedCamera: cameraOnly ? 0 : longNames ? 1 : 0, cameraOn: cameraOnly || longNames,
            microphoneChoices: [.init(title: longNames ? "Conference room microphone with an unusually long name" : "MacBook Pro Microphone", intent: .controls(.selectMicrophone("fixture-mic")))],
            selectedMicrophone: 0, microphoneOn: microphoneOn, systemAudio: true, countdown: true,
            inputsEnabled: !locked, startEnabled: !locked, status: "Ready to record")
    }
}

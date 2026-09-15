import AppKit
import Darwin
import ScreenCaptureKit
import ScreenRecorderCapture

private struct ProbeRequest: Decodable {
    let capture: CaptureRequest
    let durationSeconds: Double
    let pauseAtSeconds: Double?
    let pauseSeconds: Double?
    let closeFixtureAtSeconds: Double?
    let hideFixtureAtSeconds: Double?
    let minimizeFixtureAtSeconds: Double?
}

@MainActor
func runCaptureProbe() async {
    var activeCapture: NativeCapture?
    var fixtureWindow: NSWindow?
    var outputDirectory: String?
    var fixtureProcess: Process?
    func finishProbe(_ status: Int32) -> Never {
        if let fixtureProcess, fixtureProcess.isRunning {
            fixtureProcess.terminate()
            fixtureProcess.waitUntilExit()
        }
        fixtureWindow?.close()
        exit(status)
    }
    do {
        let args = CommandLine.arguments
        switch args[1] {
        case "--fixture-window":
            fixtureWindow = makeCaptureFixtureWindow()
            try emit(["windowID": fixtureWindow!.windowNumber])
            try await Task.sleep(for: .seconds(3600))
        case "--capture-preflight":
            try emit(
                [
                    "screen": NativeCapture.screenPermission,
                    "microphone": NativeCapture.microphonePermission,
                ] as [String: Any])
        case "--capture-permission":
            guard args.count == 3 else {
                throw CaptureFailure("INVALID_REQUEST", "Pass screen or microphone.")
            }
            let granted = try await NativeCapture.requestPermission(args[2])
            try emit(["permission": args[2], "granted": granted] as [String: Any])
        case "--capture-sources":
            guard NativeCapture.screenPermission else {
                throw CaptureFailure(
                    "PERMISSION_REQUIRED", "Screen recording permission is not authorized.")
            }
            let content = try await SCShareableContent.excludingDesktopWindows(
                false, onScreenWindowsOnly: true)
            try emit([
                "displays": content.displays.map {
                    ["id": $0.displayID, "width": $0.width, "height": $0.height]
                },
                "windows": content.windows.map {
                    [
                        "id": $0.windowID, "title": $0.title ?? "",
                        "application": $0.owningApplication?.applicationName ?? "",
                    ]
                },
            ])
        case "--capture-probe":
            guard args.count == 3 else {
                throw CaptureFailure("INVALID_REQUEST", "Pass one probe JSON path.")
            }
            let data = try Data(contentsOf: URL(fileURLWithPath: args[2]))
            let probe = try JSONDecoder().decode(ProbeRequest.self, from: data)
            guard probe.durationSeconds.isFinite, probe.durationSeconds > 0,
                probe.durationSeconds <= 3600
            else {
                throw CaptureFailure(
                    "INVALID_REQUEST", "Probe duration must be between zero and one hour.")
            }
            if let pauseAt = probe.pauseAtSeconds {
                guard let pause = probe.pauseSeconds, pauseAt.isFinite, pause.isFinite, pauseAt > 0,
                    pause > 0, pauseAt + pause < probe.durationSeconds
                else {
                    throw CaptureFailure(
                        "INVALID_REQUEST", "Pause must fit inside the probe's elapsed duration.")
                }
            } else if probe.pauseSeconds != nil {
                throw CaptureFailure("INVALID_REQUEST", "pauseSeconds requires pauseAtSeconds.")
            }
            guard NativeCapture.screenPermission else {
                throw CaptureFailure(
                    "PERMISSION_REQUIRED",
                    "Screen recording permission is not authorized. No recording started.")
            }
            var request = probe.capture
            outputDirectory = request.outputDirectory
            for eventTime in [
                probe.closeFixtureAtSeconds, probe.hideFixtureAtSeconds,
                probe.minimizeFixtureAtSeconds,
            ].compactMap({ $0 }) {
                guard request.source.kind == "fixture", eventTime.isFinite, eventTime > 0,
                    eventTime < probe.durationSeconds
                else {
                    throw CaptureFailure(
                        "INVALID_REQUEST",
                        "Window-control probes require an event time inside the fixture duration.")
                }
            }
            if probe.closeFixtureAtSeconds != nil
                && (probe.hideFixtureAtSeconds != nil || probe.minimizeFixtureAtSeconds != nil)
            {
                throw CaptureFailure(
                    "INVALID_REQUEST",
                    "Run source destruction separately from hidden/minimized capture.")
            }
            if request.source.kind == "fixture" {
                guard !request.microphone, !request.systemAudio else {
                    throw CaptureFailure(
                        "INVALID_REQUEST",
                        "The automatic fixture probe requires microphone and system audio disabled."
                    )
                }
                if probe.closeFixtureAtSeconds != nil {
                    let process = Process()
                    process.executableURL = Bundle.main.executableURL
                    process.arguments = ["--fixture-window"]
                    let pipe = Pipe()
                    process.standardOutput = pipe
                    try process.run()
                    fixtureProcess = process
                    var descriptor = pollfd(
                        fd: pipe.fileHandleForReading.fileDescriptor, events: Int16(POLLIN),
                        revents: 0)
                    guard Darwin.poll(&descriptor, 1, 5000) > 0 else {
                        throw CaptureFailure(
                            "FIXTURE_FAILED", "Fixture owner did not start within five seconds.")
                    }
                    let response =
                        try JSONSerialization.jsonObject(
                            with: pipe.fileHandleForReading.availableData) as? [String: Any]
                    guard let windowID = response?["windowID"] as? UInt32 else {
                        throw CaptureFailure(
                            "FIXTURE_FAILED", "Fixture owner did not return a window ID.")
                    }
                    request.source = CaptureSource(kind: "window", windowID: windowID)
                } else {
                    fixtureWindow = makeCaptureFixtureWindow()
                    request.source = CaptureSource(
                        kind: "window", windowID: UInt32(fixtureWindow!.windowNumber))
                }
                try await Task.sleep(for: .milliseconds(500))
            }
            let capture = NativeCapture()
            activeCapture = capture
            try await capture.start(request)
            if let closeAt = probe.closeFixtureAtSeconds, let fixtureProcess {
                Task { @MainActor in
                    try await Task.sleep(for: .seconds(closeAt))
                    fixtureProcess.terminate()
                }
            }
            if let hideAt = probe.hideFixtureAtSeconds {
                Task { @MainActor in
                    try await Task.sleep(for: .seconds(hideAt))
                    fixtureWindow?.orderOut(nil)
                }
            }
            if let minimizeAt = probe.minimizeFixtureAtSeconds {
                Task { @MainActor in
                    try await Task.sleep(for: .seconds(minimizeAt))
                    fixtureWindow?.miniaturize(nil)
                }
            }
            if let pauseAt = probe.pauseAtSeconds, let pause = probe.pauseSeconds {
                try await Task.sleep(for: .seconds(pauseAt))
                try capture.pause()
                try await Task.sleep(for: .seconds(pause))
                try capture.resume()
                try await Task.sleep(for: .seconds(probe.durationSeconds - pauseAt - pause))
            } else {
                try await Task.sleep(for: .seconds(probe.durationSeconds))
            }
            let result = try await capture.stop()
            activeCapture = nil
            let resultData = try JSONEncoder().encode(result)
            try resultData.write(
                to: URL(fileURLWithPath: request.outputDirectory).appendingPathComponent(
                    "capture.json"), options: .atomic)
            FileHandle.standardOutput.write(resultData + Data([10]))
            fixtureWindow?.close()
            finishProbe(result.failure == nil ? 0 : 1)
        default:
            throw CaptureFailure("INVALID_REQUEST", "Unknown probe argument.")
        }
        finishProbe(0)
    } catch {
        if let activeCapture, let outputDirectory, let result = try? await activeCapture.stop(),
            let data = try? JSONEncoder().encode(result)
        {
            try? data.write(
                to: URL(fileURLWithPath: outputDirectory).appendingPathComponent("capture.json"),
                options: .atomic)
        }
        fixtureWindow?.close()
        let failure =
            (error as? CaptureFailure)
            ?? CaptureFailure("NATIVE_CAPTURE_FAILED", error.localizedDescription)
        if let data = try? JSONEncoder().encode(failure) {
            FileHandle.standardOutput.write(data + Data([10]))
        }
        finishProbe(1)
    }
}

private func emit(_ value: Any) throws {
    FileHandle.standardOutput.write(
        try JSONSerialization.data(withJSONObject: value, options: [.sortedKeys]) + Data([10]))
}

@MainActor
private func makeCaptureFixtureWindow() -> NSWindow {
    let window = NSWindow(
        contentRect: NSRect(x: 100, y: 100, width: 800, height: 500),
        styleMask: [.titled, .closable, .miniaturizable], backing: .buffered, defer: false)
    window.isReleasedWhenClosed = false
    window.title = "Screen Recorder Capture Fixture"
    window.contentView = CaptureFixtureView(frame: NSRect(x: 0, y: 0, width: 800, height: 500))
    window.makeKeyAndOrderFront(nil)
    NSApplication.shared.activate(ignoringOtherApps: true)
    return window
}

@MainActor
private final class CaptureFixtureView: NSView {
    override func draw(_ dirtyRect: NSRect) {
        NSColor.white.setFill()
        bounds.fill()
        let labels = ["TOP LEFT — A1", "TOP RIGHT — B2", "BOTTOM LEFT — C3", "BOTTOM RIGHT — D4"]
        let colors: [NSColor] = [.systemRed, .systemGreen, .systemBlue, .systemYellow]
        for index in 0..<4 {
            let rect = NSRect(
                x: CGFloat(index % 2) * bounds.width / 2, y: index < 2 ? bounds.height / 2 : 0,
                width: bounds.width / 2, height: bounds.height / 2)
            colors[index].setFill()
            rect.insetBy(dx: 8, dy: 8).fill()
            (labels[index] as NSString).draw(
                at: NSPoint(x: rect.minX + 24, y: rect.midY),
                withAttributes: [
                    .font: NSFont.boldSystemFont(ofSize: 22), .foregroundColor: NSColor.black,
                ])
        }
    }
}

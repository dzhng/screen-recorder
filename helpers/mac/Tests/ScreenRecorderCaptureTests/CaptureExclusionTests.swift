import ScreenRecorderCapture

private struct SharingApplication: Equatable {
    let bundleIdentifier: String
    let processID: Int
}

func runCaptureExclusionTests() {
    let recorder = "com.dzhng.screenrec"
    let onScreen = [
        SharingApplication(bundleIdentifier: "com.apple.Safari", processID: 11),
        SharingApplication(bundleIdentifier: recorder, processID: 22),
        SharingApplication(bundleIdentifier: "com.dzhng.screenrecorder", processID: 33),
        SharingApplication(bundleIdentifier: recorder, processID: 44),
    ]
    let excluded = CaptureExclusion.ownApplications(
        among: onScreen, bundleIdentifier: recorder, identity: \.bundleIdentifier)
    precondition(
        excluded == [onScreen[1], onScreen[3]],
        "A display take leaves out every process running this app, and nothing else: \(excluded)")

    for anonymous in [nil, ""] {
        precondition(
            CaptureExclusion.ownApplications(
                among: onScreen, bundleIdentifier: anonymous, identity: \.bundleIdentifier).isEmpty,
            "A process with no bundle identity records the whole display rather than guessing")
    }
    precondition(
        CaptureExclusion.ownApplications(
            among: onScreen, bundleIdentifier: "com.dzhng.screenrec.helper",
            identity: \.bundleIdentifier
        ).isEmpty,
        "Identity is the whole bundle identifier, never a prefix of somebody else's")
    print("PASS display capture excludes this app's own windows by bundle identity")
}

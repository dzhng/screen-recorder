import AppKit
import Darwin
import Sparkle

/// Thin SDK boundary. Sparkle owns schedule, preferences, authenticated downloads
/// and replacement; UpdateCoordinator owns the application's permission to install.
@MainActor
final class SparkleDriver: NSObject, SPUUpdaterDelegate, SPUUserDriver {
    private let owner: UpdateCoordinator
    private let terminate: () -> Void
    private var updater: SPUUpdater!
    private let catalogFormat: String
    private var downloadCancellation: (() -> Void)?

    init?(owner: UpdateCoordinator, bundle: Bundle = .main, terminate: @escaping () -> Void) {
        guard let feed = bundle.object(forInfoDictionaryKey: "SUFeedURL") as? String, !feed.isEmpty,
            let key = bundle.object(forInfoDictionaryKey: "SUPublicEDKey") as? String, !key.isEmpty,
            let format = bundle.object(forInfoDictionaryKey: "ScreenrecCatalogFormat") as? NSNumber,
            let relative = bundle.object(forInfoDictionaryKey: "ScreenrecLaunchLockRelativePath")
                as? String
        else { return nil }
        self.owner = owner
        self.terminate = terminate
        catalogFormat = format.stringValue
        super.init()
        do {
            try Self.prepareLock(relative)
            updater = SPUUpdater(
                hostBundle: bundle, applicationBundle: bundle, userDriver: self, delegate: self)
            try updater.start()
            owner.setAvailability(true, enabled: updater.automaticallyChecksForUpdates)
            owner.preferenceChanged = { [weak self] enabled in
                self?.updater.automaticallyChecksForUpdates = enabled
                if !enabled { self?.downloadCancellation?() }
            }
        } catch {
            owner.fail(code: "UPDATE_UNAVAILABLE", message: error.localizedDescription)
            return nil
        }
    }
    /// All aliases use this persistent private inode, before any SDK cycle starts.
    private static func prepareLock(_ relative: String) throws {
        guard !relative.hasPrefix("/"), !relative.split(separator: "/").contains("..") else {
            throw ServiceFailure(code: "UPDATE_LOCK_INVALID", message: "Invalid release launch lock")
        }
        let file = URL(fileURLWithPath: NSHomeDirectory()).appendingPathComponent(relative)
        try FileManager.default.createDirectory(
            at: file.deletingLastPathComponent(), withIntermediateDirectories: true,
            attributes: [.posixPermissions: 0o700])
        let descriptor = open(file.path, O_CREAT | O_RDWR | O_NOFOLLOW | O_CLOEXEC, 0o600)
        guard descriptor >= 0 else {
            throw ServiceFailure(code: "UPDATE_LOCK_INVALID", message: "Cannot create launch lock")
        }
        defer { close(descriptor) }
        var facts = stat()
        var pathFacts = stat()
        guard fstat(descriptor, &facts) == 0, (facts.st_mode & S_IFMT) == S_IFREG,
            facts.st_uid == getuid(), facts.st_nlink == 1, (facts.st_mode & 0o077) == 0,
            lstat(file.path, &pathFacts) == 0, pathFacts.st_dev == facts.st_dev,
            pathFacts.st_ino == facts.st_ino
        else {
            throw ServiceFailure(
                code: "UPDATE_LOCK_INVALID", message: "Launch lock is not a private account-owned file")
        }
    }
    func updater(
        _ updater: SPUUpdater, shouldProceedWithUpdate item: SUAppcastItem,
        updateCheck: SPUUpdateCheck
    ) throws {
        guard owner.enabled, item.signingValidationStatus == .succeeded,
            item.propertiesDictionary["screenrecCatalogFormat"] as? String == catalogFormat
        else {
            throw ServiceFailure(
                code: "UPDATE_INCOMPATIBLE",
                message: "Candidate signature or catalog format is incompatible")
        }
    }
    func updater(_ updater: SPUUpdater, mayPerform updateCheck: SPUUpdateCheck) throws {
        guard owner.enabled else {
            throw ServiceFailure(code: "UPDATE_DISABLED", message: "Automatic updates are disabled")
        }
        owner.checking()
    }
    func updater(
        _ updater: SPUUpdater, didFinishUpdateCycleFor updateCheck: SPUUpdateCheck, error: Error?
    ) {
        downloadCancellation = nil
        let sdkError = error as NSError?
        // Sparkle completes a normal no-update check with an error sentinel.
        let noUpdate = sdkError?.domain == SUSparkleErrorDomain
            && sdkError?.code == Int(SUError.noUpdateError.rawValue)
        owner.cycleFinished(error: noUpdate ? nil : error)
    }
    func updaterWillRelaunchApplication(_ updater: SPUUpdater) {
        guard owner.mayTerminateForUpdate else {
            owner.ordinaryQuit()
            return
        }
        terminate()
    }
    func show(
        _ request: SPUUpdatePermissionRequest,
        reply: @escaping (SUUpdatePermissionResponse) -> Void
    ) {
        reply(SUUpdatePermissionResponse(automaticUpdateChecks: true, sendSystemProfile: false))
    }
    func showUserInitiatedUpdateCheck(cancellation: @escaping () -> Void) { owner.checking() }
    func showUpdateFound(
        with appcastItem: SUAppcastItem, state: SPUUserUpdateState,
        reply: @escaping (SPUUserUpdateChoice) -> Void
    ) {
        guard owner.enabled, !appcastItem.isInformationOnlyUpdate else {
            reply(.dismiss)
            return
        }
        owner.candidate(version: appcastItem.versionString)
        if state.stage == .installing {
            owner.ready(install: { reply(.install) }, cancel: { reply(.dismiss) })
        } else {
            reply(.install)
        }
    }
    func showUpdateReleaseNotes(with downloadData: SPUDownloadData) {}
    func showUpdateReleaseNotesFailedToDownloadWithError(_ error: Error) {}
    func showUpdateNotFoundWithError(_ error: Error, acknowledgement: @escaping () -> Void) {
        acknowledgement()
    }
    func showUpdaterError(_ error: Error, acknowledgement: @escaping () -> Void) {
        owner.fail(code: "UPDATE_FAILED", message: error.localizedDescription)
        acknowledgement()
    }
    func showDownloadInitiated(cancellation: @escaping () -> Void) {
        downloadCancellation = cancellation
    }
    func showDownloadDidReceiveExpectedContentLength(_ expectedContentLength: UInt64) {}
    func showDownloadDidReceiveData(ofLength length: UInt64) {}
    func showDownloadDidStartExtractingUpdate() { downloadCancellation = nil }
    func showExtractionReceivedProgress(_ progress: Double) {}
    func showReady(toInstallAndRelaunch reply: @escaping (SPUUserUpdateChoice) -> Void) {
        owner.ready(install: { reply(.install) }, cancel: { reply(.skip) })
    }
    func showInstallingUpdate(
        withApplicationTerminated terminated: Bool, retryTerminatingApplication: @escaping () -> Void
    ) {
        owner.installing(authorize: retryTerminatingApplication)
    }
    func showUpdateInstalledAndRelaunched(_ relaunched: Bool, acknowledgement: @escaping () -> Void) {
        acknowledgement()
    }
    func dismissUpdateInstallation() {}
}

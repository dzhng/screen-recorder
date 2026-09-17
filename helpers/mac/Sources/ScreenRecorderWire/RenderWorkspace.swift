import Foundation
import ScreenRecorderMedia

/// Only the service's inherited, exclusively locked staging descriptor is removable.
enum RenderWorkspace {
    static func clear(_ params: [String: Any]) throws {
        guard Set(params.keys) == ["expectedDirectory"] else {
            throw NativeFailure(
                "INVALID_REQUEST", "Render cleanup requires its directory identity.", retryable: false)
        }
        try InodeIdentity(params["expectedDirectory"]).check(3)
        try ManagedFiles.lockPrivateDirectory(3)
        try ManagedFiles.removeContents(3)
    }
}

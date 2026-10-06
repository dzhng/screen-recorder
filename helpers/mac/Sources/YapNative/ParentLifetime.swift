import Darwin
import Dispatch
import Foundation

/// This executable is only ever someone's media worker: a request carries expensive decode
/// and export work that must not outlive the process that asked for it. The runner writes one
/// request and closes stdin immediately, so EOF says nothing about whether that owner is still
/// there. The parent relationship does, and the kernel announces its end.
enum ParentLifetime {
    /// The owner disappeared before its work could be reported, so the work is abandoned
    /// rather than failed: a temporary condition whoever rebuilds the job can retry.
    private static let abandonedExitCode: Int32 = 75

    /// Ends this process when the parent that spawned it exits. The returned source must be
    /// held for as long as the worker runs.
    static func endWorkWhenParentExits(
        beforeAbandoning: @escaping @Sendable () -> Void = {}
    ) -> any DispatchSourceProcess {
        let parent = getppid()
        // An orphan has already been reparented to launchd, so no owner is left to announce
        // anything: this worker was abandoned before it could start watching.
        if parent <= 1 { abandonWork(parent: parent, beforeAbandoning: beforeAbandoning) }
        let monitor = DispatchSource.makeProcessSource(
            identifier: parent, eventMask: .exit,
            queue: DispatchQueue(label: "dev.yap.native.parent-exit"))
        // Its own queue, because the worker spends its life blocked in a stdin read or inside
        // a native operation and would never reach a handler scheduled behind that work.
        monitor.setEventHandler { abandonWork(parent: parent, beforeAbandoning: beforeAbandoning) }
        // resume() registers asynchronously. Check the relationship only after the kernel
        // watch is installed, so parent exit (including PID reuse) during setup cannot
        // leave us watching a different process while our actual owner is gone.
        monitor.setRegistrationHandler {
            if getppid() != parent { abandonWork(parent: parent, beforeAbandoning: beforeAbandoning) }
        }
        monitor.resume()
        return monitor
    }

    private static func abandonWork(
        parent: pid_t, beforeAbandoning: @Sendable () -> Void
    ) -> Never {
        beforeAbandoning()
        FileHandle.standardError.write(
            Data("yap-native: owning parent \(parent) exited; abandoning work\n".utf8))
        exit(abandonedExitCode)
    }
}

import Foundation

/// Owns the account-level consumer skill lifecycle. App updates and skill updates are separate.
/// Replacement is explicit when maintenance is enabled; the receipt records ownership for later removal.
@MainActor
final class SkillManager: SkillLifecycle {
    private let home: URL
    private let fileManager: FileManager

    init(home: String = NSHomeDirectory(), fileManager: FileManager = .default) {
        self.home = URL(fileURLWithPath: home, isDirectory: true)
        self.fileManager = fileManager
    }

    func setEnabled(_ enabled: Bool) {
        let path = home.path
        DispatchQueue.global(qos: .utility).async {
            let home = URL(fileURLWithPath: path, isDirectory: true)
            let fileManager = FileManager.default
            if enabled { Self.install(home: home, fileManager: fileManager) }
            else { Self.uninstall(home: home, fileManager: fileManager) }
        }
    }

    func perform(_ operation: String) {
        _ = handle(operation)
    }

    func handle(_ operation: String) -> Result<Data, ServiceFailure> {
        switch operation {
        case "skill.status":
            return .success(statusData())
        case "skill.install", "skill.update":
            setEnabled(true)
            return .success(statusData(state: "updating"))
        case "skill.uninstall":
            setEnabled(false)
            return .success(statusData(state: "updating"))
        default:
            return .failure(ServiceFailure(code: "UNKNOWN_OPERATION", message: "Unknown skill operation"))
        }
    }

    func reconcileIfEnabled(_ enabled: Bool) {
        guard enabled else { return }
        setEnabled(true)
    }

    private var receiptURL: URL { home.appendingPathComponent(".config/yap/skill-install.json") }
    private var receiptExists: Bool { fileManager.fileExists(atPath: receiptURL.path) }
    private var hasExistingInstallation: Bool {
        [".agents/skills/yap", ".codex/skills/yap", ".claude/skills/yap"]
            .map { home.appendingPathComponent($0).path }
            .contains { fileManager.fileExists(atPath: $0) }
    }

    private func statusData(state: String? = nil) -> Data {
        let value: [String: Any] = [
            "state": state ?? (receiptExists ? "installed" : (hasExistingInstallation ? "unmanaged" : "missing")),
            "managed": receiptExists,
            "paths": [".agents/skills/yap", ".codex/skills/yap", ".claude/skills/yap"],
        ]
        return (try? JSONSerialization.data(withJSONObject: value)) ?? Data("{}".utf8)
    }

    private nonisolated static func install(home: URL, fileManager: FileManager) {
        let stage = fileManager.temporaryDirectory.appendingPathComponent("yap-skill-\(UUID().uuidString)")
        let backup = stage.appendingPathComponent("backup", isDirectory: true)
        let destinations = [".agents/skills/yap", ".codex/skills/yap", ".claude/skills/yap"]
        defer { try? fileManager.removeItem(at: stage) }
        do {
            try fileManager.createDirectory(at: backup, withIntermediateDirectories: true)
            for relative in destinations {
                let source = home.appendingPathComponent(relative)
                guard fileManager.fileExists(atPath: source.path) else { continue }
                let saved = backup.appendingPathComponent(relative)
                try fileManager.createDirectory(at: saved.deletingLastPathComponent(), withIntermediateDirectories: true)
                try fileManager.copyItem(at: source, to: saved)
                try fileManager.removeItem(at: source)
            }
            let result = try run("/usr/bin/env", ["npx", "--yes", "skills@1.7.0", "add",
                "https://github.com/dzhng/yap/tree/main/skills/yap", "--all", "--global", "--yes"])
            guard result == 0 else {
                restore(backup: backup, home: home, fileManager: fileManager, destinations: destinations)
                return
            }
            let canonical = home.appendingPathComponent(".agents/skills/yap/SKILL.md")
            guard fileManager.fileExists(atPath: canonical.path) else {
                restore(backup: backup, home: home, fileManager: fileManager, destinations: destinations)
                return
            }
            try fileManager.createDirectory(at: home.appendingPathComponent(".config/yap"), withIntermediateDirectories: true)
            try Data("{\"managed\":true,\"source\":\"https://github.com/dzhng/yap/tree/main/skills/yap\"}\n".utf8)
                .write(to: home.appendingPathComponent(".config/yap/skill-install.json"), options: .atomic)
        } catch {
            restore(backup: backup, home: home, fileManager: fileManager, destinations: destinations)
        }
    }

    private nonisolated static func restore(backup: URL, home: URL, fileManager: FileManager, destinations: [String]) {
        for relative in destinations {
            let saved = backup.appendingPathComponent(relative)
            guard fileManager.fileExists(atPath: saved.path) else { continue }
            let destination = home.appendingPathComponent(relative)
            try? fileManager.createDirectory(at: destination.deletingLastPathComponent(), withIntermediateDirectories: true)
            try? fileManager.removeItem(at: destination)
            try? fileManager.copyItem(at: saved, to: destination)
        }
    }

    private nonisolated static func uninstall(home: URL, fileManager: FileManager) {
        let receipt = home.appendingPathComponent(".config/yap/skill-install.json")
        guard fileManager.fileExists(atPath: receipt.path),
              let data = try? Data(contentsOf: receipt),
              String(data: data, encoding: .utf8)?.contains("\"managed\":true") == true else { return }
        let canonical = home.appendingPathComponent(".agents/skills/yap")
        let codex = home.appendingPathComponent(".codex/skills/yap")
        for path in [canonical, codex] where fileManager.fileExists(atPath: path.path) {
            try? fileManager.removeItem(at: path)
        }
        try? fileManager.removeItem(at: receipt)
    }

    @discardableResult
    private nonisolated static func run(_ executable: String, _ arguments: [String]) throws -> Int32 {
        let process = Process(); process.executableURL = URL(fileURLWithPath: executable); process.arguments = arguments
        process.standardOutput = Pipe(); process.standardError = Pipe(); try process.run(); process.waitUntilExit(); return process.terminationStatus
    }
}

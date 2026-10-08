import Foundation

/// Owns the account-level consumer skill lifecycle. App updates and skill updates are separate.
/// A receipt is required before Yap will replace or remove an existing installation.
@MainActor
final class SkillManager: SkillLifecycle {
    private let home: URL
    private let fileManager: FileManager

    init(home: String = NSHomeDirectory(), fileManager: FileManager = .default) {
        self.home = URL(fileURLWithPath: home, isDirectory: true)
        self.fileManager = fileManager
    }

    func setEnabled(_ enabled: Bool) {
        if enabled && !receiptExists && hasExistingInstallation { return }
        let path = home.path
        DispatchQueue.global(qos: .utility).async {
            let home = URL(fileURLWithPath: path, isDirectory: true)
            let fileManager = FileManager.default
            if enabled { Self.install(home: home, fileManager: fileManager) }
            else { Self.uninstall(home: home, fileManager: fileManager) }
        }
    }

    func reconcileIfEnabled(_ enabled: Bool) {
        guard enabled, receiptExists || !hasExistingInstallation else { return }
        setEnabled(true)
    }

    private var receiptURL: URL { home.appendingPathComponent(".config/yap/skill-install.json") }
    private var receiptExists: Bool { fileManager.fileExists(atPath: receiptURL.path) }
    private var hasExistingInstallation: Bool {
        [".agents/skills/yap", ".codex/skills/yap", ".claude/skills/yap"]
            .map { home.appendingPathComponent($0).path }
            .contains { fileManager.fileExists(atPath: $0) }
    }

    private nonisolated static func install(home: URL, fileManager: FileManager) {
        let stage = fileManager.temporaryDirectory.appendingPathComponent("yap-skill-\(UUID().uuidString)")
        defer { try? fileManager.removeItem(at: stage) }
        do {
            try fileManager.createDirectory(at: stage, withIntermediateDirectories: true)
            let result = try run("/usr/bin/env", ["npx", "--yes", "skills@1.7.0", "add",
                "https://github.com/dzhng/yap/tree/main/skills/yap", "--skill", "yap",
                "--agent", "codex", "claude-code", "--global", "--yes"])
            guard result == 0 else { return }
            try fileManager.createDirectory(at: home.appendingPathComponent(".config/yap"), withIntermediateDirectories: true)
            try Data("{\"managed\":true,\"source\":\"https://github.com/dzhng/yap/tree/main/skills/yap\"}\n".utf8)
                .write(to: home.appendingPathComponent(".config/yap/skill-install.json"), options: .atomic)
        } catch { return }
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

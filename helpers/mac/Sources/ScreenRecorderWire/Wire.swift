import Foundation
import ScreenRecorderAudio
import ScreenRecorderCapture
import ScreenRecorderFrames
import ScreenRecorderMedia

public enum NativeWire {
    /// One registered operation. `unexpected` states what a failure this boundary does not
    /// recognise means for that operation; a `NativeFailure` carries its own code and retryability.
    private struct Operation: Sendable {
        let run: @Sendable ([String: Any]) async throws -> Any
        let unexpected: @Sendable (Error) -> NativeFailure
        var details: @Sendable () -> [String: Any] = { [:] }
    }

    private static let operations: [String: Operation] = {
        func media(_ run: @escaping @Sendable ([String: Any]) async throws -> Any) -> Operation {
            Operation(run: run, unexpected: { .decodeFailed($0.localizedDescription) })
        }
        func deletion(_ run: @escaping @Sendable ([String: Any]) throws -> Any) -> Operation {
            Operation(
                run: run,
                unexpected: { NativeFailure("DELETE_FAILED", $0.localizedDescription, retryable: true) })
        }
        var table: [String: Operation] = [
            "system.ping": Operation(
                run: { params in
                    guard params.isEmpty else {
                        throw NativeFailure("INVALID_REQUEST", "system.ping requires empty params.")
                    }
                    return ["platform": "macos"]
                }, unexpected: { NativeFailure("INVALID_REQUEST", $0.localizedDescription) }),
            "media.frame": media { try json(await FrameOperation.execute($0)) },
            "media.visualSamples": media { try json(await FrameOperation.visualSamples($0)) },
            "media.presentationEvidence": media {
                try json(await PresentationEvidenceOperation.execute($0))
            },
            "media.renderMovie": media { try json(await MovieOperation.execute($0)) },
            "media.audio": media { try json(await AudioOperation.execute($0)) },
            "media.recover": media { params in
                let request = try WireRequest.decode(RecoveryRequest.self, from: params)
                guard !request.directory.isEmpty else {
                    throw NativeFailure("INVALID_REQUEST", "media.recover requires a source directory.")
                }
                return try json(await MediaRecovery.inspect(directory: request.directory))
            },
            "media.sourceEvidence": Operation(
                run: { params in
                    let request = try WireRequest.decode(SourceEvidenceRequest.self, from: params)
                    try WireRequest.requireAbsolute(request.directory, request.output)
                    return try json(
                        SourceEvidenceExport.write(directory: request.directory, output: request.output))
                },
                unexpected: { _ in NativeFailure("EVIDENCE_FAILED", "Cannot export source evidence.") }),
            "storage.recordingDirectory": deletion { try ManagedFiles.recordingDirectory($0) },
            "storage.externalDirectory": deletion { try ManagedFiles.externalDirectory($0) },
            "storage.clearRenderWorkspace": deletion {
                try RenderWorkspace.clear($0)
                return ["removed": true]
            },
        ]
        for name in ["storage.removeRecordingDirectory", "storage.removeCacheFiles"] {
            table[name] = deletion {
                try ManagedFiles.execute(name, $0)
                return ["removed": true]
            }
        }
        for name in PublicationOperation.operations {
            table[name] = Operation(
                run: { try PublicationOperation.execute(name, $0) },
                unexpected: { NativeFailure("INVALID_STORAGE", $0.localizedDescription) })
        }
        for name in PackageWorkspace.operations {
            table[name] = Operation(
                run: { try PackageWorkspace.execute(name, $0) },
                unexpected: { NativeFailure("INVALID_STORAGE", $0.localizedDescription) })
        }
        for name in ArchiveOperation.operations {
            table[name] = Operation(
                run: { try ArchiveOperation.execute(name, $0) },
                unexpected: { NativeFailure("INVALID_PACKAGE", $0.localizedDescription) },
                details: { ["peakResidentBytes": ArchiveOperation.peakResidentBytes()] })
        }
        return table
    }()

    public static func respond(to line: String) async -> Data {
        let request = (try? JSONSerialization.jsonObject(with: Data(line.utf8))) as? [String: Any]
        let id = request?["id"] as? String
        let response: [String: Any]
        if let request, let id, !id.isEmpty,
            Set(request.keys) == ["id", "operation", "params"],
            let name = request["operation"] as? String, !name.isEmpty,
            let params = request["params"] as? [String: Any]
        {
            if let operation = operations[name] {
                do {
                    response = ["id": id, "ok": true, "data": try await operation.run(params)]
                } catch {
                    // Capture failures are the capture session's own records; the worker reports
                    // them as final because nothing about retrying changes a journal's contents.
                    let failure =
                        error as? NativeFailure
                        ?? (error as? CaptureFailure).map { NativeFailure($0.code, $0.message) }
                        ?? operation.unexpected(error)
                    response = failed(id: id, failure, details: operation.details())
                }
            } else {
                response = failed(
                    id: id, NativeFailure("UNKNOWN_OPERATION", "Unknown native operation: \(name)"))
            }
        } else {
            response = failed(
                id: id, NativeFailure("INVALID_REQUEST", "Expected id, operation, and object params."))
        }
        // Every response is composed only of JSON primitives.
        return try! JSONSerialization.data(withJSONObject: response, options: [.sortedKeys])
    }

    private static func failed(id: String?, _ failure: NativeFailure, details: [String: Any] = [:])
        -> [String: Any]
    {
        [
            "id": id as Any? ?? NSNull(), "ok": false,
            "error": [
                "code": failure.code, "message": failure.message, "retryable": failure.retryable,
                "details": details,
            ],
        ]
    }

    private static func json(_ value: some Encodable) throws -> Any {
        try JSONSerialization.jsonObject(with: JSONEncoder().encode(value))
    }

    private struct RecoveryRequest: Codable {
        let directory: String
    }

    private struct SourceEvidenceRequest: Codable {
        let directory: String
        let output: String
    }
}

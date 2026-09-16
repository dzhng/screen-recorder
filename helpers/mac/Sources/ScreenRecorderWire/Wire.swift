import Foundation
import ScreenRecorderAudio
import ScreenRecorderCapture
import ScreenRecorderFrames

public enum NativeWire {
    public static func respond(to line: String) async -> Data {
        let object = try? JSONSerialization.jsonObject(with: Data(line.utf8))
        let request = object as? [String: Any]
        let id = request?["id"] as? String
        let response: [String: Any]
        if let request, let id, !id.isEmpty,
            Set(request.keys) == ["id", "operation", "params"],
            let operation = request["operation"] as? String, !operation.isEmpty,
            let params = request["params"] as? [String: Any]
        {
            if operation.hasPrefix("archive.") {
                do {
                    let data = try ArchiveOperation.execute(operation, params)
                    response = ["id": id, "ok": true, "data": data]
                } catch let error as StorageFailure {
                    response = failure(id: id, code: error.code, message: error.message,
                        details: ["peakResidentBytes": ArchiveOperation.peakResidentBytes()])
                } catch {
                    response = failure(id: id, code: "INVALID_PACKAGE", message: error.localizedDescription)
                }
            } else if operation == "media.frame" || operation == "media.visualSamples" {
                do {
                    let encoded: Data
                    if operation == "media.frame" {
                        encoded = try JSONEncoder().encode(await FrameOperation.execute(params))
                    } else {
                        encoded = try JSONEncoder().encode(
                            await FrameOperation.visualSamples(params))
                    }
                    let data = try JSONSerialization.jsonObject(with: encoded)
                    response = ["id": id, "ok": true, "data": data]
                } catch let error as FrameFailure {
                    response = failure(id: id, code: error.code, message: error.message)
                } catch {
                    response = failure(
                        id: id, code: "NATIVE_DECODE_FAILED", message: error.localizedDescription)
                }
            } else if operation == "storage.removeRecordingDirectory"
                || operation == "storage.removeCacheFiles"
            {
                do {
                    try ManagedFiles.execute(operation, params)
                    response = ["id": id, "ok": true, "data": ["removed": true]]
                } catch let error as StorageFailure {
                    response = [
                        "id": id, "ok": false,
                        "error": [
                            "code": error.code, "message": error.message,
                            "retryable": error.retryable, "details": [:],
                        ],
                    ]
                } catch {
                    response = failure(
                        id: id, code: "DELETE_FAILED", message: error.localizedDescription)
                }
            } else if operation == "media.renderVideo" || operation == "media.presentationEvidence" {
                do {
                    let encoded: Data
                    if operation == "media.renderVideo" {
                        encoded = try JSONEncoder().encode(await VideoOperation.execute(params))
                    } else {
                        encoded = try JSONEncoder().encode(await VideoOperation.presentationEvidence(params))
                    }
                    let data = try JSONSerialization.jsonObject(with: encoded)
                    response = ["id": id, "ok": true, "data": data]
                } catch let error as FrameFailure {
                    response = failure(id: id, code: error.code, message: error.message)
                } catch {
                    response = failure(id: id, code: "NATIVE_DECODE_FAILED", message: error.localizedDescription)
                }
            } else if operation == "media.renderMovie" {
                do {
                    let result = try await MovieOperation.execute(params)
                    let data = try JSONSerialization.jsonObject(with: JSONEncoder().encode(result))
                    response = ["id": id, "ok": true, "data": data]
                } catch let error as FrameFailure {
                    response = failure(id: id, code: error.code, message: error.message)
                } catch let error as AudioFailure {
                    response = failure(id: id, code: error.code, message: error.message)
                } catch {
                    response = failure(id: id, code: "NATIVE_DECODE_FAILED", message: error.localizedDescription)
                }
            } else if operation == "media.audio" {
                do {
                    let result = try await AudioOperation.execute(params)
                    let data = try JSONSerialization.jsonObject(with: JSONEncoder().encode(result))
                    response = ["id": id, "ok": true, "data": data]
                } catch let error as AudioFailure {
                    response = failure(id: id, code: error.code, message: error.message)
                } catch {
                    response = failure(
                        id: id, code: "NATIVE_DECODE_FAILED", message: error.localizedDescription)
                }
            } else if operation == "media.sourceEvidence" {
                do {
                    guard Set(params.keys) == ["directory", "output"],
                        let directory = params["directory"] as? String,
                        let output = params["output"] as? String,
                        directory.hasPrefix("/"), output.hasPrefix("/"),
                        !directory.contains("\0"), !output.contains("\0")
                    else {
                        throw CaptureFailure(
                            "INVALID_REQUEST",
                            "Evidence requires absolute directory and output paths.")
                    }
                    let result = try SourceEvidenceExport.write(
                        directory: directory, output: output)
                    let data = try JSONSerialization.jsonObject(with: JSONEncoder().encode(result))
                    response = ["id": id, "ok": true, "data": data]
                } catch let error as CaptureFailure {
                    response = failure(id: id, code: error.code, message: error.message)
                } catch {
                    response = failure(
                        id: id, code: "EVIDENCE_FAILED", message: "Cannot export source evidence.")
                }
            } else if operation == "media.recover" {
                if Set(params.keys) == ["directory"],
                    let directory = params["directory"] as? String, !directory.isEmpty
                {
                    let result = await MediaRecovery.inspect(directory: directory)
                    let data = try! JSONSerialization.jsonObject(with: JSONEncoder().encode(result))
                    response = ["id": id, "ok": true, "data": data]
                } else {
                    response = failure(
                        id: id, code: "INVALID_REQUEST",
                        message: "media.recover requires a source directory.")
                }
            } else if operation != "system.ping" {
                response = failure(
                    id: id, code: "UNKNOWN_OPERATION",
                    message: "Unknown native operation: \(operation)")
            } else if !params.isEmpty {
                response = failure(
                    id: id, code: "INVALID_REQUEST", message: "system.ping requires empty params.")
            } else {
                response = ["id": id, "ok": true, "data": ["platform": "macos"]]
            }
        } else {
            response = failure(
                id: id, code: "INVALID_REQUEST",
                message: "Expected id, operation, and object params.")
        }
        // Every response is composed only of JSON primitives.
        return try! JSONSerialization.data(withJSONObject: response, options: [.sortedKeys])
    }

    private static func failure(id: String?, code: String, message: String, details: [String: Any] = [:]) -> [String: Any] {
        [
            "id": id as Any? ?? NSNull(), "ok": false,
            "error": [
                "code": code, "message": message,
                "retryable": code == "NATIVE_DECODE_FAILED" || code == "DELETE_FAILED",
                "details": details,
            ],
        ]
    }
}

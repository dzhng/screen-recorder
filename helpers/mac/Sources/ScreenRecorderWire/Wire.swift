import Foundation
import ScreenRecorderCapture

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
            if operation == "media.recover" {
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

    private static func failure(id: String?, code: String, message: String) -> [String: Any] {
        [
            "id": id as Any? ?? NSNull(), "ok": false,
            "error": ["code": code, "message": message, "retryable": false, "details": [:]],
        ]
    }
}

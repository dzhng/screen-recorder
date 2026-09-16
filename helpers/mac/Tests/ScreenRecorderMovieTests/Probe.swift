import Foundation
import ScreenRecorderAudio
import ScreenRecorderFrames
import ScreenRecorderWire

/// Optional generated-media feasibility executable; the production worker has no movie operation.
@main struct MovieProbe {
    static func main() async throws {
        guard let line = readLine(),
            let object = try JSONSerialization.jsonObject(with: Data(line.utf8)) as? [String: Any],
            let operation = object["operation"] as? String,
            let parameters = object["params"] as? [String: Any]
        else { fatalError("Expected one probe request") }
        if operation != "media.renderMovie" {
            let response = await NativeWire.respond(to: line)
            print(String(data: response, encoding: .utf8)!)
            return
        }
        let response: [String: Any]
        do {
            let result = try await MovieOperation.execute(parameters)
            response = [
                "ok": true,
                "data": try JSONSerialization.jsonObject(with: JSONEncoder().encode(result)),
            ]
        } catch {
            response = ["ok": false, "error": String(describing: error)]
        }
        print(
            String(
                data: try JSONSerialization.data(withJSONObject: response, options: [.sortedKeys]),
                encoding: .utf8)!)
    }
}

import Foundation
import YapMedia

enum CorrespondenceOperation {
    private struct Request: Codable { let supplied: [String]; let observed: [String] }
    static func execute(_ params: [String: Any]) throws -> OrderedCorrespondence.Result {
        let input = try WireRequest.decode(Request.self, from: params)
        guard input.supplied.count <= 512 && input.observed.count <= 512,
            (input.supplied + input.observed).allSatisfy({ $0.utf8.count <= 1024 }) else {
            throw NativeFailure("LIMIT_EXCEEDED", "Word correspondence exceeds its bounded operands.")
        }
        // Core foldWord owns normalization; native arithmetic receives those exact operands.
        return OrderedCorrespondence.resolve(leftCount: input.supplied.count, rightCount: input.observed.count) {
            !input.supplied[$0].isEmpty && input.supplied[$0] == input.observed[$1]
        }
    }
}

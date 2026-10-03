import Foundation
@main enum CancellationProbe {
 static func main() async throws { try await observeCameraReaderCancellation(output: URL(fileURLWithPath: CommandLine.arguments[1])) }
}

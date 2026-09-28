import Foundation
import ScreenRecorderMedia

struct Vector: Decodable {
    let program: ScalarSampleProgram
    let frames: [Int64]
}

@main
struct ScalarTests {
    static func main() {
        do {
            let data = try Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1]))
            let vectors = try JSONDecoder().decode([Vector].self, from: data)
            let values = try vectors.map { vector in
                try vector.program.validate()
                return vector.frames.map { frame in vector.program.sample(frame) }
            }
            FileHandle.standardOutput.write(try JSONEncoder().encode(values))
        } catch {
            FileHandle.standardError.write(Data("\(error)\n".utf8))
            exit(1)
        }
    }
}

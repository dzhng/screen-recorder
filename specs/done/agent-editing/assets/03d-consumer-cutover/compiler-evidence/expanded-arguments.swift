import Foundation
struct Exact {
    let numerator: Int128
    let denominator: Int128
}
struct Range { let start: Exact; let end: Exact }
func inspect(path: String, id: String?, offset: Exact, available: [Range], strict: Bool = false) async {
    print("before", path, offset, available.count)
    await Task.yield()
    print("after", path, offset, available.count)
    for span in available { print(span) }
}
@main struct Main {
    static func main() async {
        let range = Range(start: Exact(numerator: 0, denominator: 1), end: Exact(numerator: 10, denominator: 1))
        await inspect(path: "/fixture", id: "audio", offset: Exact(numerator: -100, denominator: 1), available: [range])
    }
}

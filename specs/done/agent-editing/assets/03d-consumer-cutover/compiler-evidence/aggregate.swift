import Foundation
struct Exact {
    let numerator: Int128
    let denominator: Int128
}
struct Range { let start: Exact; let end: Exact }
struct Selection { let path: String; let id: String?; let offset: Exact; let available: [Range] }
@inline(never) func inspect(selection: Selection, strict: Bool = false) async {
    let path = selection.path, offset = selection.offset, available = selection.available
    print("before", path, offset, available.count)
    await Task.yield()
    print("after", path, offset, available.count)
    for span in available { print(span) }
}
@main struct Main {
    static func main() async {
        let range = Range(start: Exact(numerator: 0, denominator: 1), end: Exact(numerator: 10, denominator: 1))
        await inspect(selection: Selection(path: "/fixture", id: "audio", offset: Exact(numerator: -100, denominator: 1), available: [range]))
    }
}

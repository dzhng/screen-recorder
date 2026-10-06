/// Possible pairs and omissions across every longest ordered matching sequence.
/// Equality and interpretation belong to the caller; this arithmetic chooses no tie.
public enum OrderedCorrespondence {
    public struct Row: Codable, Equatable, Sendable {
        public let indices: [Int]
        public let omissionPossible: Bool
    }
    public struct Result: Codable, Equatable, Sendable {
        public let optimum: Int
        public let left: [Row]
        public let right: [Row]
    }
    public static func resolve(leftCount: Int, rightCount: Int,
        equal: (Int, Int) -> Bool) -> Result {
        precondition(leftCount >= 0 && rightCount >= 0)
        var prefix = Array(repeating: Array(repeating: 0, count: rightCount + 1), count: leftCount + 1)
        var suffix = prefix
        for i in 0..<leftCount {
            for j in 0..<rightCount {
                prefix[i + 1][j + 1] = max(prefix[i][j + 1], prefix[i + 1][j],
                    equal(i, j) ? prefix[i][j] + 1 : 0)
            }
        }
        for i in (0..<leftCount).reversed() {
            for j in (0..<rightCount).reversed() {
                suffix[i][j] = max(suffix[i + 1][j], suffix[i][j + 1],
                    equal(i, j) ? suffix[i + 1][j + 1] + 1 : 0)
            }
        }
        let optimum = suffix[0][0]
        let left = (0..<leftCount).map { i in
            Row(indices: (0..<rightCount).filter { j in
                equal(i, j) && prefix[i][j] + 1 + suffix[i + 1][j + 1] == optimum
            }, omissionPossible: (0...rightCount).contains { j in
                prefix[i][j] + suffix[i + 1][j] == optimum
            })
        }
        let right = (0..<rightCount).map { j in
            Row(indices: (0..<leftCount).filter { i in
                equal(i, j) && prefix[i][j] + 1 + suffix[i + 1][j + 1] == optimum
            }, omissionPossible: (0...leftCount).contains { i in
                prefix[i][j] + suffix[i][j + 1] == optimum
            })
        }
        return Result(optimum: optimum, left: left, right: right)
    }
}

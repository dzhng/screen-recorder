import Foundation
import YapMedia

func correspondence(_ left: [String], _ right: [String]) -> OrderedCorrespondence.Result {
    OrderedCorrespondence.resolve(leftCount: left.count, rightCount: right.count) {
        !left[$0].isEmpty && left[$0] == right[$1]
    }
}
let missing = correspondence(["blue", "seven", "blue"], ["blue", "blue"])
precondition(missing.optimum == 2)
precondition(missing.left[0].indices == [0] && !missing.left[0].omissionPossible)
precondition(missing.left[1].indices.isEmpty && missing.left[1].omissionPossible)
precondition(missing.left[2].indices == [1] && !missing.left[2].omissionPossible)
let repeated = correspondence(["blue", "seven", "blue", "blue"], ["blue", "seven", "blue"])
precondition(repeated.left[2].indices == [2] && repeated.left[2].omissionPossible)
precondition(repeated.left[3].indices == [2] && repeated.left[3].omissionPossible)
precondition(repeated.right[2].indices == [2, 3] && !repeated.right[2].omissionPossible)
let empty = correspondence([""], [])
precondition(empty.optimum == 0 && empty.left[0].indices.isEmpty && empty.left[0].omissionPossible)
print("PASS ordered correspondence: required occurrences, missing words and repeated ties remain distinct")

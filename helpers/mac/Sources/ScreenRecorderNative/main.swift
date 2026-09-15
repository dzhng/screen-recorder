import Foundation
import ScreenRecorderWire

// Held for this worker's whole life: every request it serves belongs to the process that
// spawned it, and none of that work outlives its owner.
let parentExit = ParentLifetime.endWorkWhenParentExits()

while let line = readLine() {
    FileHandle.standardOutput.write(await NativeWire.respond(to: line))
    FileHandle.standardOutput.write(Data([0x0a]))
}

import Foundation
import ScreenRecorderWire

while let line = readLine() {
    FileHandle.standardOutput.write(NativeWire.respond(to: line))
    FileHandle.standardOutput.write(Data([0x0a]))
}

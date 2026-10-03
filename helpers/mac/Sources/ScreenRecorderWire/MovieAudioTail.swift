import Darwin
import Foundation
import ScreenRecorderMedia

/// Declares only the unrepresented fractional PCM tail, without altering encoded media.
enum MovieAudioTail {
    private static let maximumHeaderBytes = 64 * 1024 * 1024
    private struct Atom {
        let type: String
        let range: Range<Int>
        let header: Int
    }

    static func extend(_ file: FileHandle, at url: URL, durationUs: Int64, pcmFrames: Int64, rate: Int) throws {
        try Task.checkCancellation()
        let descriptor = file.fileDescriptor
        var info = stat()
        guard fstat(descriptor, &info) == 0, info.st_mode & S_IFMT == S_IFREG, info.st_size > 0
        else { throw invalid("Staged movie must be a regular file.") }
        try checkLocator(url, matches: info)
        let length = UInt64(info.st_size)
        var position: UInt64 = 0
        var movie: (offset: UInt64, body: Data)?
        while position < length {
            try Task.checkCancellation()
            try file.seek(toOffset: position)
            let head = try read(file, count: 8)
            var size = try integer(head, at: 0, width: 4)
            var header = 8
            if size == 1 {
                size = try integer(read(file, count: 8), at: 0, width: 8)
                header = 16
            }
            let type = String(decoding: head[4..<8], as: UTF8.self)
            guard size != 0 else { throw invalid("EOF-sized movie atoms are unsupported.") }
            guard size >= UInt64(header), size <= length - position else {
                throw invalid("Movie atom exceeds its staged file.")
            }
            if type == "moov" {
                guard movie == nil else { throw invalid("Movie has duplicate headers.") }
                guard size <= maximumHeaderBytes else {
                    throw NativeFailure("LIMIT_EXCEEDED",
                        "MovieAudioTail header exceeds its 64 MiB finalization bound.")
                }
                movie = (position, try read(file, count: Int(size) - header))
            }
            position += size
        }
        guard let movie else { throw invalid("Movie header is missing.") }
        let children = try atoms(movie.body)
        let header = try unique("mvhd", in: children)
        let mvhd = body(header, in: movie.body)
        let width = try versionWidth(mvhd)
        let clockOffset = width == 8 ? 20 : 12
        let scale = try integer(mvhd, at: clockOffset, width: 4)
        let duration = try integer(mvhd, at: clockOffset + 4, width: width)
        guard rate > 0, pcmFrames > 0, durationUs > 0, scale > 0,
            Int128(duration) * 1_000_000 == Int128(durationUs) * Int128(scale),
            Int128(pcmFrames) * Int128(scale) % Int128(rate) == 0
        else { throw invalid("Movie clock cannot represent the compiled audio tail.") }
        let pcmClock = Int128(pcmFrames) * Int128(scale) / Int128(rate)
        guard pcmClock <= Int128(UInt64.max) else { throw invalid("PCM clock overflows movie time.") }
        let pcmTicks = UInt64(pcmClock)
        guard pcmTicks < duration,
            Int128(duration - pcmTicks) * Int128(rate) < Int128(scale)
        else { throw invalid("Missing audio is not a fractional PCM tail.") }
        var result = Data()
        var soundTracks = 0
        for child in children {
            try Task.checkCancellation()
            if child.type != "trak" { result.append(movie.body.subdata(in: child.range)); continue }
            let track = body(child, in: movie.body)
            let fields = try atoms(track)
            let media = body(try unique("mdia", in: fields), in: track)
            let handler = body(try unique("hdlr", in: atoms(media)), in: media)
            guard handler.count >= 12 else { throw invalid("Movie track handler is truncated.") }
            if String(decoding: handler[8..<12], as: UTF8.self) != "soun" {
                result.append(movie.body.subdata(in: child.range)); continue
            }
            soundTracks += 1
            let trackHeader = try unique("tkhd", in: fields)
            let edits = try unique("edts", in: fields)
            let editBody = body(edits, in: track)
            let editFields = try atoms(editBody)
            let list = try unique("elst", in: editFields)
            var entries = body(list, in: editBody)
            let entryWidth = try versionWidth(entries)
            let stride = entryWidth * 2 + 4
            guard entries.count == 8 + stride,
                try integer(entries, at: 4, width: 4) == 1,
                try integer(entries, at: 8, width: entryWidth) == pcmTicks,
                try integer(entries, at: 8 + entryWidth, width: entryWidth) < (UInt64(1) << (entryWidth * 8 - 1)),
                try integer(entries, at: 8 + entryWidth * 2, width: 4) == 0x0001_0000
            else { throw invalid("Audio edit does not match the complete PCM quota.") }
            try put(2, into: &entries, at: 4, width: 4)
            entries.append(try encoded(duration - pcmTicks, width: entryWidth))
            entries.append(Data(repeating: 0xff, count: entryWidth))
            entries.append(Data([0, 1, 0, 0]))
            var tkhd = body(trackHeader, in: track)
            let trackWidth = try versionWidth(tkhd)
            let trackOffset = trackWidth == 8 ? 28 : 20
            guard try integer(tkhd, at: trackOffset, width: trackWidth) == pcmTicks
            else { throw invalid("Audio track header differs from its edit duration.") }
            try put(duration, into: &tkhd, at: trackOffset, width: trackWidth)
            var newEdits = Data()
            for field in editFields {
                newEdits.append(field.type == "elst" ? try boxed("elst", entries)
                    : editBody.subdata(in: field.range))
            }
            var newTrack = Data()
            for field in fields {
                newTrack.append(field.type == "tkhd" ? try boxed("tkhd", tkhd)
                    : field.type == "edts" ? try boxed("edts", newEdits)
                    : track.subdata(in: field.range))
            }
            result.append(try boxed("trak", newTrack))
        }
        guard soundTracks == 1 else { throw invalid("Movie must have one unambiguous audio track.") }
        let replacement = try boxed("moov", result)
        guard replacement.count <= maximumHeaderBytes else {
            throw NativeFailure("LIMIT_EXCEEDED",
                "MovieAudioTail replacement header exceeds its 64 MiB finalization bound.")
        }
        guard UInt64(replacement.count) <= UInt64(Int64.max) - length,
            fstat(descriptor, &info) == 0, UInt64(info.st_size) == length
        else { throw invalid("Movie header or staged size changed during finalization.") }
        try checkLocator(url, matches: info)
        // Appending preserves every absolute media offset. The previous header becomes free space.
        try Task.checkCancellation()
        try file.seek(toOffset: length)
        try file.write(contentsOf: replacement)
        try Task.checkCancellation()
        try file.seek(toOffset: movie.offset + 4)
        try file.write(contentsOf: Data("free".utf8))
        try Task.checkCancellation()
        try checkLocator(url, matches: info)
    }

    private static func atoms(_ data: Data) throws -> [Atom] {
        var result: [Atom] = [], at = 0
        while at < data.count {
            try Task.checkCancellation()
            var size = try integer(data, at: at, width: 4), header = 8
            let type = try integer(data, at: at + 4, width: 4)
            if size == 1 { size = try integer(data, at: at + 8, width: 8); header = 16 }
            if size == 0 { size = UInt64(data.count - at) }
            guard size >= UInt64(header), size <= UInt64(data.count - at)
            else { throw invalid("Movie header atom is out of bounds.") }
            let name = String(decoding: try encoded(type, width: 4), as: UTF8.self)
            result.append(Atom(type: name, range: at..<at + Int(size), header: header))
            at += Int(size)
        }
        return result
    }
    private static func unique(_ type: String, in atoms: [Atom]) throws -> Atom {
        let matches = atoms.filter { $0.type == type }
        guard matches.count == 1 else { throw invalid("Movie has missing or duplicate \(type).") }
        return matches[0]
    }
    private static func body(_ atom: Atom, in data: Data) -> Data {
        data.subdata(in: atom.range.lowerBound + atom.header..<atom.range.upperBound)
    }
    private static func versionWidth(_ data: Data) throws -> Int {
        guard let version = data.first, version <= 1 else { throw invalid("Unsupported movie clock version.") }
        return version == 1 ? 8 : 4
    }
    private static func integer(_ data: Data, at: Int, width: Int) throws -> UInt64 {
        guard at >= 0, at <= data.count, width <= data.count - at else {
            throw invalid("Movie clock field is truncated.")
        }
        return data[at..<at + width].reduce(UInt64(0)) { $0 << 8 | UInt64($1) }
    }
    private static func encoded(_ value: UInt64, width: Int) throws -> Data {
        guard width == 8 || value <= UInt64(UInt32.max) else { throw invalid("Movie clock overflows its field.") }
        return Data((0..<width).reversed().map { UInt8(truncatingIfNeeded: value >> ($0 * 8)) })
    }
    private static func put(_ value: UInt64, into data: inout Data, at: Int, width: Int) throws {
        _ = try integer(data, at: at, width: width)
        data.replaceSubrange(at..<at + width, with: try encoded(value, width: width))
    }
    private static func boxed(_ type: String, _ body: Data) throws -> Data {
        try encoded(UInt64(body.count) + 8, width: 4) + Data(type.utf8) + body
    }
    private static func read(_ file: FileHandle, count: Int) throws -> Data {
        let data = try file.read(upToCount: count) ?? Data()
        guard data.count == count else { throw invalid("Staged movie header ended early.") }
        return data
    }
    private static func checkLocator(_ url: URL, matches expected: stat) throws {
        var current = stat()
        guard lstat(url.path, &current) == 0,
            current.st_dev == expected.st_dev, current.st_ino == expected.st_ino
        else { throw NativeFailure("INVALID_OUTPUT", "Movie staging locator changed before finalization.") }
    }
    private static func invalid(_ message: String) -> NativeFailure {
        NativeFailure("INVALID_RESPONSE", message)
    }
}

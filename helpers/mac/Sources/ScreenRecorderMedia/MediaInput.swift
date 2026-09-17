@preconcurrency import AVFoundation
import Darwin
import Foundation
import UniformTypeIdentifiers

/// An inherited handle is a private media address, not a filesystem path to resolve.
/// Its duplicate outlives the caller's handle; normal paths keep the native URL behavior.
public final class MediaInput: @unchecked Sendable {
    public let asset: AVURLAsset
    public let url: URL
    private let loader: DescriptorLoader?

    public init(url: URL) throws {
        let descriptor = try MediaDescriptor(url: url, writable: false)
        self.url = descriptor?.url ?? url.resolvingSymlinksInPath().standardizedFileURL
        if let descriptor {
            let loader = try DescriptorLoader(descriptor)
            self.loader = loader
            asset = AVURLAsset(
                url: URL(
                    string: "screenrec-media://\(UUID().uuidString)/source.\(loader.extensionName)")!,
                options: [AVURLAssetPreferPreciseDurationAndTimingKey: true])
            asset.resourceLoader.setDelegate(loader, queue: loader.queue)
        } else {
            loader = nil
            asset = AVURLAsset(
                url: url, options: [AVURLAssetPreferPreciseDurationAndTimingKey: true])
        }
    }

    public var failure: NativeFailure? { loader?.currentFailure() }

    public func cancel() {
        asset.cancelLoading()
        loader?.stop()
    }
    deinit { loader?.stop() }
}

/// Owns only a duplicate, never the caller's descriptor or a pathname publication.
public final class MediaDescriptor: @unchecked Sendable {
    public let descriptor: Int32
    public var url: URL { URL(fileURLWithPath: "/dev/fd/\(descriptor)") }
    public var size: Int64 {
        get throws {
            var info = stat()
            guard fstat(descriptor, &info) == 0 else {
                throw NativeFailure.decodeFailed("Cannot stat media handle.")
            }
            return info.st_size
        }
    }

    public init?(url: URL, writable: Bool) throws {
        let path = url.path
        guard path.hasPrefix("/dev/fd/") else { return nil }
        let number = String(path.dropFirst(8))
        guard let original = Int32(number), original >= 0, String(original) == number else {
            throw NativeFailure.decodeFailed("Invalid inherited media handle.")
        }
        let flags = fcntl(original, F_GETFL)
        var info = stat()
        guard flags >= 0, fstat(original, &info) == 0, info.st_mode & S_IFMT == S_IFREG,
            writable ? flags & O_ACCMODE != O_RDONLY : flags & O_ACCMODE != O_WRONLY
        else { throw NativeFailure.decodeFailed("Media handle must be a regular file with the required access.") }
        let owned = fcntl(original, F_DUPFD_CLOEXEC, 0)
        guard owned >= 0 else { throw NativeFailure.decodeFailed("Cannot retain inherited media handle.") }
        descriptor = owned
    }
    deinit { close(descriptor) }

    public static func sameFile(_ source: URL, _ output: URL) -> Bool {
        var left = stat()
        var right = stat()
        return stat(source.path, &left) == 0 && stat(output.path, &right) == 0
            && left.st_dev == right.st_dev && left.st_ino == right.st_ino
    }

    public func write(_ data: Data) throws {
        try data.withUnsafeBytes { bytes in
            var offset = 0
            while offset < bytes.count {
                try Task.checkCancellation()
                let count = pwrite(
                    descriptor, bytes.baseAddress!.advanced(by: offset), bytes.count - offset,
                    off_t(offset))
                if count < 0 && errno == EINTR { continue }
                guard count > 0 else { throw NativeFailure.decodeFailed("Cannot write inherited media output.") }
                offset += count
            }
        }
        guard ftruncate(descriptor, off_t(data.count)) == 0, fsync(descriptor) == 0 else {
            throw NativeFailure.decodeFailed("Cannot finish inherited media output.")
        }
    }
}

private final class DescriptorLoader: NSObject, AVAssetResourceLoaderDelegate, @unchecked Sendable {
    let queue = DispatchQueue(label: "screenrec.media-descriptor")
    let extensionName: String
    private let contentType: String
    private let descriptor: MediaDescriptor
    private let length: Int64
    private var pending: [ObjectIdentifier: AVAssetResourceLoadingRequest] = [:]
    private var delivered = 0
    private var stopped = false
    private var failure: NativeFailure?
    // These bound bytes handed to AVFoundation, whose internal caching is opaque.
    // They apply to bounded inspection calls, not a whole-movie streaming contract.
    private let maximumBytes = 64 * 1024 * 1024
    private let maximumRequests = 8
    private let chunkBytes = 64 * 1024

    init(_ descriptor: MediaDescriptor) throws {
        self.descriptor = descriptor
        length = try descriptor.size
        var prefix = [UInt8](repeating: 0, count: 12)
        let count = pread(descriptor.descriptor, &prefix, prefix.count, 0)
        guard count == prefix.count else {
            throw NativeFailure.decodeFailed("Media handle has no readable container header.")
        }
        if prefix.prefix(4).elementsEqual("RIFF".utf8)
            && prefix.suffix(4).elementsEqual("WAVE".utf8)
        {
            extensionName = "wav"
            contentType = UTType.wav.identifier
        } else if prefix.prefix(4).elementsEqual("caff".utf8) {
            guard let type = UTType(filenameExtension: "caf") else {
                throw NativeFailure.decodeFailed("CAF media type is unavailable.")
            }
            extensionName = "caf"
            contentType = type.identifier
        } else {
            extensionName = "mov"
            contentType = UTType.quickTimeMovie.identifier
        }
    }

    func resourceLoader(
        _ resourceLoader: AVAssetResourceLoader,
        shouldWaitForLoadingOfRequestedResource request: AVAssetResourceLoadingRequest
    ) -> Bool {
        if stopped {
            request.finishLoading(with: NativeFailure.decodeFailed("Media input was closed."))
            return true
        }
        if let info = request.contentInformationRequest {
            info.contentType = contentType
            info.contentLength = length
            info.isByteRangeAccessSupported = true
        }
        guard request.dataRequest != nil else {
            request.finishLoading()
            return true
        }
        guard pending.count < maximumRequests else {
            let error = NativeFailure("LIMIT_EXCEEDED", "Media input exceeds its concurrent request budget.")
            if failure == nil { failure = error }
            request.finishLoading(with: error)
            return true
        }
        let key = ObjectIdentifier(request)
        pending[key] = request
        queue.async { [weak self] in self?.pump(key) }
        return true
    }

    func resourceLoader(
        _ resourceLoader: AVAssetResourceLoader,
        didCancel request: AVAssetResourceLoadingRequest
    ) {
        pending.removeValue(forKey: ObjectIdentifier(request))
    }

    func currentFailure() -> NativeFailure? { queue.sync { failure } }

    func stop() {
        queue.async { [self] in
            stopped = true
            let requests = Array(pending.values)
            pending.removeAll()
            for request in requests where !request.isCancelled {
                request.finishLoading(with: NativeFailure.decodeFailed("Media input was canceled."))
            }
        }
    }

    private func pump(_ key: ObjectIdentifier) {
        guard let request = pending[key] else { return }
        guard !request.isCancelled, !request.isFinished else {
            pending.removeValue(forKey: key)
            return
        }
        do {
            guard let data = request.dataRequest else {
                throw NativeFailure.decodeFailed("Missing media data request.")
            }
            let (requestedEnd, overflow) = data.requestedOffset.addingReportingOverflow(
                Int64(data.requestedLength))
            let end = data.requestsAllDataToEndOfResource ? length : min(length, requestedEnd)
            let position = data.currentOffset
            guard !overflow, data.requestedOffset >= 0, data.requestedLength >= 0,
                position >= data.requestedOffset, position <= end, try descriptor.size == length
            else { throw NativeFailure.decodeFailed("Invalid media byte range or changed input length.") }
            if position == end {
                request.finishLoading()
                pending.removeValue(forKey: key)
                return
            }
            let count = Int(min(Int64(chunkBytes), end - position))
            guard count <= maximumBytes - delivered else {
                throw NativeFailure("LIMIT_EXCEEDED", "Media input exceeds its delivered-byte budget.")
            }
            try autoreleasepool {
                var chunk = Data(count: count)
                let actual = chunk.withUnsafeMutableBytes {
                    pread(descriptor.descriptor, $0.baseAddress, count, position)
                }
                guard actual == count else {
                    throw NativeFailure.decodeFailed("Short read from inherited media input.")
                }
                delivered += count
                data.respond(with: chunk)
            }
            // Yield after every chunk: AVFoundation initially asks for an entire MOV,
            // then cancels that request to seek its metadata. A synchronous loop blocks
            // the cancellation callback and accidentally materializes the whole file.
            queue.async { [weak self] in self?.pump(key) }
        } catch {
            if failure == nil { failure = error as? NativeFailure }
            request.finishLoading(with: error)
            pending.removeValue(forKey: key)
        }
    }
}

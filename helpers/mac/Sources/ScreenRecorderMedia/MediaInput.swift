@preconcurrency import AVFoundation
import Darwin
import AudioToolbox
import Foundation
import UniformTypeIdentifiers

/// An inherited handle is a private media address, not a filesystem path to resolve.
/// Its duplicate outlives the caller's handle; normal paths keep the native URL behavior.
public final class MediaInput: @unchecked Sendable {
    /// Whole-file verification keeps descriptor/chunk bounds but may consume more than an inspection budget.
    public enum ReadPurpose: Sendable { case inspection, streaming }
    public let asset: AVURLAsset
    public let url: URL
    private let loader: DescriptorLoader?

    public init(url: URL, purpose: ReadPurpose = .inspection) throws {
        let descriptor = try MediaDescriptor(url: url, writable: false)
        self.url = descriptor?.url ?? url.resolvingSymlinksInPath().standardizedFileURL
        if let descriptor {
            let loader = try DescriptorLoader(descriptor, purpose: purpose)
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

    /// Descriptor reads include repeated successful pread bytes, header sniffing and type identification.
    /// URL-backed AVFoundation I/O is unknown; these are not physical disk measurements.
    public struct ReadWork: Sendable {
        public let readBytes: Int64
        public let deliveredBytes: Int64
    }
    public var readWork: ReadWork? { loader?.currentReadWork() }

    public var failure: NativeFailure? { loader?.currentFailure() }

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
        else { throw NativeFailure.decodeFailed(
            "Media handle must be a regular file with the required access.") }
        let owned = fcntl(original, F_DUPFD_CLOEXEC, 0)
        guard owned >= 0 else { throw NativeFailure.decodeFailed(
            "Cannot retain inherited media handle.") }
        descriptor = owned
    }
    deinit { close(descriptor) }
}

private final class DescriptorLoader: NSObject, AVAssetResourceLoaderDelegate, @unchecked Sendable {
    let queue = DispatchQueue(label: "screenrec.media-descriptor")
    let extensionName: String
    private let contentType: String
    private let descriptor: MediaDescriptor
    private let length: Int64
    private var pending: [ObjectIdentifier: AVAssetResourceLoadingRequest] = [:]
    private var delivered: Int64 = 0
    private var readBytes: Int64 = 0
    private var stopped = false
    private var failure: NativeFailure?
    // Identification and AVFoundation delivery share one logical inspection-byte allowance.
    // They apply to bounded inspection calls, not a whole-movie streaming contract.
    private let maximumBytes: Int64?
    private let maximumRequests = 8
    private let chunkBytes = 64 * 1024

    init(_ descriptor: MediaDescriptor, purpose: MediaInput.ReadPurpose) throws {
        // Identification always has a finite cap, including for whole-file streaming.
        let identificationBudget: Int64 = 64 * 1024 * 1024
        maximumBytes = purpose == .inspection ? identificationBudget : nil
        self.descriptor = descriptor
        length = try descriptor.size
        var prefix = [UInt8](repeating: 0, count: 12)
        let count = pread(descriptor.descriptor, &prefix, prefix.count, 0)
        readBytes = Int64(max(0, count))
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
        } else if prefix.prefix(4).elementsEqual("FORM".utf8),
            prefix.suffix(4).elementsEqual("AIFF".utf8) || prefix.suffix(4).elementsEqual("AIFC".utf8) {
            let type = try DescriptorAudioType(prefix.suffix(4).elementsEqual("AIFF".utf8)
                ? kAudioFileAIFFType : kAudioFileAIFCType)
            extensionName = type.extensionName
            contentType = type.contentType
        } else if prefix.prefix(4).elementsEqual("fLaC".utf8) {
            let type = try DescriptorAudioType(kAudioFileFLACType)
            extensionName = type.extensionName
            contentType = type.contentType
        } else if prefix.prefix(3).elementsEqual("ID3".utf8)
            || (prefix[0] == 0xff && prefix[1] & 0xe0 == 0xe0) {
            // ID3 may prefix other audio, and a sync-looking prefix is not proof of MP3.
            let headerBytes = readBytes
            let result = try DescriptorAudioType.identify(descriptor,
                maximumBytes: identificationBudget - headerBytes)
            extensionName = result.type.extensionName
            contentType = result.type.contentType
            readBytes += result.readBytes
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
            // These pinned regular-file bytes are ready now, not progressively downloaded.
            info.isEntireLengthAvailableOnDemand = true
        }
        guard request.dataRequest != nil else {
            request.finishLoading()
            return true
        }
        guard pending.count < maximumRequests else {
            let error = NativeFailure(
                "LIMIT_EXCEEDED", "Media input exceeds its concurrent request budget.")
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

    func currentReadWork() -> MediaInput.ReadWork {
        queue.sync { .init(readBytes: readBytes, deliveredBytes: delivered) }
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
            else { throw NativeFailure.decodeFailed(
                "Invalid media byte range or changed input length.") }
            if position == end {
                request.finishLoading()
                pending.removeValue(forKey: key)
                return
            }
            let count = Int(min(Int64(chunkBytes), end - position))
            if let maximumBytes, Int64(count) > maximumBytes - readBytes {
                throw NativeFailure(
                    "LIMIT_EXCEEDED", "Media input exceeds its inspection byte budget.")
            }
            try autoreleasepool {
                var chunk = Data(count: count)
                let actual = chunk.withUnsafeMutableBytes {
                    pread(descriptor.descriptor, $0.baseAddress, count, position)
                }
                readBytes += Int64(max(0, actual))
                guard actual == count else {
                    throw NativeFailure.decodeFailed("Short read from inherited media input.")
                }
                delivered += Int64(count)
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

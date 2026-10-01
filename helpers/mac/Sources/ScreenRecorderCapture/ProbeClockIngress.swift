@preconcurrency import AVFoundation
import Foundation
@preconcurrency import ScreenCaptureKit

package enum ProbeRole: String, Codable { case screen, camera, microphone }
package struct ProbeTime: Codable {
    let value: Int64
    let timescale: Int32
    let epoch: Int64
    var time: CMTime { CMTime(value: value, timescale: timescale, flags: .valid, epoch: epoch) }
    init(_ time: CMTime) { value = time.value; timescale = time.timescale; epoch = time.epoch }
}

/// Streams clock observations and accepted camera mappings on the existing capture writer queue.
package final class ProbeClockIngress: NSObject, SCStreamOutput, AVCaptureVideoDataOutputSampleBufferDelegate,
    @unchecked Sendable {
    package let writer: CaptureWriter
    package let camera: CameraWriter
    private let observations: FileHandle
    package let observationURL: URL
    package var cameraSession: AVCaptureSession?
    private let failure: @Sendable (CaptureFailure) -> Void
    private var stopped = false
    private let maximumRows: Int
    private var rows = 0
    private let generation = UUID().uuidString

    package init(writer: CaptureWriter, camera: CameraWriter, observations: URL,
        failure: @escaping @Sendable (CaptureFailure) -> Void, maximumRows: Int = 5_000_000) throws {
        self.writer = writer; self.camera = camera; self.failure = failure
        self.maximumRows = maximumRows
        self.observationURL = observations
        guard FileManager.default.createFile(atPath: observations.path, contents: nil) else {
            throw CaptureFailure("WRITE_FAILED", "Cannot create clock evidence.")
        }
        self.observations = try FileHandle(forWritingTo: observations)
    }
    package func stream(_ stream: SCStream, didOutputSampleBuffer sample: CMSampleBuffer,
        of type: SCStreamOutputType) {
        guard type == .screen || type == .microphone else { return }
        accept(sample, role: type == .screen ? .screen : .microphone, from: stream.synchronizationClock)
    }
    package func captureOutput(_ output: AVCaptureOutput, didOutput sample: CMSampleBuffer,
        from connection: AVCaptureConnection) {
        accept(sample, role: .camera, from: cameraSession?.synchronizationClock)
    }
    package func captureOutput(_ output: AVCaptureOutput, didDrop sample: CMSampleBuffer,
        from connection: AVCaptureConnection) {
        do { try log(sample, role: .camera, arrivalHostUs: CaptureHostTime.nowUs(), converted: nil, disposition: "device-dropped", sourceUs: nil, clock: cameraSession?.synchronizationClock) }
        catch { fail(error) }
    }
    @discardableResult
    package func accept(_ sample: CMSampleBuffer, role: ProbeRole, from clock: CMClockOrTimebase?) -> CaptureWriter.IngressReceipt? {
        guard !stopped else { return nil }
        let arrival = CaptureHostTime.nowUs()
        do {
            guard let clock else {
                throw CaptureFailure("CLOCK_UNAVAILABLE", "Selected \(role.rawValue) synchronization clock is unavailable.")
            }
            let host = CMSyncConvertTime(sample.presentationTimeStamp, from: clock, to: CMClockGetHostTimeClock())
            let converted = try Self.convert(sample, from: clock)
            let receipt: CaptureWriter.IngressReceipt
            var frame: ProbeCameraFrame?
            if role == .camera {
                (receipt, frame) = try camera.append(converted, state: writer.ingressState)
            } else {
                receipt = writer.ingestObserved(converted, of: role == .screen ? .screen : .microphone)
            }
            try log(sample, role: role, arrivalHostUs: arrival, converted: host, disposition: receipt.disposition,
                sourceUs: receipt.sourceUs, clock: clock, cameraFrame: frame)
            return receipt
        } catch {
            // A failed append can leave a torn tail. Never append another row behind it.
            fail(error)
            return nil
        }
    }
    private func fail(_ error: Error) {
        guard !stopped else { return }
        stopped = true
        failure((error as? CaptureFailure) ?? CaptureFailure("PROBE_EVIDENCE_FAILED", error.localizedDescription))
    }
    private func log(_ sample: CMSampleBuffer, role: ProbeRole, arrivalHostUs: Int64, converted: CMTime?,
        disposition: String, sourceUs: Int64?, clock: CMClockOrTimebase?, cameraFrame: ProbeCameraFrame? = nil) throws {
        guard !stopped else { return }
        struct Row: Codable {
            let role: ProbeRole
            let clockDomain: String
            let generation: String
            let rawPTS: ProbeTime
            let convertedHostPTS: ProbeTime?
            let arrivalHostUs: Int64
            let duration: ProbeTime
            let sourceUs: Int64?
            let disposition: String
            let relativeRate: Double?
            let cameraFrame: ProbeCameraFrame?
        }
        // A fixed-duration probe also bounds a pathological callback flood; never grow an array.
        guard rows < maximumRows else { throw CaptureFailure("EVIDENCE_LIMIT", "Clock observation limit reached.") }
        let rate = clock.map { CMSyncGetRelativeRate($0, relativeTo: CMClockGetHostTimeClock()) }
        let row = Row(role: role, clockDomain: role == .camera ? "camera-session" : "screen-stream", generation: generation, rawPTS: ProbeTime(sample.presentationTimeStamp),
            convertedHostPTS: converted.map(ProbeTime.init), arrivalHostUs: arrivalHostUs,
            duration: ProbeTime(sample.duration), sourceUs: sourceUs, disposition: disposition,
            relativeRate: rate.flatMap { $0.isFinite ? $0 : nil }, cameraFrame: cameraFrame)
        try observations.write(contentsOf: JSONEncoder().encode(row) + Data([10])); rows += 1
    }
    package func close() throws {
        stopped = true
        try observations.synchronize(); try observations.close()
    }
    package static func convert(_ sample: CMSampleBuffer, from clock: CMClockOrTimebase) throws -> CMSampleBuffer {
        try timingCopy(sample) { timing in
            let start = timing.presentationTimeStamp
            let host = CMSyncConvertTime(start, from: clock, to: CMClockGetHostTimeClock())
            guard host.isNumeric, host.epoch == 0 else { throw CaptureFailure("INVALID_CLOCK", "Invalid converted timestamp.") }
            if timing.duration.isNumeric && timing.duration > .zero {
                let end = CMSyncConvertTime(CMTimeAdd(start, timing.duration), from: clock, to: CMClockGetHostTimeClock())
                guard end.isNumeric, end.epoch == 0, end > host else { throw CaptureFailure("INVALID_CLOCK", "Invalid converted endpoint.") }
                timing.duration = CMTimeSubtract(end, host)
            }
            timing.presentationTimeStamp = host
            if timing.decodeTimeStamp.isNumeric {
                timing.decodeTimeStamp = CMSyncConvertTime(timing.decodeTimeStamp, from: clock, to: CMClockGetHostTimeClock())
                guard timing.decodeTimeStamp.isNumeric, timing.decodeTimeStamp.epoch == 0 else { throw CaptureFailure("INVALID_CLOCK", "Invalid converted decode timestamp.") }
            }
        }
    }
    package static func retime(_ sample: CMSampleBuffer, to host: CMTime, duration: CMTime? = nil) throws -> CMSampleBuffer {
        guard host.isNumeric, host.timescale > 0, host.epoch == 0,
            sample.presentationTimeStamp.isNumeric else {
            throw CaptureFailure("INVALID_CLOCK", "Clock conversion must yield numeric epoch-zero host time.")
        }
        let offset = CMTimeSubtract(host, sample.presentationTimeStamp)
        return try timingCopy(sample) { timing in
            if let duration { timing.duration = duration }
            timing.presentationTimeStamp = CMTimeAdd(timing.presentationTimeStamp, offset)
            if timing.decodeTimeStamp.isNumeric { timing.decodeTimeStamp = CMTimeAdd(timing.decodeTimeStamp, offset) }
        }
    }
    private static func timingCopy(_ sample: CMSampleBuffer, transform: (inout CMSampleTimingInfo) throws -> Void) throws -> CMSampleBuffer {
        var count = 0
        guard CMSampleBufferGetSampleTimingInfoArray(sample, entryCount: 0, arrayToFill: nil,
            entriesNeededOut: &count) == noErr, count > 0 else {
            throw CaptureFailure("INVALID_CLOCK", "Sample has no timing entries.")
        }
        var times = [CMSampleTimingInfo](repeating: CMSampleTimingInfo(), count: count)
        guard CMSampleBufferGetSampleTimingInfoArray(sample, entryCount: count, arrayToFill: &times,
            entriesNeededOut: &count) == noErr else { throw CaptureFailure("INVALID_CLOCK", "Cannot read sample timing.") }
        for i in times.indices { try transform(&times[i]) }
        var output: CMSampleBuffer?
        guard CMSampleBufferCreateCopyWithNewTiming(allocator: kCFAllocatorDefault, sampleBuffer: sample,
            sampleTimingEntryCount: count, sampleTimingArray: &times, sampleBufferOut: &output) == noErr,
            let output else { throw CaptureFailure("INVALID_CLOCK", "Cannot retime sample.") }
        return output
    }
}

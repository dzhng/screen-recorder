import ScreenRecorderMedia

extension CompositionAudio {
    static func applyGain(
        _ processor: CompositionProcessing.Processor, to samples: inout [Float], position: Int64
    ) throws {
        let scalar = processor.gain!
        if let value = scalar.constant, processor.active == nil {
            let gain = Float(value)
            for index in samples.indices { samples[index] *= gain }
            return
        }
        let end = position + Int64(samples.count / 2)
        func apply(_ start: Int64, _ end: Int64) throws {
            if let value = scalar.constant {
                let gain = Float(value)
                for index in Int(start - position) * 2..<Int(end - position) * 2 {
                    samples[index] *= gain
                }
            } else {
                for frame in start..<end {
                    let value = scalar.sample(frame)
                    guard value.isFinite, value >= 0, value <= Double(Float.greatestFiniteMagnitude)
                    else { throw NativeFailure("INVALID_AUDIO", "Gain produced an invalid sample value.") }
                    let gain = Float(value), index = Int(frame - position) * 2
                    samples[index] *= gain
                    samples[index + 1] *= gain
                }
            }
        }
        guard let active = processor.active else { try apply(position, end); return }
        var lower = 0, upper = active.count
        while lower < upper {
            let middle = (lower + upper) / 2
            if active[middle].end <= position { lower = middle + 1 } else { upper = middle }
        }
        while lower < active.count && active[lower].start < end {
            let span = active[lower]
            try apply(max(position, span.start), min(end, span.end))
            lower += 1
        }
    }
}

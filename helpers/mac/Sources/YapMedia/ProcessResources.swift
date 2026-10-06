import Darwin

/// Resource use of the worker process itself, which lives for one request.
public enum ProcessResources {
    /// The largest resident set this process has held so far. macOS reports it in bytes.
    public static func peakResidentBytes() -> Int64 {
        var usage = rusage()
        getrusage(RUSAGE_SELF, &usage)
        return Int64(usage.ru_maxrss)
    }
}

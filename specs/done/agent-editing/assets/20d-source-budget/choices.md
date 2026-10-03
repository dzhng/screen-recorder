# Source budget choices

- Budget canonical segment verification separately from byte throughput, because sparse payload size does not represent platform metadata work.
- Keep the ten-minute allowance specific to publication-backed source verification, alongside existing byte-pass sizing and cancellation. Preserve legacy and global/client defaults.
- Route recording source normalization through the existing SourceExporter used by acquisition/package paths; do not create another worker owner.
- Use existing recording.delete authority for the public cancel-and-drain proof. Record unavailable job.cancel as a harness/domain correction, not a new API requirement.
- Treat native probe delivery and physical segment cardinality as distinct next gates. Do not drop gaps, infer support from occupied count alone or declare full 100k portability from source readiness.

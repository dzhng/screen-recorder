# Choices

- Keep one native metadata producer and the existing strict service decoder. A
  file receipt changes delivery, not media interpretation or stored asset shape.
- Reuse caller-owned attempt files and leases. Caller descriptor indices precede
  hidden lifetime descriptors, so `/dev/fd/N` remains meaningful.
- Preserve ordinary owned-path probing. A trial descriptor switch changed an
  unsupported FFV1 result into a native decode error; that unrelated change was
  removed. Canonical source verification retains its pre-existing descriptor
  requirement.
- Keep inline native probing for existing direct consumers. Service asset and
  canonical admission use file delivery, with no fallback after a failed receipt.
- Retain separate next gates for physical rows, public metadata reads, and portable
  metadata inventory. No empty segments are dropped and no global control-frame
  or archive-manifest limit is increased here.

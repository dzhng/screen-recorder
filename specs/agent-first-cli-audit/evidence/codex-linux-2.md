Setup result: **native installation is unsupported on arm64 Linux Docker**. The supplied screenrec instructions require Apple Silicon with macOS 26+.

- No installation or download was executed.
- `screenrec` is absent from the inspection environment.
- No portable JavaScript CLI bundle was supplied, so CLI verification could not run.
- Linux can run the portable CLI with Node for schema/transport tests; that does not verify native service or capture readiness.

The inspection host reports Darwin arm64, so it does not verify the stated Linux target.
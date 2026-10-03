# Merged audio export and service process checkpoint

Status: scoped public functional checks pass at `baa92372`; existing large-fixture
deadlines remain red. [Verification](verification.json) owns exact run verdicts,
worker identity, archive identity and limits. [Archive members](archive-members.json)
bind every retained byte in `evidence.tar.gz`.

The archive retains the actual audio CLI/MCP exchanges, independent sample oracle,
published WAV/AAC files, source process/control/discovery exchanges, terminal child
records and current producer sources/emitted runtime. The original
[audio packet](../09c-audio-export/README.md),
[native packet](../09c-native-audio-file/README.md) and
[process packet](../23i-service-process-parity/README.md) are unchanged. Root checks
verify those archives separately and record intentional service input differences;
the new public journeys exercise those merged inputs directly.

The affected suite retains two deadline failures, then one isolated retry of each
with the same five-second deadline. The post-retry host snapshot records heavy
unrelated CPU activity. That observation limits timing interpretation; it does not
prove the cause or erase the failures. No latency, installed presentation, physical
synchronization, completed-stop or broader speech-quality pass is claimed.

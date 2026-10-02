# Compressed reader authority

[The report](report.json) qualifies the actual compressed-input observations.
The native reader returned media and marker buffers; all were retained intact.
Per-media timing and payload correspondence is separate from buffer ordinal,
and raw/output timing and absent fields remain distinct. The first observed
marker explains why requiring every returned buffer to contain one data block
and format is incompatible with this documented reader contract. It does not
retroactively record the historical failed guard operand.

[The manifest](manifest.json) pins the full executed namespace, including all
buffer facts, payloads, source/binary, actual commands and terminal receipts,
cache inventories and saved checks. Every archive member was read and rehashed.
Original media and previous outcomes remain with their existing authorities.

No writer or pixel decoder ran. These observations can inform a separately
reviewed container experiment; they do not authorize dropping markers, splitting
groups, changing clocks or adopting a canonical mechanism.

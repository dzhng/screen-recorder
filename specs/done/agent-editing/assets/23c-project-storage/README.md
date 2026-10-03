# Fresh-library storage preservation

The isolated project service exposes the existing aggregate `storage.usage`
operation through the same contained scanner used by recording storage. Retained
library files are shared across projects; registered derivatives remain cache
bytes, and unfinished or unattributed files remain counted. Models and donor
files are excluded. This does not allocate shared assets to projects or switch
the installed application.

The native external-destination owner rejects directories beneath the managed
root by ancestor device/inode identity. Its private staging observation therefore
adds external bytes without recounting a subtree of the library. The scanner
never opens completed external outputs. Existing recording scope and categories
retain their behavior.

[Core storage tests](../../../../../packages/core/src/storage.test.ts) retain the
containment, replacement, coalescing, yielding, deletion and file-lifetime gates.
[Public tests](../../../../../apps/service/src/project-storage.test.ts) exercise
aggregate bytes, parameter refusal and shutdown through the actual socket.
Filesystem holds are test-boundary controls; they create no product hook or
second scanner. No real capture, media/model execution or app launch is used.

Verification results and retained review limitations are in [verification](verification.json).
[Root integration](root-verification.json) records the merged build and public tests.
Independent root diff and shape review is clean; it checked the one-owner scanner,
external staging authority, early shutdown cancellation and actual public scopes.
The independent CLI review was attempted but could not start because its configured
model was unsupported; its log is retained and supplies no review verdict.

# 05 — Managed FFmpeg publication

Status: internal managed-artifact seam implemented; recipe consumers and packaged integration remain their owning gates. Question: **Can only the current attempt publish a completed new artifact?**

Dependencies: [03](03-cli-lifetime.md), [04](04-input-authority.md).

## Contract and owner

Existing core jobs/export intent, private staging and service publication; native OutputFile contracts.

FFmpeg writes attempt-owned private staging, then existing owner validates and publishes exclusively. Exit zero alone is not readiness. Retain recipe/input/revision identities; replay uncertain acknowledgement with original intent. Direct CLI extra files remain external artifacts.

## Focused proof and review

A tiny managed artifact plus cancel/crash/race receipts.

Existing destination and source alias remain untouched. Test cancellation, death, stale completion, destination replacement, retry and acknowledgement loss. Confirm worker retirement before cleanup and output identity before adoption. The -n flag is not the publication oracle.

## Boundaries and decision budget

Inherit the [global contract](../README.md#contracts-and-ownership) and narrow verification policy. Write-tests red/green precedes behavior changes. Existing native output and persisted identity remain unchanged unless this slice names the extension.

Delegate internal naming/decomposition, bounded fixture selection and reversible artifact styling. Public meaning and backend policy are fixed above; resolve a new semantic choice in this spec before coding it. Record actual commands, immutable input/runtime identities, coverage, failures and verdict. User feedback changes requested meaning, supported scope or visible appearance; mechanical preferences alone do not justify expanding the slice. A failed proof remains unfinished and must be narrowed or resliced, not waived.

### Frozen private allocation seam

The existing render-attempt owner retains the private directory and cleanup. The
CLI owner exclusively creates a single leaf through that inherited directory
descriptor, using the shared native exclusive-openat primitive, and replaces only
an explicit `/dev/null` output placeholder slot. Source/control/directory slots
are never replaced. Completion records device/inode as decimal strings; size and
media validation occur only after the entire group retires. Reopening the old
staging locator requires matching that allocated identity, so a renamed or
replaced directory fails rather than writing elsewhere. There is no additional
job, public schema, staging owner, or publication protocol.

The retained-directory replacement regression was red before implementation:
no artifact existed in the moved directory (ENOENT).

### Focused evidence and remaining boundaries

- The retained-directory regression was red (ENOENT), then green: allocation follows the held renamed directory while the replacement's canary remains unchanged.
- Occupied-leaf/source-slot refusal preserves bytes. Removing O_EXCL deliberately made the occupied-leaf regression red; restoring it passes.
- The artifact consumer receives validated readonly identified bytes and their held-file hash before the existing attempt cleans staging. Exit-zero invalid media never reaches consumption; deliberately bypassing its domain validator made the rejection regression red, then restored green.
- Replacing the output leaf before completion cannot reach validation/consumption. Deliberately removing allocated inode comparison made this regression red; restoring it passes.
- Cancellation retires the writer before validation, consumption and attempt cleanup. Existing render/publication owners retain destination, retry and acknowledgement meaning; this slice adds no parallel publication implementation.
- A real prepared FFmpeg generated 100ms mono PCM WAV through the allocated seekable output slot, then native probing of the held readonly output reported 48000Hz and exactly `0..100000us`. The artifact was hashed and consumed under the attempt lock, then real native workspace cleanup completed. This is a single primitive proof, not a demo edit or delivered project. The retained receipt is [managed-artifact.json](../evidence/managed-artifact.json).

The current Media sources (including NewFile.write's shared allocator) compile as
an isolated module; the private CLI owner compiles from current production sources
in the focused fixture. The real artifact validator/cleanup reused the frozen
source-probe executable named by SHA in the receipt, not a newly linked full native
package. Final packaged native integration and recipe-specific artifact validators
remain owning slice/release gates. No user media, library, app installation or
shared build output was changed.

Final self-review exposed the bound native worker to validators and in the held
artifact context: native validation/consumption must inherit attempt directory
locks, including if the service exits before its reader. This reuses the existing
render worker rather than adding another process or lease owner.

Final scoped check: 48 cases pass across artifact/input/CLI/worker/render files,
with two existing skips. Service typecheck/build, scoped lint and diff checks pass.
The updated CLI smoke also verifies real prepared FFmpeg completion, cancellation
and service death. Independent reviews report no actionable defects, including
final held-output/native-worker ownership; service-death lock safety in that final
wiring review is source-level evidence, not a new runtime scenario. Review shape,
diff and owning docs are clean. Full native package/release execution remains
unverified by this slice.

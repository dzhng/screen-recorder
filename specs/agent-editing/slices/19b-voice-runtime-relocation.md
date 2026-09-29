# 19b — Relocatable prepared voice runtime

Status: planned. Parent: [19](19-voice-assets.md). Dependencies: [19a](19a-voice-entry-parity.md).

## Contract

A prepared local voice runtime must work independently of the development paths
that supplied it. Prove that exact frozen synthesis survives relocation before
public model readiness relies on the Python environment. This checkpoint owns
runtime packaging evidence, not a new registry or public generation API.

## Seam and ownership

The existing measured environment has a Python executable symlink and a venv
configuration pointing outside the venv. Copying that directory alone is not
preparation. Inventory the interpreter distribution, standard library, installed
packages and native/Metal resources actually required by the frozen entry.
Create a complete relative file-content manifest for the packaged closure,
including modes and symlink targets where relevant. Reject links escaping the
bundle. Record platform and interpreter identity. Absolute source paths are
provenance, never the runtime identity or a readiness dependency.

Use existing local bytes only. No network, package resolver, installation into
the user's environment, dependency removal, version change or model conversion.
A measured installed-byte artifact is sufficient for this offline checkpoint;
rebuilding it from upstream wheels and distributing it are separate work. Do not
claim the existing dependency-version checks authenticate all binary contents.

Keep the frozen worker, model, generation arguments and reference inputs intact.
Any relocation configuration change must be explicit and included in the artifact
identity. The experiment may use an isolated bundle assembly script; it must not
introduce a parallel production preparation store. The subsequent common model
owner consumes the proven artifact layout and retains existing ASR behavior.

## Verification and review surface

Measure required logical/allocated bytes and available storage before assembly.
Use filesystem copy-on-write cloning if supported, never writable hardlinks to
source files. Preserve originals and all frozen evidence. No multi-GB model copy
is needed to prove runtime relocation: an explicit verified existing model path
may remain separate and must be declared as such.

Run both frozen texts from the relocated runtime in new processes with network
and original interpreter/venv paths denied by the operating system. Do not rename
or delete the originals. Compare complete WAVs and every PCM sample with19a;
keep the original recipe and zero tolerance. Record effective import paths and
native library dependencies so accidental donor access cannot pass unnoticed.
Run a negative control that intentionally relies on a denied donor path and
confirm the denial. If necessary distinguish package import closure from OS
framework dependencies, which remain platform prerequisites.

The report must describe what was relocated, what stayed external, every changed
configuration byte and the manifest identity. A failed trial stays evidence and
must not be relabeled ready. A successful runtime result does not prove public
model preparation, downloadable distribution, cross-machine portability, voice
quality or managed reference retention.

## Failure boundary and discretion

If exact parity or donor-path independence fails, diagnose the smallest missing
runtime dependency before changing packaging. Do not loosen output checks or
patch generation to make the package pass. Leave19 public integration open.

Delegated: bundle directory layout, inventory tool and bounded assembly mechanics.
No public settings or installation-policy decision is delegated by this slice.
User feedback changing supported platform or distribution expectations changes
this checkpoint; otherwise preserve the measured arm64 macOS environment.

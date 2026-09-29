# Closeout review

Independent Codex review found one actionable defect: ambient PYTHONPATH could
shadow the installed runtime after distribution files passed verification. A real
shadow module reproduced the failure. Python now runs with -I and -B; the same
shadow control passes exact frozen word/phrase bytes. HF offline flags and OS
network denial remain in effect.

Integration and self-review also found native executable lookup had moved from
per-call to factory time. Its regression failed before repair and passes with
the original binding semantics restored through the same process owner.

Shape: no second queue, asset owner, model registry or cleanup mechanism. The
recipe manifest is the authoritative model/runtime metadata; the service keeps
only its byte envelope and reads expected revision labels from the verified
handle. Dependencies are version checked, mlx-audio Python sources and model
files byte checked, and the Python executable/entry/manifest byte checked. This
is not a claim that all dependency binaries are authenticated.

Diff and docs: focused service type checks, formatter and 30 shared lifetime
checks pass. The final actual-entry gate passes all 13 cases. No public endpoint
or voice-quality acceptance was added. Root owns hub and choices integration.

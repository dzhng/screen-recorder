# 14d2b2 — Pinned video dependencies through waiting admission

Status: internal consumer implemented and verified. No public export route, startup
recovery sweep or menu capability is claimed.

## Pin intent before waiting, evidence before rendering

[MediaExports](../../../apps/service/src/exports.ts) pins revision and history
when the request arrives, before asynchronous destination validation or dependency
waiting. Its deferred job requests the existing source and preview owners; neither
polling nor repeated requests retries failed dependencies. The service must install
the queue admission callback only after those owners are bound.

Source evidence may not exist at request time. The first successful source readiness
selects a generation, which the intent persists before preview admission. Subsequent
attempts pass that exact evidence to [PreviewInspection](https://github.com/dzhng/screen-recorder/blob/d0b1dca7d1225728d4c6c3353ff26675e33e084f/packages/core/src/preview.ts),
including after a newer source generation becomes current. Source cleanup consults
one injected retention predicate in its existing owner; exports do not own a second
cleanup process or copy evidence into another store.

## Retention is finite and has an end

All uncommitted intents count toward one finite allowance, including failed and
canceled requests and intents that have not selected evidence yet. A canceled request
keeps its exact-retry evidence; cancellation therefore does not free this allowance.
The pending-intent index bounds retention lookup and admission counting independently
of completed history. The nullable evidence field identifies this development schema;
older internal catalogs follow the existing rejection-before-write policy.

A durable commit releases the source-generation protection because this intent can
never regenerate or republish. Its historical receipt remains cheap to inspect.
Recording deletion still retires intent metadata and private staging after job drain.
**Per-export abandonment is mandatory before public exposure:** cancel and drain one
intent, retire only its owned staging, release its pins/metadata, and preserve both
the recording and every external file. Interrupted cleanup must remain recoverable
through the existing publication owner. Hitting the allowance must not force users
to delete recordings or unrelated colliding destination files.

## Lost preview, released worker

A ready preview can disappear between promotion and descriptor acquisition. If no
prepared publication exists, the exporter clears its obsolete preview selection and
returns a typed lost-dependency outcome. Its finally block closes publication ownership
before the queue settles that attempt. JobQueue then returns the same job to bounded
waiting with a fresh attempt/generation; it releases the lane before the dependency
owner can regenerate the preview. Admission rechecks the pinned evidence and requests
the missing derivative. It never waits for rendering inside an export worker.

A staging identity plus prior preview selection may instead represent an uncertain
completed publication. Such an attempt reconciles first, even if source readiness
has since failed. A known prepared payload is sufficient for publication; a missing
unprepared preview goes back through dependency admission. This avoids discarding
external commit truth because an unrelated prerequisite is no longer available.

## Verification and next gates

[Evidence](../assets/export-publication/waiting-video.md) covers actual generated
native rendering, edits while waiting, selected-generation cleanup/retry interleaving,
cache eviction after promotion, failed dependency inspection, retention bounds and
negative controls. Empty-pointer silent media proves these lifetimes; it is not new
physical-pointer, narration or processed-package acceptance.

Next owner work is per-export abandonment and queued startup reconciliation, followed
by private staging storage accounting, size-appropriate existing Publication deadlines
and actual service/public/menu wiring. Processed-package and accepted-transcript
prerequisites remain intact. This internal video consumer does not narrow the two
public product choices.

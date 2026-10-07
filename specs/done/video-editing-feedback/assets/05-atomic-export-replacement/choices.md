# Slice05 decision audit inputs

Parent owns the feature choices ledger. These standalone entries preserve the
walked scenarios for integration; no global ledger or feature handoff is edited.
All entries are sound. Review the medium-confidence platform boundary first.

## Cooperative ownership and truthful external conflict

- **When:** slice05.
- **Choice:** serialize Yap publishers by the destination directory, and retain
  every unexpected displaced entry after an external race. Suppose Yap pins the
  current output, then another same-user program replaces it immediately before
  the kernel swap. macOS cannot condition that swap on the expected file identity
  or digest. Yap can therefore publish its new file while discovering afterward
  that it displaced unknown bytes. It reports a conflict with uncertain visibility
  and retains the unknown entry. Recovery never swaps backward over a possible
  newer output. A raced symlink is swapped as a link; its referent stays intact.
  The alternative rollback could destroy a successor. This boundary was frozen
  with parent approval after exercising the actual syscall.
- **Gap:** the original atomic-replacement brief did not specify guarantees
  against external writers that ignore ownership or the OS's final-symlink rule.
- **Reach:** all replacement consumers inherit cooperative serialization and the
  explicit external-race limitation; unknown displacement can block cleanup.
- **Verdict:** sound; truthful retained conflict is the guarantee the OS permits.
- **Confidence:** medium; this is a material platform tradeoff, not universal CAS.

## Trust exact live bytes through existing receipts

- **When:** slice05.
- **Choice:** a destination is trusted only if its directory, leaf, device/inode,
  length and SHA-256 match an existing recorded publication receipt. If a person
  edits the output in place or puts identical bytes in another file, the new
  export treats it as foreign and needs explicit overwrite. An index on existing
  export records makes that lookup bounded by the selection rather than scanning
  history. The alternative trusting the name or a formerly owned inode would
  replace modifications that Yap did not produce.
- **Gap:** the brief named trusted ownership but not its persisted lookup.
- **Reach:** receipt retention supplies future replacement trust; deleting the
  owning intent removes that trust rather than creating a separate ownership DB.
- **Verdict:** sound; existing publication evidence stays the one owner.
- **Confidence:** high.

## Imported original identity belongs to the asset owner

- **When:** slice05.
- **Choice:** the asset store indexes the device/inode recorded when an original
  was imported. If the person renames that original or hardlinks it as another
  output leaf, overwrite still refuses it. Service maps native identity names
  into the existing asset file-identity names at this boundary. It checks again
  before commit so an import admitted during preparation is protected too. A
  path-only blacklist would miss the renamed/aliased original.
- **Gap:** source preservation did not name an original-identity query owner.
- **Reach:** import records own external-original protection; no second source
  registry or adapter-specific blacklist is introduced.
- **Verdict:** sound; identity protection follows the current durable owner.
- **Confidence:** high.

## Explicit overwrite participates in replay identity

- **When:** slice05.
- **Choice:** omitted and false overwrite both mean no foreign replacement;
  true is distinct in the existing request replay key. Suppose an uncertain
  export is replayed with the same exportId but now allows foreign replacement.
  That is a different authorization, so it refuses as REQUEST_CONFLICT instead
  of treating it as the earlier request. Native prepared receipts require an
  explicit replacement field, including null for absence; old receipt formats
  are not translated.
- **Gap:** the opt-in brief did not define normalization in durable replay.
- **Reach:** CLI/app/shared protocol consumers agree on authorization meaning;
  this is the authorized hard cutover, with no reader shim or migration.
- **Verdict:** sound; recovery cannot silently widen the original request.
- **Confidence:** high.

## Confirmed evidence survives interrupted cleanup

- **When:** slice05.
- **Choice:** after validating the displaced file, native hardlinks its prepared
  receipt as committed evidence. Suppose acknowledgement cleanup removes the
  old leaf, payload and prepared receipt, then the publisher dies before removing
  that last marker. Recovery can still identify the exact new output and finish
  cleanup without publishing it again. Without that marker the missing old leaf
  would be indistinguishable from unconfirmed displacement. Storage counts the
  receipt's shared inode once and counts the retained old bytes separately. A
  retained swap symlink contributes its own no-follow metadata length, so normal
  storage reads remain available without measuring or traversing its referent.
  Existing job conflict details still distinguish it from an owned payload.
- **Gap:** the brief required crash recovery but did not specify partial-cleanup
  evidence or hardlink storage accounting.
- **Reach:** the existing staging lifetime owns the marker; no janitor or new
  publication database is needed.
- **Verdict:** sound; it preserves one receipt through the cleanup transition.
- **Confidence:** high.

## Publication proof isolates unrelated media work

- **When:** slice05.
- **Choice:** compile the real publication, held-storage and worker-lifetime
  sources into a small scratch executable. Public CLI tests export plain captions
  against the real service while substituting only font probe metadata and
  render-workspace disposal. The fault library interposes the actual swap and
  can kill the real native publisher before or after it. This yields filesystem
  and public-contract proof without rebuilding codecs or downloading models;
  the alternative full media fixture would add work unrelated to publication.
- **Gap:** the checkpoint did not mandate a native build recipe.
- **Reach:** these tests certify their named publication contracts only; parent
  still runs the full feature gate. No capture or rendered-quality claim follows.
- **Verdict:** sound; narrow real owners provide fast, meaningful evidence.
- **Confidence:** high.

## Hashing budget includes the pinned victim

- **When:** slice05 closeout.
- **Choice:** extend the existing deadline helper with the old destination's byte
  length, budgeting the native payload and victim verification passes under the
  established worker maximum. Suppose a tiny caption export replaces a large
  explicitly authorized file: hashing that victim is real work even though the
  new payload is small. A payload-only deadline would cancel valid replacement
  work. The cap stays authoritative; no unbounded wait or different timeout
  owner is introduced.
- **Gap:** the existing heuristic predated replacement hashing.
- **Reach:** all export kinds budget pinned file validation through one helper.
- **Verdict:** sound; cost follows actual admitted work and remains capped.
- **Confidence:** high.

# Sentence marking page choices

Root owns source binding, clock conversion, separate-file storage and the real
browser/visual checks. This pass adds only the static listening/marking interface.
It does not create independent labels or declare the page visually verified.

## Sound — high confidence

**Changing a boundary clears listening confirmation.**

- When: sentence marking page UI.
- Choice: A listener can check “I placed these marks by listening,” then decide a
  word edge should move. Typing a new edge, taking the current playhead time or
  clearing a row unchecks that confirmation. They can save the revised work as a
  draft immediately or deliberately confirm the revised marks before saving.
- Gap: The requested confirmation was initially false, but its lifetime after
  later edits was unspecified. Leaving it checked could attach the earlier
  confirmation to marks the listener has not yet reviewed.
- Reach: This governs only this finite marking page's save workflow; it does not
  alter annotation authority or the server's record validation.
- Verdict: sound. Draft saving stays available while confirmed evidence requires
  an explicit action after the most recent boundary edits.
- Confidence: high.

**Freeze the marking fields during a save.**

- When: sentence marking page UI.
- Choice: When Save submits a snapshot of the marks, the form's native fieldset
  temporarily disables its fields and buttons. The original audio remains under
  the listener's controls. On success or failure, editing becomes available again;
  failures retain the entered values. A success message therefore describes the
  same visible marks that were submitted.
- Gap: The request fixed the POST body but did not define editing during an
  outstanding save. Letting fields change while the request runs could show a
  successful save beside newer, unsaved values.
- Reach: No autosave, retry queue, storage owner or additional state machine is
  introduced. This is ordinary browser form behavior around one request.
- Verdict: sound. The user can see which values the save covered, and an error
  does not require reconstructing their listening work.
- Confidence: high.

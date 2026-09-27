# Exact edit boundaries

Nineteen composition tests, build, type checking, lint and the independent
repeat/reorder corpus probe pass. The new split regression initially rejects
fractional stored endpoints. After extending the model, deliberately rounding the
boundary changes source time5 to4 and fails the preservation assertion. Restored
exact arithmetic passes; the source microsecond bin crossing the split returns
both fragments, with only the right fragment containing an integer project time.

Independent Codex review found a malformed-denominator exception escaping typed
validation. A regression reproduced it; range comparison now runs only after
endpoint validation succeeds. Zero/negative/infinite denominators, fractional or
unsafe numerator components return INVALID_COMPOSITION. The full19-test suite
passes after that fix.

Shape review retains the existing rational evaluator and adds one serializable
stored-time representation; no speed/provenance workaround or second mapping is
introduced. Requested command coordinates and admitted source metadata stay
integer microseconds. Stored whole values stay numbers, so existing integer
corpus documents are unchanged. No reducer, renderer or persistence is claimed
complete by this model checkpoint.

The implementation and targeted typechecks otherwise appear consistent, but the durable rendered-speech cache identity is incomplete and can reuse stale transcript-policy output after a policy revision.

Review comment:

- [P2] Pin transcript policy in rendered job identity — /Users/server/dev/yap-rendered-speech/packages/core/src/rendered-speech.ts:79-79
  The rendered job identity includes model and decoder pins but omits `transcriptPolicy`, even though `recognizeSource` stores that policy in the resulting transcript metadata. If the policy changes while an existing catalog is retained, this request will reuse the old publication instead of producing evidence under the new policy; include the policy in the identity just as source transcript jobs do.
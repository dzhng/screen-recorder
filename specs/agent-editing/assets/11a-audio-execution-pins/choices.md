# Decisions for integration

- Version decoder execution separately from portable transcript representation.
  Bumping the serialized transcript policy would also reject retained portable
  metadata through its schema literal; that is unrelated to decoder execution.
- Include the same decoder identity in both recording and asset transcription
  recipes, so a changed decoder cannot reuse or retry under the former recipe.
- Preserve prior immutable generations and their readable words. Current recipe
  selection changes; this is not destructive invalidation of user evidence.
- Advance existing legacy excerpt/preview pins rather than add a parallel recipe
  mechanism. The service owner advances project/source renderer identities.

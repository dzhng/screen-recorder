# Choices

- Uniform headers/pages avoid a hidden small-asset versus large-asset contract.
  Internal complete metadata reads remain available to owners that require them.
- Indexed rows replace JSON arrays rather than caching or duplicating them. The
  old array-presence marker preserves optional-versus-empty semantics with no new
  metadata format or clock interpretation.
- Atomic insertion and shared stream-ID uniqueness prevent one header from aliasing
  another stream's rows. The same strict decoder governs import and adoption.
- A bounded reply did not earn bounded query work. The measured JSON paging draft
  was discarded; indexed keyset queries use the existing AssetStore/catalog owner.
- Catalog 15 identifies the indexed storage change, explicitly refusing old
  catalogs. No new garbage collector or asset deletion API is introduced; the new
  table declares its parent relationship and transaction rollback preserves it.
- Package metadata remains a separate reviewable contract. No global transport
  or manifest limit was increased to make this public inspection pass green.

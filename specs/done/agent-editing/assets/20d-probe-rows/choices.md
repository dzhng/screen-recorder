# Choices

The cap counts physical rows, not available source spans. The bound is 2N+1 for
the already-planned N=100,000 occupied spans; leading/trailing empties are included.
The same schema remains authoritative for generic and canonical admission. This
expands physical representation capacity without discarding gaps, changing timing,
raising global frames, or pretending that all downstream consumers now support the
full occupied-span domain.

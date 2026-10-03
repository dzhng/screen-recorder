# Preparation choices

## Sound — high confidence

**Copy the existing standalone interpreter into the new namespace.** A fresh
virtual environment can otherwise continue to depend on a shared interpreter
outside its retained directory. Copying the existing Python 3.11 source gives
this preparation its own interpreter bytes without modifying the accepted voice
home. The task required an isolated environment but did not specify interpreter
ownership. This choice lets later verification pin and preserve the actual
runtime; it supplies no historical binary-equivalence claim.

**Keep the runtime file inventory in the persistent namespace and pin it from the
compact packet.** The newly installed packages contain many files, while the
reviewable contract is exact versions, actual bytes and preserved ownership.
The packet banks the small reports and references the complete inventory by
hash instead of embedding model/runtime binaries. The task left packet layout
open. Root preservation must retain that external inventory with the namespace;
a small committed report is not a backup of the prepared runtime.

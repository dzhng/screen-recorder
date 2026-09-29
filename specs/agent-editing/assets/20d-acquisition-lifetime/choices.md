# Lifetime choices

- Use one lease for the existing whole-acquisition cleanup domain. Per-attempt locks would need additional intent-only and verify-directory bookkeeping to protect the final pending-row sweep.
- Refuse startup promptly with a retryable domain error while native work survives; do not skip a busy directory and then purge its database reservation.
- Pass borrowed descriptors through existing native worker calls, including metadata probes. Do not create another process supervisor or durable lifetime registry.
- Preserve package and acquisition lifetimes together during adoption. Their cleanup roots are distinct.

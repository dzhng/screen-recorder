# Compile-only preparation diagnostic

**The unchanged probe compiles; this phase measures no physical behavior.**
The single compile-only diagnostic restored the actual retained working SDK cache
recipe and completed normally. Its binary was not invoked during this phase;
the [separate physical continuation](../physical-continuation/README.md) later reused it.
All compiler/source/native module/object/input pins and every cache entry remained
unchanged. The original interrupted setup and timeout packet remain intact.

[The report](report.json) records actual compiler/function timing, terminal facts
and scope. [The manifest](manifest.json) pins literal commands, compiler/frontend,
current resolved SDK identity, cache-file inventories before/after, complete logs,
controller and the retained binary inside the archive. [The saved checker](check.py)
checks complete archived bytes and exact correspondence to the original frozen
probe/common flags; its negative control rejects an executable-invocation claim.
It opens neither media nor the executable.
The saved `termination.json` is an owned-PID absence check: its `ps` exit of one
means those processes were absent. Actual compiler and controller exits are zero.

This result qualifies compile readiness only. It is consistent with avoidable
import/cache preparation cost but does not establish why the earlier compile
timed out, nor historical equivalence of every SDK byte. The root task owns any
later separate authorization of the original unstarted physical cases; this
compile-only controller cannot dispatch them. No source repair, alternative cache
retry, writer change or production adoption occurred.

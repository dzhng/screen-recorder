# Blind scene-inspection skill use

The product skill separates measured video scenes from capture observations.
Source scene inspection needs no fabricated acquisition or capture timestamps.
Whole-project inspection must use the revision's extent rather than source
length, so repeated and retimed occurrences are not silently omitted.

Two independent fresh `gpt-6-luna` agents used only the product skill, supplied
identifiers, the actual frozen CLI's help and delivered results. Neither received
implementation, expected timings, the fixture's authored plan or prior agent
context. The same task wording is retained in `prompt.txt`.

The first run correctly recovered canceled source preparation and qualified absent
capture metadata and unsupported cut evidence, but queried only the source-length
prefix of the project. Its report missed the second occurrence. The skill now says
to omit the whole-project range or derive it from the inspected revision; a partial
query does not prove complete occurrence or gap coverage.

The second fresh run found every source change and both projected occurrences,
distinguished the source gap, mapped project gaps and unoccupied placement gap,
explicitly retried the canceled scene prerequisite, and preserved unknown capture
and cut categories. Its exact values match the independently authored movie and
placement plan from the [public scene journey](../10d-public-scenes/README.md).
The original answer is retained; the grade notes one loose phrase about mapped
gaps without rewriting the agent's text. The project head remained unchanged.

Both fixtures used isolated homes and the same frozen runtime. Setup used public
asset/project operations and canceled a real scene job before inspection. No
capture, playback, installed app or model preparation occurred. Both fixture
processes exited cleanly and their scratch homes were removed. Receipts, command
logs, runtime hashes, grades, help-description excerpt and the failed skill version
retain the acceptance boundary. These numeric inspection results do not establish
visual scene-detector quality or screenshot-index acceptance.

Review preserved existing audio, picture and capture rules, removed the blanket
acquisition requirement from timeline inspection, and kept help as the API owner.
The skill validator could not import PyYAML; manual metadata, trigger, stale-rule
and whitespace checks passed. No production API or editorial default changed.

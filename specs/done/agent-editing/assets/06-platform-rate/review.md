# Independent encoding audit

Read-only review verified all 12 platform-rate file hashes, 81 neighboring
Rec.709 output hashes, three code hashes and ten input hashes. The platform
probe differs by removing the explicit average bitrate setting; production
likewise leaves that setting unset. No production setting changed.

The two single-frame movies decode to identical RGB pixels and both occupy
90,183 bytes. Their actual encoded rate is about 14.29Mbps: matching the requested
40Mbps experiment does not mean the platform selected 40Mbps. The recomputed
native comparison has maximum channel error 60, fraction over four levels
0.0032433077, and 25/25 fixed patches within four. Whole-frame preservation still
fails the four-level diagnostic.

The three-second output independently decodes to 60 frames at 50ms intervals,
ending at 2.95 seconds, with explicit Rec.709 tags. Its actual rate is about
1.47Mbps. This proves frame count and timing, not membership in the intended
source sequence. The three frozen color tests pass.

Before adoption, verify multi-frame source membership and quality, including
motion, text, gaps, holds and nonzero previews, then perform independent visual
and production-path preservation checks. There is no matched three-second
40Mbps output in this evidence. Freeze this experiment's own dependency/input
hashes and runtime versions rather than relying on neighboring provenance.
The retained peak memory observations grow from 154MB to 283MB; neither bounded
buffers nor the single elapsed-time observation establishes long-project scale.

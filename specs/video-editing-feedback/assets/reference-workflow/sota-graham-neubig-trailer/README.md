# SOTA × Graham Neubig: episode trailers

~1 minute trailers for Lily Zhang's podcast **SOTA** (co-host Madison Kanna) from the interview with
**Graham Neubig** (Associate Professor, CMU LTI; Co-founder & Chief Scientist, OpenHands), recorded
2026-10-02 on Riverside. Six versions, each fully reproducible from the raw recordings.

## Raw recordings (not in git)

Put these in one folder (default `~/Downloads`). Asset ID = SHA-256 = the `id` in [`assets.json`](assets.json).

| Role | File | SHA-256 | Notes |
|---|---|---|---|
| Final edit (all speakers) | `20261005_graham-neubig_full-interview_final_1080p.mp4` | `2732b484…f835b16df` | 32:56, 1080p24, AAC stereo. Screen shares + speaker views |
| Graham raw cam/mic | `fullvideo_graham_p1.mp4` | `992bb6f6…b623968210` | session 1, 2360 s |
| Madison raw cam/mic | `riverside_madison_raw-video-cfr_madison_kanna's stu_0035.mp4` | `d05a5af3…e37af80fa` | session 1, 2360 s, noise-gated |
| Lily raw, part 1 | `fullvideo_lily_p1.mp4` | `58875772…f425b3` | session 1 (not used yet) |
| Lily raw, part 2 | `fullvideo_lily_p2.mp4` | `7b03b1ca…23b675c0` | session 2: open-weights Q + unaired benchmarks segment |

Graham/Madison/Lily p1 look like one Riverside session (identical 2360 s length). Graham's takes were mapped from
the final edit to his raw by 1 ms audio cross-correlation; Madison's/Lily's lines were found by transcribing their raws.
The "18 months" line comes from session 2, where only Lily's raw exists, so it uses the final edit.

## Versions

| # | Version | Look | Notes |
|---|---|---|---|
| [01](versions/01-original/README.md) | original | 7 spicy takes, hard cuts, no music | the first cut; user: "good" |
| [02](versions/02-dwarkesh/README.md) | dwarkesh | Dwarkesh Podcast-style cold open + music bed | |
| [03](versions/03-a16z/README.md) | a16z | narrated montage over AI B-roll, gold logo | |
| [04](versions/04-hollywood/README.md) | hollywood | production-value cut, co-host raw cams, name titles | |
| [05](versions/05-spicy/README.md) | spicy | TikTok: word-pop captions, stat slams, emojis | |
| [06](versions/06-balanced/README.md) | balanced | for X: clean captions, real tweet card, 2 emojis | latest |

Rebuild any version: `python3 ../scripts/reproduce.py versions/<NN-name>` (see the repo [README](../README.md)).

## Standing decisions (from the user's feedback; apply to new versions)

- **Content:** the spicy takes carry it. Don't use Lily's "Welcome to SOTA TV" mid-cut. Include each co-host at
  least once. Use the co-host brief ([sources/brief-agent-clip-sources.md](sources/brief-agent-clip-sources.md)):
  the centre is "which agent will be around in 5 years?"; Madison's Instinct/privacy line is hers; caption
  spellings OpenClaw, Claude Cowork, dots, Instinct, OpenHands.
- **Picture:** never letterbox or crop away content. Centre faces (Vision-measured). Grade so faces are well lit
  and white walls are neutral, never yellow, with no added clipping. Verify with `scripts/qa-video.sh` on the
  export, decoded via AVFoundation.
- **Sound:** match dialogue loudness per clip (−20 LUFS before the chain), master −14.5 LUFS / −1 dBTP. Music
  should be upbeat, not classical or sad; the reference is the user's jevgrep launch video (120 bpm electronic).
- **Effects:** reactions are welcome, but restraint wins for X: at most 1–2 emojis; prefer real tweets and
  quote/stat graphics.

## Folders

- `sources/`: the co-host brief and the reference transcript (speaker-labelled, from another tool).
- `transcripts/`: Parakeet word-level transcripts (`*.rows.json` exact, `*.txt` reading view). Final-edit
  chunks are named by start second; `graham-raw-p1`, `madison-raw-s1800`, `lily-raw-s0` cover the raw cams.
  Full-file transcription fails on this audio (screenrec bug, see `../FEEDBACK.md`), hence the chunks.
- `assets/`: generated overlay PNGs (vignette, shades, letterbox), made with `screenrec ffmpeg` geq filters.
- `references.md`: what we learned from the Dwarkesh, a16z and jevgrep references.
- `versions/_lab/`: grade sweeps and shared imports (evidence only, not needed to rebuild).

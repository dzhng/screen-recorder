# 06 · Balanced (for posting on X): latest

61.8 s · between 04 and 05 · clean captions · Graham's real tweet · quote and stat cards · two emojis ·
effects only on the big beats. Delivered as `balanced-v2`.

## Rebuild
```sh
python3 scripts/reproduce.py sota-graham-neubig-trailer/versions/06-balanced
```
Uses the same promo music file as 05 (identical hash). SFX at `SFX_SCALE=0.6`. Tweet data is committed
(`notes/tweet-2088311695206654407.json`, fetched from `api.fxtwitter.com`; avatars in `assets/`).

## Decisions, in order
1. **Brief:** "v1 is good, v2 (spicy) is too TikTok with too many emojis. Something balanced for Twitter,
   with reactions and special effects, just less. One or two emojis, not all of them; use screenshots of his
   original tweets and quote graphics instead."
2. **Captions:** curated phrase cues (≤ ~6 words), sentence case, Avenir Next DemiBold 54 on a translucent
   dark pill (needed over white screen shares), fade/rise in, active word softly tinted gold. No bounce.
3. **Emojis:** only 📉 ("OpenClaw is already on a downward trend") and 🔒 ("privacy"), 210 px.
4. **Tweet card** (right of the centred speaker, from "six months" to the end of the take): Graham's real
   Aug 14, 2026 post "Third strong ~30B model coming out this week, amazing to see after having a bit of a
   drought.", quoting Qwen's open-weights release. Drawn like an X post (avatar, handle, date, counts). It
   backs up his "closed in six months for 18 months now. So it just hasn't happened."
5. **Stat cards** (left): "160 papers written by AI agents" → (at "nine") red "9 had no obvious mistake".
   **Quote card** (left): "Human-AI teams are going to be better than just AI itself for a very long time."
   (Georgia; private system fonts like New York silently fall back to Times in CoreText).
6. **Transitions:** crash zooms into Graham's first on-camera line and the open-weights take; flashes only
   for the music slam (after "nine of them…") and the title; clean cuts elsewhere. Softer SFX plus a
   swish/pop per card.
7. **Sound:** music 0.28 under / 0.9 card (~1 dB lower than 05); master ×1.841 → −14.5 LUFS.
8. **QA:** faces centred, faces 123–136 luma, walls neutral (Graham −3, Lily 0 blue−red), no black edges.
   The 5–12 % "clipped" readings on the tweet/160 takes are the white cards themselves.

# State-driven score and voice priority

The game now has day exploration, pre-blackout, blackout, visible nearby threat, actual visible chase, post-chase release and extraction score states. Preparation/results remain quiet. The warning uses the authoritative last 30 seconds of a day; extraction uses the server's extraction-open flag. No protected phase duration or resource budget changes.

A stationary visible monster produces proximity tension. Chase needs a nearby visible monster closing at speed/facing the listener, or recent pressure while that threat is visible. Losing visibility stops tracked chase immediately and leaves only a bounded release; hidden sound events cannot invent a tracked body. Self/spectated monster and dead/human bodies are excluded. These states use only the recipient's already-authorised snapshot.

The existing credited dread recording supplies a restrained continuous score layer, with gradual gain/rate transitions. Wind/biome/generator sounds remain environmental; source cues keep their 3D positions. The Music slider now controls both lobby music and the separate in-game score bus. Lobby songs still pause during play; Next Track applies to the lobby. Reset fades loops before disconnecting. Occlusion uses the same three-dimensional geometry queries as sight/camera instead of a separate two-dimensional wall approximation.

Actual transmitted/received non-muted speech activity lowers score gain to 28% and environment to 65%, with smooth release. Critical audible footsteps/attacks lower score too. A post-compressor soft limiter bounds overload peaks; it is not a loudness certification or a replacement for human headphone/speaker review.

## Executed evidence

55 server/asset cases pass, including four deterministic director cases. `npm run test:audio` uses actual Chromium/Web Audio: all seven score states, voice-driven score gain .105 versus .338 after release, six aligned full-scale synthetic voice sources with observed peak .917 and nonzero RMS, and an Opus encode/decode probe. See `audio/browser-evidence.json`. Two actual game clients hidden by a Foundry partition still exchanged simulated-microphone PCM with an HRTF emitter, RMS .083, no hidden body coordinates and no runtime/request errors (`audio/occluded-voice-evidence.json`). No real speech recording is stored. A repeated overload check found a >1.0 transient in the initial oversampled limiter; the final sample-bound curve runs without the resampling stage and the rerun stayed below full-scale. This is sample-peak evidence, not a true-peak/LUFS certification.

The browser audio check is in CI; remote success must be observed. Effects/source licensing remains in the existing credits and ASSET_LICENSES.md. No new stock audio or runtime dependency was added.

## Limits and rollback

Six real microphones, loss/jitter, blind localisation, physical low-end devices and subjective chase/voice mix remain open. PCM transport is still the existing prototype; see ADR 0002 for the measured migration evaluation. Procedural score built from existing samples is not a claim of a commissioned soundtrack. Revert this commit's director, bus routing, voice activity and labels together. No production deployment or main merge.

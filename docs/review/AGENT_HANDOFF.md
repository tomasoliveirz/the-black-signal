# The Black Signal — v0.5 handoff

This review describes the implemented 2026-11-14 build. Distinguish observed behavior, automated tests and remaining product work. Read RULES.md and layouts.json before changing rules or placing objects. The review does not assert that six-human balance is proven.

## Public entry points

- Game: https://tomasoliveira.xyz/black-signal/
- Visual review: https://tomasoliveira.xyz/black-signal/review/
- Deployment evidence: DEPLOYMENT.json next to this file.
- UI languages: English (initial default), Portuguese (pt-PT). Stored in bs.language; changing languages must not reconnect or reveal a secret role.

## Source ownership

- shared/rules.js: canonical durations and numeric rules.
- shared/layout.js: map definitions, deterministic resource placement, six spawn points, extract circle, captured map context per room.
- shared/sim.js and shared/sight.js: movement/collision and visibility/hit tests.
- shared/maps/mall.js: imported indoor geometry and side branches. Preserve unless deliberately redesigning it.
- server/game.mjs: authoritative phase machine, snapshots, outcomes, telemetry, interactions dispatch.
- server/combat.mjs: damage, attack validation, firing, transformation, downed state.
- server/interactions.mjs: explicit target validation, pickups, repair, blood, revive, execution.
- server/bots.mjs: bots under authoritative action guards. Do not read hidden roles of other players.
- server/rooms.mjs: public/private rooms, host transfer, grace window and resume identity.
- server/auth.mjs: parameterised SQLite statements, scrypt password hashes, hashed session tokens, cookies and same-origin mutation checks.
- server/server.mjs: HTTP routing, base path, static allowlist, WebSocket admission, per-IP and message budgets, proximity voice recipients.
- src/i18n.js: English keys, Portuguese translations, persistent selector, DOM translation and language-change event. User text and stable room codes stay verbatim.
- src/menu.js: map cards, seats, guide with six tabs, selection/room state.
- src/account.js, src/rooms.js: identity and room controls.
- src/game.js: input, prediction, aim target, HUD and events.
- src/world.js, src/environment.js, src/paint.js: visuals and world objects.
- src/ambience.js, src/lobby-audio.js: spatial effects, environment, shuffled waiting-room music and UI cues.
- src/voice.js and src/mic-worklet.js: opt-in push-to-talk, mono PCM capture and spatial receive.

## Commands and runtime

Requires Node 24+ (node:sqlite). npm ci; npm start. npm test runs rules and the 48-match bot soak; npm run test:network runs isolated real HTTP/WebSocket tests. The production app uses BASE_PATH=/black-signal, TRUST_PROXY=1, DATA_DIR outside the image. Nginx must preserve /black-signal in proxy_pass, overwrite forwarded identity headers, forward WebSocket Upgrade and allow the microphone on the same origin.

Deployment must follow the owner's live VPS operations inventory and preflight/smoke scripts. Do not infer their paths from an older checkout, expose credentials or database data, reuse another application's ports or change unrelated services. Capture the baseline and preserve a named rollback before any production edit. Runtime is isolated Docker Compose, non-root, loopback ingress and persistent data outside the image. Read DEPLOYMENT.json for verification status; do not claim global VPS preflight is green if pre-existing failures remain.

## Gameplay invariants

- Six active seats; four Operatives and two server-randomised Echoes. Spectators do not receive hidden private state.
- 20 s prep, then day1 300 s, night1 60 s, day2 210 s, night2 70 s, day3 180 s, final 140 s. Repair never accelerates the clock.
- First-day combat forbidden by the server. There is no mid-match respawn.
- Each map: 3 transmitters, 18 pickups (6 cells, 6 ammo, 3 med, 3 flare), 12 blood sources.
- Sector unlock controls resources/interactions, not physical doors.
- Manual E target and reach/LOS required; one cell maximum; dropped cells remain recoverable.
- No role/health/energy of another living player in the public snapshot. No dead-to-living chat or live voice.
- Voice range 22 m, same room, living/downed only; crouched human footsteps silent.
- Final extraction requires 3 active transmitters, 45 s warm-up, 5 s living Operative inside. Escape takes priority on the timeout tick.

## Still requires product decisions or validation

No six-human balance approval, mobile touch controls, crafting/barricades, account recovery, moderation, email verification, 2FA or independent penetration test. The factory and several other maps strongly favour Echo bots. Do not present bot win ratios as human balance evidence. Imported mall is still narrow. In-memory reconnect is not persistent across a page reload. PCM voice over TCP is functional but uncompressed and not end-to-end encrypted. Private room codes are shareable admission secrets, not passwords. Supplied lobby music has user-provided provenance; do not invent a licence grant.

For redesign: use the screenshot filename and map ID to identify the exact surface; reproduce the current route before editing. Keep rules in shared/rules.js, preserve deterministic placements or deliberately revalidate every map, and run relevant acceptance and network tests after authoritative changes.

# Recipient-specific visibility policy — local draft

BS-NET-01 / #42. This is a regression-backed hardening change, not independent anti-cheat certification.

## Public state

Living/downed players receive their own state and other bodies whose head/torso/side samples have an unoccluded server ray, bounded by the map's fog distance. The camera origin is accepted only within the character's camera radius and along a clear head-to-camera path. The policy permits looking around freely; it does not treat turning the camera as a secret-state boundary. Occluded bodies disappear from the next snapshot with no ongoing hidden tracking. Spectators receive one server-authorised followed viewpoint rather than global positions.

Dropped cells, resource availability and blood clues are recipient-specific. Static geometry LOS cache entries are bounded and invalidated by any viewpoint change; moving characters are never cached as visible after occlusion. Full closest-hit ray queries remain unchanged; visibility-only queries may stop at the first confirmed blocker.

## Event/audio side channels

Hidden shots, claws, transformations and reverts do not broadcast exact endpoints or actor identity. Nearby audible events and occluded footsteps provide deliberate coarse hearing cues on a four-unit x/z grid. Hidden speech retains its speaker identity, because named proximity voice is a game feature, but its spatial emitter is similarly coarse and updated only while talking. The existing PCM voice packet stays unchanged; an ordered JSON emitter cue precedes it. No precise hidden body position is needed for voice playback behind a wall.

Coarse hearing is still information. This policy does not claim players cannot infer an approximate location from legitimate sound, or prevent external spectator collusion. Six-person usability and blind audio-localisation acceptance remain open.

## Executed evidence

Eight isolated regression cases cover hidden/visible bodies, reveal/occlusion, forged cameras, shot/transformation identity, coarse steps, spectator viewpoint, hidden dropped cells and cache invalidation. These cases failed on the baseline before the fix. Existing 18 rule and 12 real HTTP/WebSocket tests pass.

A real Chrome test uses two clients on opposite sides of a Foundry partition. Neither receives the other's body position; a simulated microphone still sends PCM, the receiver produces a nonzero decoded signal and constructs an HRTF emitter. No runtime/request errors were recorded. It is explicitly a simulated microphone on localhost, not a real Internet voice trial.

Snapshot construction plus JSON was measured for six moving synthetic recipients, 300 measured samples per map after warm-up. See visibility-benchmark.json for hardware and p50/p95/p99. This is CPU packaging evidence, not six humans, network latency or browser frame-time proof. A separate 1,800.2-second six-client local transport soak completed with zero errors/disconnections: final RTT p50 .163 ms, p95 2.267 ms, p99 4.376 ms. See `soaks/visibility-network-30min.json`. It used six synthetic WebSocket participants and generated PCM tones on the named Ryzen host, not humans or Internet impairment. Aggregate receiver traffic was 1.917 GB (8.52 Mbit/s), with 381 MB uploaded (1.69 Mbit/s); these rates include snapshots/events and PCM fan-out. The first attempt ended with SIGTERM at roughly 26 minutes and is not counted as a pass. The completed run used an independent user service.

## Rollback and remaining risk

Revert this entire visibility protocol commit together (server, snapshot consumers and emitter cues). No production or DNS changes. Render/collision approximation, boundary pop-in, active-room admission budgets, real jitter/loss, refresh recovery and independent adversarial review remain gates. Do not remove the documented residual limitations merely because unit tests are green.

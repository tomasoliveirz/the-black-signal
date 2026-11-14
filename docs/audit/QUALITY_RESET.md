# Quality reset — audit and implementation index

Baseline: `d609747177b7fc3093038effca5f9c1c92ceec5f`, build 0.5.0. Owner instructions: BLACK_SIGNAL_PROMPT_AGENTE_REFACTOR.md and BLACK_SIGNAL_AUDITORIA_ISSUES_v0.5.md, downloaded 2026-11-14. All 48 supplied IDs are tracked below. The audit's Epic D heading says 12 but contains 13 entries; the actual total is 48. No duplicates existed before creation.

## Executed baseline

- Node 24, clean npm install; 18 rules and 12 network cases pass.
- The full 48-game six-bot soak executed; bots are robustness evidence, not six-human balance evidence.
- Fresh deterministic screenshots captured all six maps at six fixed day/night poses, 1024×576, FOV 72, Normal/Ultra. Timings/counts are in render-baseline.json; these capped Chrome captures do not prove high-refresh or long-session performance.
- Forty glTF/GLB models inspected: two have textures; 33 contain UV geometry. Both textured models are the Knocker variants.
- Mall has actual CEIL_mall and CEIL_service mesh nodes. world.js excludes CEIL_ nodes. This confirms a real excluded ceiling, not only a guessed screenshot issue.
- No production runtime, VPS configuration, DNS or database was modified for this reset.

## Confirmed source defects/patterns

Material conversion drops source maps and static batching drops UV/colour/tangent attributes. Cache keys can collapse different source materials sharing a name/colour. The mall ceiling filter is real. Generic red/orange emergency fixtures are used at normal storefronts and wooden signs; transmitter indicators float above thin poles. Foundry roof members lack a continuous enclosure in the current authored environment. Nav neighbours lack lateral checks in navStep. All live player positions are included in public snapshots. Reconnect tokens are only held in memory. PCM voice and waiting-only music are implemented as the audit describes.

## Unverified or acceptance-dependent claims

Human navigation/enjoyment/balance, blind audio localisation, all mesh/collision mismatches, independent security assurance, scale errors for every individual asset, thirty-to-sixty-minute hardware soak, real six-microphone jitter/loss and the preferred finished art direction remain open. A source pattern alone does not close these acceptance criteria.

## Dependency order and reference-slice plan

1. Preserve reproducible baseline; build red-capable material/nav/visibility fixtures; asset rights and architectural decisions.
2. Preserve material data and compatible batches; fix bounded navigation; restrict hidden-state transport with event/audio side-channel tests.
3. Foundry reference: fixture semantics, supported enclosure, motivated lighting, route graph and measured T3/extraction approach. Ashfall follows as the second reference.
4. Present exact-camera before/after and record owner visual approval before migrating the design to Mall/Amberwood/Hollow/Frost.
5. UI/readiness, animation, state-driven music, compressed voice evaluation, robust reload, moderation and security gates; then real human/hardware sessions.

Do not call the whole reset complete while any supplied acceptance criterion remains open. Issues are not automatically closed merely because a partial fix landed. All code PRs are drafts until reviewed; production is unchanged.

## Epics

- [art](https://github.com/tomasoliveirz/the-black-signal/issues/1)
- [level](https://github.com/tomasoliveirz/the-black-signal/issues/2)
- [game](https://github.com/tomasoliveirz/the-black-signal/issues/3)
- [online](https://github.com/tomasoliveirz/the-black-signal/issues/4)
- [process](https://github.com/tomasoliveirz/the-black-signal/issues/5)

## Issue links by priority

### P0 (15)

| Audit ID / issue | Scope | Dependencies | Evidence | Gate |
|---|---|---|---|---|
| [BS-ART-01](https://github.com/tomasoliveirz/the-black-signal/issues/6) | Approve the Stylized Awkward Horror art bible | BS-QA-01 | needs-evidence | 1 |
| [BS-ART-02](https://github.com/tomasoliveirz/the-black-signal/issues/7) | Preserve glTF textures and geometry attributes when batching | BS-QA-01 | confirmed-source-pattern | 1 |
| [BS-ART-03](https://github.com/tomasoliveirz/the-black-signal/issues/8) | Replace unexplained red lights with meaningful physical fixtures | BS-ART-01 | confirmed-source-pattern | 1 |
| [BS-ART-04](https://github.com/tomasoliveirz/the-black-signal/issues/9) | Retire the player-facing painterly renderer through a staged ADR | BS-ART-02, BS-ART-01 | confirmed-source-pattern | 1 |
| [BS-LEVEL-01](https://github.com/tomasoliveirz/the-black-signal/issues/16) | Give each map a distinct authored route graph | BS-PROCESS-01, BS-GAME-01 | confirmed-source-pattern | 3 |
| [BS-LEVEL-02](https://github.com/tomasoliveirz/the-black-signal/issues/17) | Separate the third objective from the extraction approach | BS-LEVEL-01, BS-GAME-01 | confirmed-source-pattern | 3 |
| [BS-LEVEL-03](https://github.com/tomasoliveirz/the-black-signal/issues/18) | Make future-sector state coherent in the world | BS-LEVEL-01, BS-UX-02 | confirmed-source-pattern | 2 |
| [BS-LEVEL-04](https://github.com/tomasoliveirz/the-black-signal/issues/19) | Build a structurally coherent Foundry reference level | BS-ART-02, BS-ART-03, BS-GAME-01 | confirmed-source-pattern | 1 |
| [BS-LEVEL-05](https://github.com/tomasoliveirz/the-black-signal/issues/20) | Restore and validate Marrow Mall enclosure and routes | BS-ART-02, BS-GAME-01, BS-LEVEL-04 | confirmed-source-pattern | 2 |
| [BS-GAME-01](https://github.com/tomasoliveirz/the-black-signal/issues/28) | Fix navigation boundary wrap and diagonal corner cutting | BS-QA-01 | confirmed-source-pattern | 4 |
| [BS-GAME-02](https://github.com/tomasoliveirz/the-black-signal/issues/29) | Run and record six-human balance sessions | BS-LEVEL-04, BS-LEVEL-06 | needs-evidence | 5 |
| [BS-NET-01](https://github.com/tomasoliveirz/the-black-signal/issues/42) | Restrict hidden player positions with server visibility management | BS-QA-01 | confirmed-source-pattern | 5 |
| [BS-SEC-01](https://github.com/tomasoliveirz/the-black-signal/issues/44) | Define and implement public-beta account safety and moderation | BS-SEC-02 | needs-evidence | 5 |
| [BS-QA-01](https://github.com/tomasoliveirz/the-black-signal/issues/46) | Capture reproducible visual and runtime baselines | — | needs-evidence | 0 |
| [BS-PROCESS-01](https://github.com/tomasoliveirz/the-black-signal/issues/49) | Separate authored scene definitions from rendering and collision | BS-QA-01 | needs-evidence | 0 |

### P1 (27)

| Audit ID / issue | Scope | Dependencies | Evidence | Gate |
|---|---|---|---|---|
| [BS-ART-05](https://github.com/tomasoliveirz/the-black-signal/issues/10) | Calibrate colour management and exposure | BS-ART-02 | needs-evidence | 1 |
| [BS-ART-06](https://github.com/tomasoliveirz/the-black-signal/issues/11) | Author readable ground materials for each biome | BS-ART-05 | needs-evidence | 1 |
| [BS-ART-07](https://github.com/tomasoliveirz/the-black-signal/issues/12) | Build motivated practical lighting with a bounded budget | BS-ART-03, BS-ART-05 | needs-evidence | 1 |
| [BS-ART-08](https://github.com/tomasoliveirz/the-black-signal/issues/13) | Validate asset scale, pivots, grounding and material consistency | BS-ART-02 | needs-evidence | 1 |
| [BS-ART-09](https://github.com/tomasoliveirz/the-black-signal/issues/14) | Fail visibly and test when required assets are missing | BS-ART-02 | confirmed-source-pattern | 1 |
| [BS-LEVEL-06](https://github.com/tomasoliveirz/the-black-signal/issues/21) | Turn Ashfall into a readable inhabited-scale neighbourhood | BS-LEVEL-04, BS-ART-01 | needs-evidence | 1 |
| [BS-LEVEL-07](https://github.com/tomasoliveirz/the-black-signal/issues/22) | Compose Amberwood vegetation and landmarks intentionally | BS-LEVEL-06 | needs-evidence | 3 |
| [BS-LEVEL-08](https://github.com/tomasoliveirz/the-black-signal/issues/23) | Keep Hollow Mire frightening and navigable | BS-LEVEL-06 | needs-evidence | 3 |
| [BS-LEVEL-09](https://github.com/tomasoliveirz/the-black-signal/issues/24) | Make Frostpeak snow, terrain and threats readable | BS-LEVEL-06 | needs-evidence | 3 |
| [BS-LEVEL-10](https://github.com/tomasoliveirz/the-black-signal/issues/25) | Place supplies by authored purpose and POI | BS-LEVEL-01, BS-ART-08 | needs-evidence | 3 |
| [BS-LEVEL-11](https://github.com/tomasoliveirz/the-black-signal/issues/26) | Align visual geometry, movement collision and line of sight | BS-GAME-01, BS-ART-08 | needs-evidence | 3 |
| [BS-GAME-03](https://github.com/tomasoliveirz/the-black-signal/issues/30) | Make the five-minute first day socially active | BS-GAME-02 | needs-evidence | 4 |
| [BS-GAME-04](https://github.com/tomasoliveirz/the-black-signal/issues/31) | Align third-person camera aiming and authoritative hits | BS-LEVEL-11 | needs-evidence | 4 |
| [BS-GAME-05](https://github.com/tomasoliveirz/the-black-signal/issues/32) | Improve human and monster animation transitions | BS-GAME-04 | needs-evidence | 4 |
| [BS-GAME-06](https://github.com/tomasoliveirz/the-black-signal/issues/33) | Explain interaction and danger states from authoritative data | BS-UX-02, BS-UX-03 | needs-evidence | 4 |
| [BS-GAME-07](https://github.com/tomasoliveirz/the-black-signal/issues/34) | Make social bots plausible without hidden information | BS-GAME-01, BS-NET-01 | needs-evidence | 4 |
| [BS-UX-01](https://github.com/tomasoliveirz/the-black-signal/issues/36) | Separate Home, Play, Room, Guide and Settings flows | BS-UX-02 | needs-evidence | 4 |
| [BS-UX-02](https://github.com/tomasoliveirz/the-black-signal/issues/37) | Synchronise guide, tooltips and bilingual rules | BS-QA-01 | needs-evidence | 4 |
| [BS-UX-03](https://github.com/tomasoliveirz/the-black-signal/issues/38) | Make pickups recognisable by silhouette | BS-ART-01, BS-ART-08 | needs-evidence | 4 |
| [BS-AUDIO-01](https://github.com/tomasoliveirz/the-black-signal/issues/39) | Build a state-driven musical director | BS-ART-01 | confirmed-source-pattern | 4 |
| [BS-AUDIO-02](https://github.com/tomasoliveirz/the-black-signal/issues/40) | Evaluate and migrate to compressed realtime voice transport | BS-SEC-02 | confirmed-source-pattern | 5 |
| [BS-NET-02](https://github.com/tomasoliveirz/the-black-signal/issues/43) | Resume sessions safely across page reload | BS-SEC-02 | confirmed-source-pattern | 5 |
| [BS-SEC-02](https://github.com/tomasoliveirz/the-black-signal/issues/45) | Audit browser/API boundaries and dependency security | BS-QA-01 | needs-evidence | 5 |
| [BS-QA-02](https://github.com/tomasoliveirz/the-black-signal/issues/47) | Measure frame-time tails, memory and long-session networking | BS-QA-01 | needs-evidence | 5 |
| [BS-PROCESS-02](https://github.com/tomasoliveirz/the-black-signal/issues/50) | Validate asset manifests and scene invariants in CI | BS-ART-09, BS-LEVEL-11 | needs-evidence | 0 |
| [BS-PROCESS-03](https://github.com/tomasoliveirz/the-black-signal/issues/51) | Require a measurable definition of done for every map | BS-ART-01, BS-QA-01 | needs-evidence | 0 |
| [BS-PROCESS-04](https://github.com/tomasoliveirz/the-black-signal/issues/52) | Keep code changes reviewable and independently reversible | — | needs-evidence | 0 |

### P2 (6)

| Audit ID / issue | Scope | Dependencies | Evidence | Gate |
|---|---|---|---|---|
| [BS-ART-10](https://github.com/tomasoliveirz/the-black-signal/issues/15) | Define bilingual world signage and distance readability | BS-ART-01 | needs-evidence | 1 |
| [BS-LEVEL-12](https://github.com/tomasoliveirz/the-black-signal/issues/27) | Validate six-player spawn spacing and wayfinding | BS-LEVEL-11 | needs-evidence | 3 |
| [BS-GAME-08](https://github.com/tomasoliveirz/the-black-signal/issues/35) | Define measurable chase and final-phase fairness scenarios | BS-GAME-04 | needs-evidence | 4 |
| [BS-AUDIO-03](https://github.com/tomasoliveirz/the-black-signal/issues/41) | Validate map-specific soundscapes and occlusion | BS-LEVEL-11 | needs-evidence | 4 |
| [BS-QA-03](https://github.com/tomasoliveirz/the-black-signal/issues/48) | Test encrypted off-site recovery and deployment boundaries | BS-SEC-02 | needs-evidence | 5 |
| [BS-PROCESS-05](https://github.com/tomasoliveirz/the-black-signal/issues/53) | Inventory asset rights and unresolved redistribution permissions | — | needs-evidence | 0 |

## External gates

Owner art approval, six human participants/session feedback, real microphone/network testing, authorised encrypted off-site destination, rights confirmation for unknown asset sources and independent security review. These require actual evidence or an owner decision; they cannot be supplied by labelling simulated results as real.

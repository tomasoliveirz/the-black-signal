# The Black Signal

A browser-based social survival game: six players, four Operatives, two hidden Echoes, three transmitters and a final evacuation. Built with Three.js and an authoritative Node.js WebSocket server.

**Current build: 0.5.** English is the initial interface language; European Portuguese can be selected in the menu and persists between visits. This is a review build, with unfinished human balance and account-recovery/moderation workflows.

## Run locally

Requires Node.js 24 or later.

```sh
npm ci
npm start
```

Open http://localhost:5173. Create a public or private room, choose a map and start. Bots fill empty active seats. The microphone requires an explicit permission click and push-to-talk with Z; HTTPS is required outside localhost.

```sh
npm test
npm run test:network
```

`npm test` runs the rules acceptance suite and 48 bot matches across all six maps. Network tests run isolated HTTP/WebSocket servers and temporary SQLite databases. They cover room separation, session behavior, origin rejection, private roles, reconnect, text and voice admission. Bot outcomes are not evidence of human balance.

## Play loop

Twenty seconds of preparation precede a fixed 16-minute clock. The first day lasts five full minutes without combat. Later days unlock additional sector resources. Repairing never accelerates the phase clock. Carry energy cells, power three transmitters, survive the nights and evacuate in the final hunt. Human death means spectating for the rest of the round; a downed player can still be revived.

- Six environments: Amberwood, Hollow Mire, Frostpeak, Ashfall, Foundry 9 and Marrow Mall.
- Explicit aimed interactions: pickups, repair, blood, revive and execution.
- Public/private rooms, host control, spectator admission and a 45-second reconnect grace period.
- Persistent usernames with scrypt password hashes and hashed session tokens in SQLite.
- Room/proximity/Echo text channels and opt-in 3D proximity voice.
- Recorded spatial sound effects, wall attenuation, silent crouched footsteps and shuffled lobby music.

Read [the detailed rules and visual review](docs/review/RULES.md), [the agent handoff](docs/review/AGENT_HANDOFF.md) and [actual map coordinates](docs/review/layouts.json). The HTML review is in `docs/review/index.html`; serve that directory over HTTP to use its language selector and map filters.

## Deployment

The Dockerfile pins a Node base-image digest. Production uses an isolated Compose bridge, a non-root read-only container, persistent `/data`, loopback ingress and HTTPS through Nginx. `BASE_PATH` supports installation under `/black-signal`; preserve that prefix in the proxy. Forward the real Host, overwrite forwarded identity headers, and forward WebSocket Upgrade. Set `TRUST_PROXY=1` only behind a trusted proxy that overwrites these headers.

Configuration: `HOST`, `PORT`, `DATA_DIR`, `BASE_PATH`, `TRUST_PROXY`. The local default binds to loopback. Do not publish SQLite files, cookies, account databases or deployment secrets. Read the owner's live VPS inventory before selecting a host port or changing an existing deployment. Public deployment verification and DNS limitations are recorded in `docs/review/DEPLOYMENT.json`.

## Scope and limitations

No crafting/barricade construction, mobile touch gameplay, password recovery, email verification, 2FA, account deletion or moderation tools are implemented. Sector unlocking currently gates resources and interactions rather than physical doors. The imported mall remains narrow. Several maps favour Echo bots; six-person playtesting is still required. Voice is uncompressed mono PCM over WebSocket, with encrypted transport when served over HTTPS, not end-to-end encryption. Resume tokens currently live in memory and do not survive a full page reload. Security controls do not guarantee the absence of exploits.

## Asset rights

Recorded sound-effect attribution and licences are listed in [assets/audio/CREDITS.md](assets/audio/CREDITS.md). Third-party assets keep their own licences. The owner supplied the three lobby tracks; no additional licence grant for those tracks is made by this repository. Custom game code and artwork retain their existing rights; public repository visibility does not by itself grant a redistribution licence.

## History provenance

At the owner's request, the commits dated **2–8 November 2026** are an explicitly **reconstructed history**, assembled on **14 November 2026** from the available baseline and visual-work snapshots. Their dates do not prove that development happened on those days. Current rules, multiplayer, audio and bilingual work are committed with their actual reconstruction-session date. Commit messages for reconstructed steps are marked `[reconstructed]`.

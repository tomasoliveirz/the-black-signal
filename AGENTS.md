# The Black Signal — agent working agreement

Read `README.md`, `docs/review/AGENT_HANDOFF.md` and `docs/review/DEPLOYMENT.json` first. The visual review distinguishes implemented features, executed checks and outstanding work. Do not describe six-human balance or complete anti-cheat protection as proven.

- Node 24+ is required for `node:sqlite`. Use `npm ci`; `npm start` serves the local game on loopback port 5173.
- `shared/rules.js` owns durations and numeric rules. `server/game.mjs`, `server/combat.mjs` and `server/interactions.mjs` own authoritative behavior. Never trust client role, damage, resources or completion claims.
- Keep the first day at 300 seconds and server-side combat disabled during it. Repairs do not accelerate phases. No mid-round respawn exists.
- `shared/layout.js` owns deterministic placements and per-room map contexts. Revalidate all six maps after geometry/resource changes. Imported mall branches and collision data are intentional, not freely replaceable proxies.
- `src/i18n.js` owns global EN/pt-PT copy; the guide also has authored bilingual content in `src/menu.js`. English is the initial default. Language changes must not reconnect the player or reset secret state. Do not translate user-authored names/chat.
- Run relevant checks for your changes. Rules/network acceptance: `node --test server/rules.test.mjs server/network.test.mjs`. Full bot soak: `npm test`. Verify UI/audio changes in a real WebGL browser. Clearly distinguish simulated microphones and bots from real-person validation.
- Keep secrets, accounts, session cookies, database files, raw logs and workstation configuration out of Git and static assets. Use parameterised SQL and preserve hashed password/session storage.
- Production exposes `/black-signal/` behind Nginx; keep the prefix and correct origin on HTTP and WebSocket requests. TRUST_PROXY is valid only with an ingress that overwrites forwarded identity headers.
- Before any deployment, read the owner's actual live VPS operations rules/inventory and run its preflight. Do not infer paths or port ownership from stale local documentation. Preserve an explicit rollback before edits, isolate the Docker bridge, bind ingress to loopback, retain non-root/read-only runtime and keep account data outside the image.
- Preserve unrelated ops working-tree changes and existing services. Record pre-existing global failures accurately; don't call the whole VPS healthy just because this app is healthy.
- The Nov 2–8 history was reconstructed on Nov 14 at the owner's request, as the README states. Never remove that disclosure or present those dates as proof of original development dates.

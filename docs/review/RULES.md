
# Walk through the game. Question every choice.

Visual review · build 0.5 · captured 14 November 2026. These are screenshots of the running game, with diagrams generated from its actual layout data.

Live on the temporary HTTPS address below. The tomasoliveira.xyz route is prepared on the VPS, but its public DNS currently points elsewhere.

Live visual review

 · GitHub repository

Play the current build

Read the agent handoff

Download map data

Review build, not a finished competitive release. Six-player human balance, broad device compatibility and sustained Internet voice quality still need real play sessions.

## Menu, rooms and selection

The left column holds identity, room admission, language and settings. The right column holds the six maps and, after joining, the roster, match controls and text chat. The purpose is to keep the scene visible while you prepare the session.

| Control | Actual behaviour |
| --- | --- |
| Create public room | Creates a new room that appears in the public list. You become its host. |
| Create private room | Creates an unlisted room with a random invitation code. The code grants admission; it is not an account password. |
| Public room / Refresh | Lists public rooms, player count, map and whether a match is running. Refresh fetches the current list. |
| Room code | A typed code takes precedence over the public-room selector when you press Join room. |
| Map cards | Preview before joining; the host sets the room map before play. Selection is locked during a running match. |
| Start match | The host starts immediately. Bots fill vacant active seats. There is currently no ready-check vote. |
| Leave room | Leaves the session. The host role transfers to another connected player if one exists. |

## How a match actually works

There are six active seats: four Operatives and two Echoes. Human players take free seats; bots fill the remaining places when the host starts. A joining player during a match spectates and can take a free active seat on the next round. Roles are shuffled on the server using cryptographic randomness, then sent privately. Echoes know their partner; Operatives do not know who the Echoes are.

Everyone starts at one of six predefined positions near the entrance. The slot determines the spawn, not the secret role. Spawns are grouped deliberately: the first day is for observing and preparing together, and combat is disabled throughout it.

| Match clock | Phase | What changes |
| --- | --- | --- |
| Before 00:00 · 20 s | Preparation | Role reveal; movement and actions frozen. |
| 00:00–05:00 | Day 1 · 300 s | Sector 1 resources. No shots or claws can cause damage. |
| 05:00–06:00 | Night 1 · 60 s | Combat unlocks and remains available after this night. First transformation opportunity. |
| 06:00–09:30 | Day 2 · 210 s | Sector 2 resources unlock; sector 1 remains usable. |
| 09:30–10:40 | Night 2 · 70 s | A new transformation allowance for each Echo. |
| 10:40–13:40 | Day 3 · 180 s | Sector 3 resources unlock. Finish the third transmitter. |
| 13:40–16:00 | Final hunt · 140 s | Extraction warms for 45 s. All three transmitters must be on. Hold the green area for 5 s. |
| After the result · 20 s | Results | The room returns to the lobby for another round. |

Repairing does not advance the phase clock. The first night cannot be triggered early by completing an objective. The 16-minute limit excludes the 20-second preparation. Winning can end the match earlier. There is no base-building, crafting economy or barricade construction in this build: the task is to carry energy cells and repair existing transmitters.

## Six maps, one shared ruleset

All maps use three transmitters, 18 supply pickups and 12 blood cabinets. Locations are fixed by the map seed, not randomly reshuffled every round. The diagrams below use real positions and collision footprints from this build. They are explanatory plans, not a promised in-game minimap.

Important: a sector opening currently enables its pickups and interactions. It does not close physical doors or prevent walking through a later sector. Empty field cases may therefore be visible before their contents unlock. This needs a clearer visual treatment.

### Amberwood

Warm autumn woods give the baseline map a readable trail and a strong cabin landmark. Trees and rocks break sightlines; open ground allows groups to meet and compare behaviour.

Cabin → Barn → Tower. The exit sits near the far radio mast. The visual tower is a landmark; the small portable generators are the repair objectives.

T = transmitter · C = energy cell · A = ammo · M = medical kit · F = flare · pink diamond = blood cabinet · white dots = six spawns · green circle = extraction. Muted shapes are collision footprints.

Download full-size plan

### Hollow Mire

A denser woodland with dead trees, cooler colours and heavier haze. It supports stealth by hiding movement behind vegetation, but the main trail is still the route spine.

South trail → Grove → Antenna. The density is a deliberate mood choice; reading supplies and spotting an approaching monster here need close review.

T = transmitter · C = energy cell · A = ammo · M = medical kit · F = flare · pink diamond = blood cabinet · white dots = six spawns · green circle = extraction. Muted shapes are collision footprints.

Download full-size plan

### Frostpeak

Snow and higher terrain create a pale map with dark silhouettes. Pines, snow banks and rocks give cover without relying on the warm forest palette.

Shelter → Ridge → Tower. Terrain affects movement and sightlines; the white ground can compete with bright interaction markers.

T = transmitter · C = energy cell · A = ammo · M = medical kit · F = flare · pink diamond = blood cabinet · white dots = six spawns · green circle = extraction. Muted shapes are collision footprints.

Download full-size plan

### Ashfall

An abandoned town organised around a street. Shop fronts, power lines, sidewalks and the fuel station replace anonymous boxes with recognisable destinations.

Laundry → 24H store → Warehouse. Buildings divide sightlines and offer side cover. Many facades are scenery and collision volumes, not fully explorable rooms.

T = transmitter · C = energy cell · A = ammo · M = medical kit · F = flare · pink diamond = blood cabinet · white dots = six spawns · green circle = extraction. Muted shapes are collision footprints.

Download full-size plan

### Foundry 9

A long industrial hall with overhead structure, loading areas, pipes and marked lanes. Warm practical lights separate the playable ground from the darker roof.

Reception → Furnaces → Maintenance. The original long axis remains. This layout performed poorly for Operative bots and needs human testing before calling it balanced.

T = transmitter · C = energy cell · A = ammo · M = medical kit · F = flare · pink diamond = blood cabinet · white dots = six spawns · green circle = extraction. Muted shapes are collision footprints.

Download full-size plan

### Marrow Mall

An imported indoor mall: existing storefronts, kiosks, pillars and service branches. New wayfinding and lighting were added without replacing its core architecture.

Atrium → Gallery → Service. Transmitters are placed in actual reachable branches rather than lined up down the main corridor. Its narrow width remains a design constraint; it has not been rebuilt into a larger map.

T = transmitter · C = energy cell · A = ammo · M = medical kit · F = flare · pink diamond = blood cabinet · white dots = six spawns · green circle = extraction. Muted shapes are collision footprints.

Download full-size plan

## What each object does

Aim at a nearby object. The E prompt names the selected action. Pressing E locks that target for the hold: looking away stops progress, and changing to another target requires releasing E. The server also checks distance, walls, state and inventory. Walking over a pickup does not automatically take it.

| Object | Count / purpose | Interaction and constraints |
| --- | --- | --- |
| Energy cell | 6 total · 2 per sector | Take with E within 1.9 m. Carry only one. R drops it; another player can take it. One cell powers one transmitter. |
| Transmitter | 3 total · 1 per sector | Install a carried cell with E, then hold E within 2.6 m to repair: 8 s alone or 5 s with at least two Operatives. Echoes can mimic repairing but add no progress. |
| Ammo cache | 6 total · 2 per sector | +3 rounds. Carry at most 12. Everyone begins with 4 rounds. Ammo is spent only on a valid authorised shot. |
| Medical kit | 3 total · 1 per sector | Take with E; Q restores up to 50 human HP. It cannot revive you after you are downed. |
| Flare | 3 pickups · everyone also starts with 1 | G throws ahead, after combat unlocks. Lasts 15 s; 6 m radius; initial monster stun 2 s with line of sight; nearby monsters move at half speed. |
| Blood cabinet | 12 total · 4 per sector | Echo only, daytime only. Hold E for 6 s for +30 energy, capped at 100. Each cabinet is globally single-use per round. Leaves a visible clue for 40 s. |
| Downed player | A rescue or execution target | Human form: hold E for 5 s to revive to 50 HP. Monster form: hold E for 2.5 s to execute. Damage, range and interrupted use matter. |
| Extraction circle | One exit, with a map-specific radius | Final hunt only, after 45 s warm-up and all transmitters active. A living Operative must stay inside for 5 s. The first escape immediately wins for all Operatives. |
| Mast, buildings, trees, props | Navigation, atmosphere and cover | The mast marks the exit area. Buildings and solid props block movement or sight where their collision data says so. Scenery cannot currently be dismantled or crafted into barricades. |

The extra energy cell in each sector is redundancy: one lost or carried-away cell should not automatically end the objective. Invalid cell drops are recovered to a sector recovery point. Resource cases and blood cabinets are solid, so they also affect movement.

## Pistols, Echoes, death and victory

The pistol is a server-validated hitscan weapon, aimed through the third-person camera and traced again from the character eye position. It is not a simulated flying projectile. Each valid shot consumes one round, has a 0.38-second cooldown and a maximum 60-unit range. It deals 30 human damage or 25 monster damage. Walls and player hit volumes stop the ray. There is no reload magazine, weapon pickup, headshot multiplier or ammunition regeneration in this build.

Friendly fire is enabled once combat opens. Four full pistol hits down a 100-HP human; six monster hits deplete its 150-HP shell. Depleting the shell forces the Echo back to human form, drains its energy, stuns it for 3 s and caps its human HP at 40. It does not itself permanently kill the Echo.

An Echo needs at least 50 energy to transform, spends 15 to enter monster form and then spends 0.9 per second while transformed. Passive daytime gain is 0.12 per second: five idle minutes provide only 36. A blood cabinet therefore matters before the first hunt. Transformation is allowed once per night. Pressing F to return early does not restore that allowance. The form ends when the night ends.

The claw deals 30 damage, has a 1.45-second cooldown and a 0.22-second wind-up. It needs a target within 2 m, in front of the monster and with line of sight. Four full claws down a healthy human. It may hit more than one valid nearby target in its forward arc.

At zero human HP you are downed for up to 40 s. You can crawl and a human-form player can revive you. Ordinary further bullets do not instantly finish a downed body. A monster can execute by holding E, or you die when the bleed timer expires. Revival restores 50 HP and grants 2 s of protection against monster damage; offensive actions are blocked during that protection. Death turns you into a spectator. There is no mid-round respawn.

Operatives win by extracting at least one Operative, or by permanently eliminating both Echoes after combat opens. Echoes win by eliminating all Operatives without an escape, or by reaching the final deadline with no extraction. A valid escape on the deadline tick takes priority over the timeout loss.

## Sound that communicates space

Recorded effects cover footsteps, gunshots, empty fire, pickups, healing, revival, flares, transformation, impacts, transmitter power and extraction. Footstep material changes with the map: soil, snow, hard floor or metal. Crouched human movement emits no footsteps. Other actions, nearby voices and ambient machinery remain audible while crouched.

World effects and voices use directional HRTF panning and distance attenuation. Walls filter and attenuate supported emitters. Indoor environments add restrained reverb. The listener follows the camera orientation and the player you control or spectate. These cues help you infer where activity is happening; headphones make them easier to assess.

Voice is opt-in. Enable the microphone in settings, then hold Z during play. The server forwards frames only to nearby living or downed people in the same room, within 22 m. Dead, escaped and spectator clients do not receive or transmit live proximity voice. You can disable listening or mute individual people in the roster. No microphone permission is requested on page load.

The three supplied lobby tracks are shuffled without an immediate repeat. Music continues through the menu and waiting room, fades when a match starts and resumes for the waiting state. You can skip tracks and adjust music independently from effects, ambience and voice. Browsers require an initial interaction before audio playback. Hover, focus and button clicks have quieter feedback sounds.

Current voice transport is 16 kHz mono PCM in 40 ms packets over the game WebSocket, not WebRTC. It has bounded receive buffering, per-sender rate limits and backpressure protection. It is functional but more bandwidth-hungry and vulnerable to TCP head-of-line delay than a dedicated compressed voice transport. Voice is not end-to-end encrypted: HTTPS/WSS encrypts transport, and the server relays the audio.

## Accounts, rooms and what the server owns

Accounts provide a persistent unique username and a seven-day session. Usernames accept 3–20 ASCII letters, numbers or underscores; passwords require 10–128 characters. Passwords are stored as salted scrypt hashes. Session tokens are random; only their hash is stored. Production cookies use HttpOnly, SameSite=Strict and Secure. SQLite statements are parameterised.

Guest names are prefixed with Guest to distinguish them from registered identities. A signed-in account overrides a supplied display name. Guests can play without an account. The current account flow has no password reset, email verification, two-factor authentication, account deletion or gameplay progression; these must not be assumed to exist.

Rooms isolate map state, timers, players, text and voice. The host controls starting and map selection. A broken connection retains a player for 45 s, with a random resume token bound to the same account identity. Reconnection can restore the same role and player ID. A full page reload currently loses the in-memory resume token.

Anti-cheat limitation: public snapshots currently include player positions without server-side line-of-sight culling. The server rejects invalid hits through walls, but a modified client could reveal positions. Visibility privacy is a remaining hardening task.

The server decides movement, damage, cooldowns, resources, phase deadlines, interactions and extraction. Clients send input and receive public state plus their own private fields. Other players’ secret roles, health and energy are excluded from live snapshots. Bots use server actions under the same guards; current automated tests cover hidden-role leakage.

Security controls include same-origin HTTP/WebSocket checks, limited payload sizes, connection and message limits, escaped or plain-text player content, prepared SQL, private database files and restricted static serving. These are concrete controls, not a promise that no exploit can exist. Independent security review and sustained adversarial testing remain outstanding.

## Where the design still needs your judgement

| Area | Current issue to review |
| --- | --- |
| Menu density | Identity, settings, map choice, roster and chat share one screen. Decide whether room creation should become a separate step. |
| Sector readability | Resources unlock by time, but the world is physically traversable. Locked and usable stations need a clearer distinction. |
| Object recognition | Supplies and blood cabinets use field cases. Their shape and silhouette should communicate type before reading E. |
| Building expectation | The game repairs existing equipment. If you want barricades or crafting, that is a new mechanic to design and implement. |
| Map balance | Automated bots favour Echoes on several maps, especially the factory. Bot results are not human balance evidence. |
| Mall width | Objectives use existing side branches, but the imported hall remains narrow. Decide whether it needs a structural rebuild. |
| Visual feedback | Review repair progress, cell installation, blood clues, downed readability and extraction status at player scale. |
| Touch play | The menu adapts to a narrow screen, but gameplay uses keyboard and mouse. There is no mobile touch-control scheme. |
| Language coverage | English is the default, Portuguese is selectable and persistent. Player names, player chat and music titles are not automatically translated. Imported baked artwork may retain its original branding. |

## Evidence and a precise handoff

Automated rules cover phase timing, safe first day, repair and blood interactions, combat guards, damage, revival, extraction and secret-state privacy. Network tests cover HTTP/session behaviour, foreign-origin rejection, room isolation, host restrictions, voice recipients, reconnect and logout. The current run passed 18 rule cases and 12 network cases.

The previous simulation soak ran 48 six-bot matches across the six maps. It found no recorded early first-day kills, stuck-match failures or secret-state leaks. It also exposed a strong Echo win bias on several maps. Screenshots are Chrome desktop captures; map visibility examples use free-roam camera positions, while menu, room and first-day images come from the running flow.

Pending: six-human match evaluation, long-distance voice under packet loss, broader browsers/devices, independent security review, account recovery and moderation tools. The deployment status and exact evidence are recorded in DEPLOYMENT.json alongside this page.

AGENT_HANDOFF.mdRULES.mdlayouts.jsonDEPLOYMENT.json


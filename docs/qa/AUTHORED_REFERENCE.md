# Authored Foundry and Ashfall — review proposal

Base: 72c40e7, draft integration #68. No owner visual/balance approval, no issue closed, no main merge and no production deployment. This is the route/progression pass after the initial enclosure/fixture reference #60, not a completed two-map vertical slice.

## Before and after

Previously both maps inherited the generic three-stop resource placement and a final objective roughly 4–5 m from extraction. Foundry's rear wall had no actual evacuation doorway. Ashfall's paving followed a curved generic trail rather than its buildings. Future-sector equipment remained unexplained.

`shared/maps/reference-layouts.js` now explicitly authors routes, landmarks, six-person spawn centre, three objectives, extraction, resource slots, signs and utilities for these two maps. It is shared authoritative data consumed by the existing generator and renderer. The other four map layouts stay unchanged pending reference approval. This is not the completed six-map scene/schema migration in PROCESS-01.

- Foundry: Receiving → Smelting controls → Maintenance → Loading apron. Main, east, west maintenance and rear cross routes; 4 m west and 10 m east rear door openings, with actual lintels and overhead collision. Radius 92 →100 m accommodates the loading apron. Final T3–exit straight distance 37.0135 m.
- Ashfall: Laundry corner → Motel service yard → Freight dispatch → Evacuation courtyard. Two block loops, main street and south loop, parked vehicles clear of tested centre lines, poles/mast clear of primary routes, grounded pavement/curbs and boarded, labelled CLOSED inaccessible doors. Final T3–exit straight distance 32.7567 m.
- Day-gated signs and interaction labels derive their day from the canonical phase table. A future transmitter says when power arrives; a future supply says when the case opens, without an actionable E prefix. The input stays disabled and server validation remains authoritative. Locked supply contents are not drawn; the static case remains. Small non-emissive case latches change only with public sector access.

Authored resource slots fail visibly when invalid rather than silently shifting up to 22 m. Reserved route/resource clearance prevents later random scatter occupying those spaces. Budgets remain 18 supplies, 12 blood sources and three recovery points; timings, roles, weapon damage, energy, movement and inventory rules are unchanged.

[Complete local HTML review with diagrams and 24 actual browser images](reference-routes/index.html). Plans are exported from the authoritative collision/placement data, not hand-drawn depictions of playtests. Matched pairs use seed 345126007, FOV 72, 1024×576 and exact baseline camera position/quaternion assertions. Both sides are sandbox renders; the baseline is the already-improved 72c40e7 build, not original main. HUD hidden in comparison pairs. The locked-object captures use the isolated authoritative day-1 teleport fixture named below.

| Fixed pose, day and night | Before draw calls | After draw calls |
|---|---:|---:|
| Foundry player | 177 | 171 |
| Foundry loading doorway | 64 | 67 |
| Foundry maintenance | 90 | 90 |
| Ashfall high street | 189 | 191 |
| Ashfall service yard | 123 | 139 |
| Ashfall evacuation courtyard | 157 | 171 |

These per-image counts show cost changes, not frame-time acceptance. New-layout 30-minute performance is not established. The immutable base's post-fix 30-minute performance result failed its p99 budget; the separate QA evidence PR preserves that result.

## Tests actually run

- `node --test server/*.test.mjs tools/asset-manifest.test.mjs`: **62 passed**, zero failed. Full output in `reference-routes/reference-all-tests.txt`.
- Four authored-layout cases: route centre lines sampled every .25 m using real human .42 m and monster .82 m collision radii; all supplies/spawns validated; real `navStep` plus collision traversal to each transmitter and evacuation; either Foundry rear doorway blocked in turn remains reachable; grounded pavement movement matches authored heights. No assertion that the entire advertised route width is clear at every edge.
- Navigation measurement starts 2 m beside T3 and stops 1 m inside the exit ring: Foundry 33.36 m, Ashfall 31.92 m. Dividing by 3.6 m/s gives 9.3/8.9 s of uninterrupted walking; excludes warm-up, pursuit, stops, interaction and network effects. Straight-line and simulated values have different endpoints.
- `TEST_ORIGIN=http://localhost:5221 node tools/world-contract.test.mjs`: all six actual WebGL worlds load, no exceptions/failed required requests, physical practical contracts pass. Ashfall's actual rendered mesh floor rays match authoritative street 0, sidewalk .08, curb .12 and verge 0 m within .01 m. The first added ray harness needed `ray.camera` for Three.js sprites; fixed the test harness, not game geometry.
- `node tools/reference-layout-browser.test.mjs`: actual Chromium clients, real WebSocket server snapshots, Day 1 near Day-2 transmitter/supply; EN/PT labels match, 7/9 sampled input packets respectively all keep use=false while E is held, and server action remains null. The teleport/phase setup exists only in a temporary child-process preload and separate database, never in shipped server paths. The initial fixture missed the server's Guest name prefix; corrected that harness before acceptance. The first remote CI run then exposed a test timing assumption: software WebGL produced fewer than four input packets in 350 ms. The test now waits for six actual packets with a bounded timeout, preserving the same interaction assertions rather than assuming a frame rate.
- `node tools/validate-assets.mjs`: 117 bundled files/41 models pass hashes/resources/textured-UV checks. Rights clearance remains separate.
- `node server/selftest.mjs 8 foundry` and `8 ashfall`: **16 complete six-bot games**, 204,094 ticks; zero private-field leaks, stuck matches or early blackouts. Foundry: Echoes 8/8, mean 431.2 s, 1.3 transmitters, first death 313.3 s; Ashfall: Echoes 8/8, mean 379.2 s, 1.1 transmitters, first death 309.8 s. Zero revives in both samples. Raw outputs retained. CPU costs 683.2/273.4 µs per tick occurred under different shared-host workloads; not a controlled speed comparison.

## Gameplay impact and known risks

Distinct objectives and extraction increase final travel and create route choices. The physical doorway, floor and public progression state now agree across movement, rays and rendering in the tested cases. Cameras in matched captures are fixed for comparison; ordinary play still uses collision-aware cameras.

Every bot game ended in an Echo victory. This is evidence of an unresolved AI/balance question, not proof that humans will lose at that rate or that geometry is the sole cause. Individual bot immobility >5 s, collision differences at model detail, door camping, human chase fairness, first-use comprehension, low-end performance, real mics/latency and full scene support/scale audits remain open. AABB/circle approximations do not establish visual mesh-perfect collision everywhere. Review all screenshots rather than inferring quality from the traversability tests.

Owner approval of the reference remains required before migrating the other four maps. Revert this authored-reference commit as a unit for rollback; it adds no database schema, runtime dependency, secret, production service or asset download. Local old and proposed builds remain separately available during review.

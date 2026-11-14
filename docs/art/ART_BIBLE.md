# Stylized Awkward Horror — proposed reference contract

Source of direction: the owner's 2026-11-14 quality-reset directive. Product direction is explicit; the visual reference still requires owner approval before migration to the other four maps. This document is a proposal and QA contract, not a claim of that approval.

## Character and environment language

Keep the supplied goofy, readable human silhouettes and the genuinely threatening monster. Low-poly means deliberate silhouettes and faceted construction, not missing textures, impossible structures or arbitrary clutter. A human is the scale reference: normal eye 1.45 units, body roughly 1.85, typical standing door around 2.1–2.3. Existing assets still need catalogue-based scale verification.

## Eight reference surfaces

| Surface | Reference colour | Roughness | Purpose |
|---|---|---:|---|
| Concrete | #77776e | .94 | load-bearing wall/floor/foundation |
| Steel | #3d5055 | .78 | structural members, housings, machine frame |
| Painted steel | #456665 | .72 | maintained industrial casing |
| Rust | #8b5540 | .86 | limited exposed corrosion at joins/edges |
| Plaster | #b6a78b | .96 | urban facades |
| Wood | #745644 | .90 | crates, rural signs and framing |
| Snow | #c2d2d7 | .95 | broad readable coverage, restrained variation |
| Glass | #354949 | .34 | deliberately authored glazing; no automatic neon |

These are measured implementation inputs, not a calibrated monitor/exposure certification. BS-ART-05 remains open. Imported glTF texture and material properties must survive conversion before artistic tuning.

## Six reference props

Portable generator, portable radio, metal barrel, wooden crate, medical toolbox and wood pallet. Use the existing owner-supplied models; do not introduce new external art with unknown rights. Inspect grounding, scale, silhouette and realistic placement beside the human reference. The checker fixture is a technical regression asset, not an art-direction example.

## Fixture semantics

- Work fixture: warm neutral light, physical steel housing, powered by daytime facility service. It fades during blackout.
- Street/entry fixture: warm exterior lamp attached to an urban frontage; strongest at night, never an arbitrary emergency-red storefront wash.
- Egress fixture: subdued battery-backed green-white light at an exit/sector doorway or enclosed wayfinding fixture. Small radius; readable escape information.
- Equipment indicator: a small panel-mounted LED, dim when unpowered/locked, amber with an installed cell, green online. No floating red antenna sphere or skyline pulse.
- Flare: red is justified by the deployed warning/safety device and its gameplay lifetime/radius.
- Wooden direction signs: no powered floating red light. Read by daylight or the player's carried light.
- Radio mast: no generic red decorative beacon. Indoor Foundry equipment fits below its roof; outdoor structures retain grounded frames.

## Foundry reference

Structural roof datum 8.25 units, .24 thickness, enclosing the 54.4×95.6 hall footprint. Existing lower walls remain; upper clerestory bands and supports close the previous gap. Pillar extensions meet the roof frame. Roof data participates in camera/shot visibility without becoming a 2D movement blocker. No rule, supply count, transmitter coordinate or extraction coordinate is changed by this reference PR.

Work lights, battery egress cues and carried lights form the day/blackout hierarchy. Sky/sun is not a substitute for interior service lighting. Final route reauthoring and T3/extraction separation remain separate design/balance issues and need evidence; a roof fix alone does not fulfil them.

## Ashfall reference

Use the existing neighbourhood footprint while correcting entry fixtures and removing red decorative indicators. Next authored pass must make three memorable destinations, coherent streets/sidewalks and convincingly closed or usable entrances. Do not claim that changing lamp colours completes the Ashfall rebuild.

## Rejected examples

Painting/oil mode; generic red-tipped poles; emergency-red ordinary shop lights; unsupported beams; ceiling removed for screenshots; noisy repeated ground; anonymous clutter; hidden collision walls; a palette swap presented as a unique route graph.

## Approval and measured gates

Required: exact-camera day/night comparisons, player-height and chase views, eight-material/six-prop reference scene, runtime errors/requests, geometry/draw/texture counts, collision/roof rays and canonical-rule regressions. All-six-map migration waits for approval of the Foundry/Ashfall reference. Six-human balance and 30–60-minute specified-hardware soak remain independent gates. Existing 60-FPS captures prove neither.

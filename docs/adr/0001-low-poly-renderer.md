# ADR 0001 — One player-facing low-poly style

Status: accepted product direction from the owner's quality-reset brief; internal migration remains staged. No engine rewrite.

## Context

The 0.5 renderer supports a brush-dab mode and a lit-mesh mode. The normal path still uses instanced foliage cards and shared palette utilities; deleting paint.js wholesale would also delete vegetation, rig attachments, material registration and lighting uniforms. The supplied direction explicitly rejects an oil-paint player option.

## Decision and stages

1. This PR removes the visual selector, V binding, painterly URL override and saved-style override from the product. The existing lit path is always selected. EN and pt-PT controls agree. Keep quality controls and the instanced vegetation required by the normal path.
2. After the Foundry/Ashfall reference is approved, isolate useful instanced foliage/material utilities and stop constructing invisible solid brush dabs. Measure geometry, texture, heap and load changes on all six maps before deleting producers.
3. Remove unused brush shader/atlas branches and legacy material registrations only after character, foliage, night lighting and map-switch regression coverage proves they are unused. BS-ART-04 remains open until that stage and measurable reduction pass.

## Consequences and rollback

Existing ?style=paint URLs now show the supported lit style; they do not re-enable a rejected feature. This PR does not pretend to remove all legacy renderer code or prove final art quality. Revert this single style commit to restore the previous selector; no server state or production deployment changes.

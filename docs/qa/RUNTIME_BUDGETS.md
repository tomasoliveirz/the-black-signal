# Runtime measurements and proposed hardware gate

## Completed pre-lifetime-fix capture

Source b28c38c; Ryzen 9 7940HS, RTX 4070 Laptop through ANGLE/OpenGL, 32 GB RAM, Chromium 157, 1280×720/Ultra. One actual Foundry client, five bots and a rotating camera, multiple live rounds. 1,800.16 seconds of visible rendering over 1,914.71 wall seconds; other QA tabs shared the browser/host and their non-rendering intervals were excluded. This is not an isolated low-end-device benchmark.

108,005 frames: median 16.7 ms, p95 17 ms, p99 17.1 ms, maximum 125.9 ms. Render-submission CPU p95 2.8 ms/p99 3.3 ms, maximum 124.4 ms. 1,800 sampled GPU queries: p95 1.52 ms/p99 1.98 ms, maximum 2.53 ms, zero disjoint samples. Sampled GPU timings are not every frame's complete GPU cost. The isolated long CPU/frame spike needs tracing for attribution; no causal GPU/GC claim is made.

All connectivity samples were online; no runtime exceptions or failed requests. JS heap ranged 78.3–139.1 MB, final 92.7 MB; first-five-minute median 81.1 MB and last-five-minute median 94.3 MB. Geometry ranged 421–466 and textures 14–64. Those resource increases prompted an isolated reproduction, which confirmed and fixed a figure lifetime defect (FIGURE_LIFETIME.md). This old capture is not a post-fix memory-stability pass. Full measured data: `soaks/runtime-foundry-before-lifetime.json`.

## Gate fixed before the post-fix rerun

For this explicitly named 1280×720/Ultra hardware profile: at least 1,800 visible seconds, frame p95 ≤20 ms and p99 ≤25 ms, sampled GPU p95 ≤6 ms/p99 ≤10 ms, every sampled JS heap ≤256 MiB, zero unplanned disconnections/runtime/request errors. Record worst frame and all resource ranges even if percentile targets pass. Require the separate repeated-figure resource plateau and shared-source safety test; inspect dynamic resource changes by round/phase rather than interpreting one heap sample as a leak.

These are the proposed gate for the next run, not retroactive acceptance of the old measurements. A detached source snapshot protects the rerun from ongoing layout work. Low-end physical devices, other five maps, actual six humans, Internet jitter/loss and sustained real microphones remain separate required profiles. No claim of universal 60 FPS or complete Definition of Done.

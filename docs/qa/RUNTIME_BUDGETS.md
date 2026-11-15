# Runtime measurements and proposed hardware gate

## Completed pre-lifetime-fix capture

Source b28c38c; Ryzen 9 7940HS, RTX 4070 Laptop through ANGLE/OpenGL, 32 GB RAM, Chromium 157, 1280×720/Ultra. One actual Foundry client, five bots and a rotating camera, multiple live rounds. 1,800.16 seconds of visible rendering over 1,914.71 wall seconds; other QA tabs shared the browser/host and their non-rendering intervals were excluded. This is not an isolated low-end-device benchmark.

108,005 frames: median 16.7 ms, p95 17 ms, p99 17.1 ms, maximum 125.9 ms. Render-submission CPU p95 2.8 ms/p99 3.3 ms, maximum 124.4 ms. 1,800 sampled GPU queries: p95 1.52 ms/p99 1.98 ms, maximum 2.53 ms, zero disjoint samples. Sampled GPU timings are not every frame's complete GPU cost. The isolated long CPU/frame spike needs tracing for attribution; no causal GPU/GC claim is made.

All connectivity samples were online; no runtime exceptions or failed requests. JS heap ranged 78.3–139.1 MB, final 92.7 MB; first-five-minute median 81.1 MB and last-five-minute median 94.3 MB. Geometry ranged 421–466 and textures 14–64. Those resource increases prompted an isolated reproduction, which confirmed and fixed a figure lifetime defect (FIGURE_LIFETIME.md). This old capture is not a post-fix memory-stability pass. Full measured data: `soaks/runtime-foundry-before-lifetime.json`.

## Gate fixed before the post-fix rerun

For this explicitly named 1280×720/Ultra hardware profile: at least 1,800 visible seconds, frame p95 ≤20 ms and p99 ≤25 ms, sampled GPU p95 ≤6 ms/p99 ≤10 ms, every sampled JS heap ≤256 MiB, zero unplanned disconnections/runtime/request errors. Record worst frame and all resource ranges even if percentile targets pass. Require the separate repeated-figure resource plateau and shared-source safety test; inspect dynamic resource changes by round/phase rather than interpreting one heap sample as a leak.

These are the proposed gate for the next run, not retroactive acceptance of the old measurements. A detached source snapshot protects the rerun from ongoing layout work. Low-end physical devices, other five maps, actual six humans, Internet jitter/loss and sustained real microphones remain separate required profiles. No claim of universal 60 FPS or complete Definition of Done.


## Post-fix 30-minute result: percentile gate failed

Source 72c40e7, same hardware/resolution/quality, detached immutable source; 1,809.01 visible seconds over 1,809.03 wall seconds, 106,579 frames. Frame median 16.7 ms, p95 18.6 ms, **p99 29.9 ms** (budget ≤25 ms), maximum 1,095.8 ms. Render-submission CPU p95 9.1 ms/p99 19.3 ms, maximum 963.7 ms. 1,776 GPU samples: p95 3.289 ms/p99 6.619 ms, maximum 43.04 ms. The frame-p99 gate failed; all other declared percentile/heap/connectivity/error gates passed. Full record: `soaks/runtime-foundry-post-lifetime.json`.

Heap ranged 78.94–129.37 MB; geometry 402–428, textures 14–34 across live phases/rounds. This does not replace the controlled repeated-figure plateau test. No runtime exceptions, failed requests or unplanned disconnections were observed.

A host process inspection near this period showed Blender using roughly 758% CPU. That establishes competing work on this shared machine, not the cause of a particular frame spike. No user process was stopped or modified. The run stays published as a failed result; thresholds are unchanged.

## Dedicated-browser diagnostic: eight minutes, not a replacement gate

A separate Chromium process and profile, same detached source and server, recorded 480.65 visible seconds/480.66 wall seconds and 28,809 frames. Frame median 16.7 ms, p95 17.4 ms, p99 19.4 ms, maximum 333.6 ms. GPU p95 3.175 ms/p99 5.062 ms, maximum 6.076 ms. No runtime/request/connectivity errors. The numerical percentile thresholds passed for this short diagnostic, but the required 1,800-second duration did not run. Full record, including host load and per-window values: `soaks/runtime-foundry-dedicated-browser-8min.json`.

The host workload changed as well as the browser arrangement, so this is not a controlled causal comparison. Long frame spikes remain unresolved. Required next evidence: trace a reproducible long frame, then rerun the full declared duration with the host workload recorded. Low-end hardware, all-map coverage, six-human and real-microphone/Internet impairment gates remain open. Do not close QA-02 or describe this branch as a full performance pass.

# ADR 0002 — proximity voice transport evaluation

Status: proposed architecture; no transport migration or production change. BS-AUDIO-02 remains open.

## Evidence

Current mono PCM is 16,000 samples/s × 16 bits = 256 kbit/s per active sender before framing and fan-out. The completed 30-minute six-client tone test on localhost received 1.917 GB in aggregate (8.52 Mbit/s including snapshots/events), uploaded 381 MB and had no disconnects. That is robustness/bandwidth evidence, not Internet speech quality.

Actual Chromium encoded an eight-second synthetic tone to WebM/Opus at requested 24 kbit/s: 25,953 bytes, decoded 7.98 seconds at 48 kHz. This is roughly a tenth of the 256,000-byte eight-second raw PCM payload. The recorder probe proves this browser's codec path, not RTP latency, real speech bitrate, packet-loss recovery or a six-microphone test. MediaRecorder chunks must not simply be pushed onto the game socket and called a WebRTC migration.

## Candidate decision

Prefer an isolated, authenticated WebRTC/Opus SFU transport before public beta, retaining Web Audio HRTF/occlusion for playback and the authoritative game server's room/life/proximity permissions. Keep voice traffic independent of the game's ordered WebSocket queue. This is an engineering recommendation, pending implementation and measured impairment tests.

A direct peer mesh needs 15 pairwise links for six participants and depends on endpoints obeying unsubscribe/proximity changes. An authoritative forwarding service can enforce revocation centrally. A hosted SFU may reduce operations work but introduces provider credentials, retention/data-processing terms and cost; no provider or paid plan has been selected. Self-hosting requires isolated service/ports, TLS, TURN connectivity, service limits and rollback under the existing VPS rules; none is deployed in this reset.

WebRTC's required audio baseline includes Opus ([RFC 7874 §3](https://www.rfc-editor.org/rfc/rfc7874.html#section-3)). The browser API specifies relay-only ICE, which can avoid disclosing a participant's addresses to another endpoint ([W3C RTCIceTransportPolicy](https://www.w3.org/TR/webrtc/#dom-rtcicetransportpolicy-relay)). Using a provider/SFU and encrypted transport does not itself settle retention, abuse or independent security review.

## Acceptance before switching

Room-scoped short-lived grants, server-side active/living/proximity revocation, guest/account binding, no dead-to-live or cross-room delivery, mute/listen/PTT/permission/reload parity, listener HRTF with coarse hidden emitters, no microphone auto-enable, no default voice recording. Exercise six actual microphones for at least 16 minutes with measured jitter/loss, RTT, mouth-to-ear latency, CPU/bandwidth and channel-leak checks. Define compatible browsers/device budgets and test TURN fallback. Keep a feature-gated rollback that cannot silently re-enable microphone capture. The current PCM mode must remain labelled prototype until those gates pass.

## Sources and scope

Primary specifications above were checked on 2026-11-15. This ADR stores project-specific reasoning/evidence, not personal encyclopedia knowledge. Owner approval, six-human sessions and independent security review remain explicit gates.

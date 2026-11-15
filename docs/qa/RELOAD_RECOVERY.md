# Refresh and transient reconnect recovery

The previous client kept a bearer token only in memory, so refreshing lost the player even during the server's 45-second grace period. Recovery now binds the room's public player ID to the existing account session or a random 256-bit guest identity in an HttpOnly, SameSite=Strict session cookie. HTTPS deployments also set Secure. The server retains only the guest identity hash. Session storage contains the room code and public player ID; neither authorises recovery by itself.

A disconnected player can resume their current role/state for 45 seconds. An active connection cannot be displaced: the client briefly retries to accommodate the old page's close event, then shows an error. Leaving or changing account clears the pointer. Recovery does not reopen the microphone; re-entering the match restores the regular screen without implying microphone consent.

Validation: four focused ownership/replay tests, thirteen HTTP/WebSocket cases, eighteen rules cases and eight visibility cases pass (43 total). The real Chrome test refreshed an active round, recovered the same player/role, checked cookie HttpOnly/SameSite flags and JavaScript invisibility, checked that session storage held only the public pointer, and verified leave clears it. See `reload-browser-evidence.json`. Run the suite with `node --test server/reconnect.test.mjs server/network.test.mjs server/rules.test.mjs server/visibility.test.mjs`.

Limits: a server restart loses in-memory rooms; clearing browser cookies or changing browsers cannot recover a guest. An XSS could still perform actions in the user's live origin, although it cannot read this cookie. Independent security review, account recovery/deletion/moderation and Internet loss/jitter testing remain separate open gates. Account recovery requires the same still-valid account session; this is not password recovery.

Rollback: revert this commit as one unit (client pointer format, upgrade cookie and room ownership checks). Unmerged local reference; no production change.

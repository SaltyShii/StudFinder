# Community race mechanics doc wins over the upstream sim

Where the Global client has no code or parameters for a mechanic, `packages/sim` follows "Uma Musume Race Mechanics" (KuromiAK, condensed in `docs/race-mechanics.md`), not the behaviour inherited from saltyuma-tools.

The sim is a fork and no longer synced, so nothing forces it to keep upstream's approximations. The client only plays back server-simulated races and has null stubs for conserve power and compete, so the doc is the best source left. Where the client does have the logic (checked in uma-re), the client wins over the doc.

Mechanics that exist only in the JP version (wiz limit break, zenkai spurt) are deferred until Global gets them.

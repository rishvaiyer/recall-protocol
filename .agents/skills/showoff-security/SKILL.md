---
name: showoff-security
description: Turn this defensive security, privacy, reliability, or red-team project into a short evidence-first launch demo. Use for "/showoff-security", "/security-brag", "make a demo video", or "show this security project off".
---

# /showoff-security

Create a short, polished security demo without exaggerating what the project proves.

## Read first

1. `security-showcase.json`
2. `README.md`
3. `SECURITY.md` when present
4. package scripts, routes, tests, fixtures, and demo pages
5. the actual UI/source used by the demo

If docs conflict with current code or current test output, trust the current code/output.

## Safety boundary

This skill is for defensive, synthetic, local, public-data, or user-controlled demos.

Never:
- target a real third party or turn the demo into an intrusion workflow
- reveal credentials, tokens, private keys, cookies, personal data, household identifiers, IPs, MAC addresses, or private logs
- reproduce exploit payloads, jailbreak text, malicious code, or operational attack instructions just for drama
- imply that a shadow-only, metadata-only, paper-only, heuristic, or synthetic rehearsal is a live detector
- claim universal protection, "unhackable", zero false positives, zero false negatives, or production readiness without direct evidence
- invent benchmark numbers, incidents, customers, CVEs, detection rates, or attack counts

When red-team material exists, show the safe boundary and defensive decision, not the operational attack recipe.

## Evidence gate

Before storyboarding, create `showoff-output/evidence.json`.

Every claim used in the video or share copy needs:
- `claim`
- `source`
- `verification`
- `status`: `verified`, `documented`, or `not-run`

Only `verified` and clearly labeled `documented` claims can appear as product claims. A `not-run` item may appear only as a limitation.

Run the safe verification commands from `security-showcase.json` when practical. Never weaken tests or change fixtures to make the demo pass.

## Story shape

Target 18 to 25 seconds.

1. Hook, 2 to 3s: one concrete risk or failure mode.
2. Defensive decision, 4 to 7s: show the real product handling it.
3. Evidence, 6 to 10s: show 1 to 2 proof points from tests or deterministic output.
4. Boundary, 2 to 4s: state the important limitation.
5. Outro, 2 to 3s: project name + real value proposition.

Do not use green-code rain, hooded attackers, fake terminal spam, glowing locks, fake maps, or generic cyber filler. The product itself is the visual hook.

## Visual rules

- Reuse the real UI, typography, graphs, receipts, timelines, diffs, and components.
- Simulated clicks/typing are fine when they operate the real local demo.
- Redact private identifiers before capture.
- Use precise labels: `blocked`, `denied`, `flagged for review`, `shadow-only`, `not-run`, `synthetic`, `verified`.
- Keep text readable long enough to read.
- Any frozen frame should work as a portfolio screenshot.

## BRAG integration

If `/brag-slim` is installed, use it only after the evidence gate and storyboard are complete. Give it the project-specific storyboard, real UI moments, tone, and claim boundaries from this skill. Do not let it invent security claims.

If it is not installed, use local browser/video tools and FFmpeg when available.

Write to `showoff-output/`:
- `showoff-plan.md`
- `evidence.json`
- `share-copy.txt`
- `poster.jpg`
- `demo.mp4`
- `work/`

## Final check

Before delivery:
- inspect a settled frame from every scene and transition
- verify no secret/private identifier is visible
- verify every security claim exists in `evidence.json`
- visibly label shadow-only/not-run cases
- use a settled product frame for the poster
- make sure a stranger can explain what the product does after one viewing

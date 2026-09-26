# Security Showoff

This repo now has a project-specific `/showoff-security` skill inspired by BRAG, with stricter evidence and safety gates for security demos.

Run from the repo root with a compatible coding agent:

```
/showoff-security
```

The skill reads `security-showcase.json`, verifies safe project evidence when practical, creates a short storyboard, and writes launch assets to `showoff-output/`.

Expected output:
- `showoff-plan.md`
- `evidence.json`
- `share-copy.txt`
- `poster.jpg`
- `demo.mp4`

It is intentionally strict about synthetic versus live behavior, redaction, and unsupported security claims.

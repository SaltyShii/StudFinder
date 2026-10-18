# Stud Finder

Answers one question: which uma should I train next as a great-grandparent, grandparent or parent for the upcoming Champions Meeting?

Design notes live in [GLOSSARY.md](GLOSSARY.md). Licence: GPL-3.0-or-later (includes code derived from alpha123/umalator, GPL-3.0). `packages/lineage` is MIT, taken from lineageplanner-salty.

- `packages/sim`: race simulator, vendored from saltyuma-tools `uma-skill-tools/` (sync manually)
- `packages/lineage`: inheritance, affinity and rules, vendored from lineageplanner-salty
- `packages/scoring`: skill value = proc % × median lengths gained, per slot mode
- `apps/web`: Vite + Preact + TypeScript UI (not yet created)

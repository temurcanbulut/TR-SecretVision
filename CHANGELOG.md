# Changelog

## Unreleased — 2026-11-01 review follow-up

- Address the external source review with regression tests, explicit scope decisions and a linked follow-up document.
- Keep original experiment/release provenance and historical repository URLs; no fabricated model gain or rewritten development history.
- Run ordinary CI for these changes; no training, paid inference or platform credits.


## Public source distribution — 2026-10-31

Published the generator, evaluation tools, English/Turkish documentation, licenses and twenty unchanged examples at https://github.com/temurcanbulut/TR-SecretVision. The public dataset remains on EVREN. Complete annotation/metadata/mask files are supplied in a checksummed archive and restored offline with `npm run data:prepare`. Small linked QA/publication summaries remain directly browsable.

Seventeen regression tests passed. A fresh metadata restore, idempotent second restore and rejection of a corrupt archive were checked. All five frozen renderer files and the 1,440-record manifest retain their original checksums. No model was trained or evaluated; human verification remains false for every sample.

## 0.2.0 — original dataset build

Added ten classes, ten application families, forty compositions, 600 canonical scenario pairs and 240 dependent stress views. Sensitive and benign candidate regions, application-disjoint splits, glyph masks, YOLO/COCO annotations and technical QA are included. The old v0.1 data and archived experiments remain unchanged. Old OCR scores are not v0.2 results.

# Review follow-up — 2026-11-01

## Measured text-rule diagnostics (not OCR)

Frozen v0.2 clean test slice: 240 images / 120 pairs. Candidate positions, class
hints and transcription are provided by metadata; the second rule also receives
visible-role transcription. No pixels are read and no trained model is evaluated.
Rules were written after the data was public, not selected blindly on validation.

| Oracle-input diagnostic | Precision | Recall | Complete contrastive pairs |
|---|---:|---:|---:|
| Literal format rules | 81.33% | 92.02% | 17.50% |
| Visible-role rules | 87.58% | 95.86% | 71.67% |

[Complete reproducible output](baselines/oracle-text-rules.json), including false
alarms, all slices and matching details. `npm run baseline:rules` reproduces it;
CI checks that the report does not drift. These scores are not full-image OCR,
detection recall, learned context understanding or transfer to real screenshots.
The v0.1 OCR result is still separate. Two actual full-image Windows OCR/rule baselines are now available in [the dated OCR protocol](FULL_IMAGE_OCR.md). A trained-detector comparison remains open.

## Shortcut ablation

v0.2 remains immutable and explicitly documents invalid TCKN/IBAN and reserved
network formats. Replacing bytes under an existing version would corrupt hashes
and results. `src/format-ablation.mjs` defines a separate checksum-valid/invalid
paired slice; all formats/arms inherit the source family and split.

`node tools/generate-format-ablation.mjs` renders 200 supplemental local PNGs,
DOM line boxes and provenance under `examples/output/format-ablation-pilot-v2`.
50 focal-ID source pairs × two context arms × two formats. The pilot was generated
and automatically checked locally; it is not uploaded to EVREN/Hugging Face or
bundled as a new official release. No item is human_verified.

No real identity, bank account or provider supplied a value; no service is queried.
A generated checksum-valid identity string can coincide with an assigned ID, so
unassigned/noncollision is **not** claimed. IBANs use nonexistent bank code 00000;
their checksum alone is valid, not a usable bank account. The image is completely
synthetic, but format validity is not evidence of identity. Phone/email reservation
is retained. External transfer and human review remain separate research work.

## Reproducibility

Playwright is pinned to stable 1.64.1 with a lockfile; the old release environment
is not retrospectively rewritten. Readable current specs preserve the exact
specification JSON hash. Original specs/plan source bytes are preserved under
`src/frozen-v0.2/` and checked against the original plan. CI checks integrity,
tests, formatting and baseline drift without launching a browser/model/training.

## Distribution

The repository contains code/metaveri and 20 original images; it is not the full
1,440-image dataset. A Hugging Face staging exporter is documented separately.
Publishing needs the owner's hub identity and appropriate dataset terms. Do not
claim a Hugging Face publication that has not happened.

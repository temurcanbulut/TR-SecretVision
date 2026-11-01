# Evaluation and contribution protocol

## Research questions

Can a detector localize sensitive values on previously unseen application families without redacting semantically different values with the same appearance? Does performance degrade on small text and mild blur? Which Turkish/English roles and value types remain difficult?

The useful outcome is a reproducible measurement of **leakage and unnecessary removal together**. Stars/downloads are not a quality metric. Publish an honest demo, clear failure cases, minimal reproduction and a stable evaluation protocol only after release approval; do not generate low-effort volumes or game contribution credits.

## Input boundary

An image detector consumes only PNG pixels, dimensions and a frozen confidence threshold. An OCR pipeline may consume its own OCR output derived from the full image; it must not consume manifest text, DOM, candidate rectangles, masks, template IDs, pair IDs, source hashes or values. Ground-truth crops are forbidden as inference inputs. Benchmark text is oracle diagnostic data, not an OCR result.

Choose model, preprocessing, thresholds and confidence on train/val, record source/config hashes, then evaluate test once. Further test-driven tuning requires a new benchmark revision or an explicitly contaminated development result. Test labels and layouts have been visible during QA; this is an open, not secret, benchmark. Report known exposure.

## Predictions and metrics

One JSON line per selected image:

```json
{"id":"trsv2_IMAGE_ID","predictions":[{"class_id":0,"bbox":[10,20,180,24],"score":0.8}]}
```

Empty predictions must be explicit. Unknown, missing, duplicate, nonfinite or out-of-bounds predictions are rejected. Standard detection matching is class aware, score ordered, IoU ≥ 0.5, one-to-one. Precision/recall/F1 here are fixed-cutoff metrics, not mAP.

```powershell
node src/evaluate.mjs --predictions model-test-clean.jsonl --split test --variant clean --output qa/model-test-clean.json
node src/evaluate.mjs --predictions model-test-all.jsonl --split test --variant all --output qa/model-test-all.json
```

Report per class, app, language, theme, source font size and transformation; clean and stress results separately. Use a group bootstrap by **application/layout groups**, not individual images, for uncertainty estimates in a future model study; the small number of held-out apps limits reliable confidence intervals. No bootstrap implementation or estimate is included in this release.

Also report:

- Negative-image false alarm rate, with its denominator; controls retaining one sensitive anchor are not negatives.
- Contrastive pair pass rate: all focal sensitive fragments matched in the sensitive arm AND no prediction covers ≥25% of any focal benign candidate fragment in the control arm. Anchors remain labeled but do not decide the focal contrastive score. This is a defined diagnostic threshold, not a legal privacy decision.
- Fraction of target glyph-mask pixels covered by submitted rectangles. IoU recall is **not** the fraction of readable secret material removed. A partially covered fragment can pass IoU and still leak. Full mask coverage is necessary, and not sufficient to prove a real screenshot safe.
- Logical-value/whole-screen completeness and transcription accuracy when an adapter supports them. The supplied scorer provides fragment detection and pixel coverage; it does not currently compute exact transcription accuracy or semantic re-identification risk.

## Local full-image OCR results; no trained detector

No detector was trained and no paid inference or EVREN credit was used. Installed local Windows OCR was run on all 240 clean test PNGs on 2026-11-01; two fixed rule pipelines and their complete artifacts are described in [full-image OCR](docs/FULL_IMAGE_OCR.md). This is OCR engine inference, not detector training. The original frozen release metadata predates this evaluation and is preserved unchanged. The old OCR v2 result (77/80 boxes on the old 30-image test, 96.25% recall) applies only to v0.1's four-class closed grammar. It is not a score for the ten-class context benchmark. Scorer unit tests with constructed predictions test code; they are not model performance.

## Context is required by construction

`src/report.mjs` counts the focal same-value pairs. On the balanced two-arm candidate classification subset, a deterministic classifier that sees only the literal value and makes the same decision for both occurrences has at most **50% accuracy**; one label is positive and one negative. This is a mathematical property of that subset, not a measured OCR/model baseline or a real-world accuracy bound. It does not apply to the reference-control or PEM-marker subsets.

## Next evidence before public claims

Human review of stratified pairs and candidate roles, stronger validation-developed OCR pipelines, a trained detector baseline after explicit approval, ablations on context vs literal patterns, and independent opt-in real-world transfer testing. A release can make the data and these unanswered questions public with approval; it must not claim that the intended research gains have already been established.

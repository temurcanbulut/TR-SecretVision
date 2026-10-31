# Metadata and annotation contract

`metadata/manifest.jsonl` is the unchanged release manifest: 1,440 records. `metadata/pairs.jsonl` contains 600 canonical scenarios and their derivative IDs. `metadata/role_vocabulary.json` documents the closed role vocabulary. The full manifest SHA256 is recorded in [release.json](../metadata/release.json).

| Field | Meaning |
|---|---|
| `id`, `image_path`, `image_sha256` | Stable image identity, original relative path and exact PNG digest |
| `pair_id`, `arm` | Scenario identity and sensitive/control arm |
| `split`, `app`, `application_group_id`, `leakage_group_id` | Fixed split and shared application/layout identities |
| `variant` | `clean`, `downscale_065` or `blur_070`; derivatives are dependent views |
| `annotations` | Sensitive visible line fragments; `[x,y,width,height]` in pixels |
| `candidates` | Sensitive and benign fragments, kept separate for counterfactual evaluation |
| `slots`, `rendered_text` | Synthetic source text and roles; ground truth, not model features |
| `ink_mask_path` | Sensitive glyph mask used for coverage QA/evaluation |
| `human_verified` | Always false in this release |

Class order (zero-based manifest/YOLO): `api_token`, `password`, `email`, `credential_uri`, `private_key`, `phone`, `national_id`, `iban`, `person_name`, `verification_code`. COCO adds one to category IDs. Empty YOLO files are intentional negatives. Multi-line values produce multiple boxes; a credential URI is a single category rather than nested duplicate password labels.

Pair kinds: `identical_payload_context` (902 canonical focal field pairs), `literal_vs_reference`, and `private_vs_public_pem_marker`. Refer to the actual `pair_kind` values in the manifest and [annotation guidelines](../ANNOTATION_GUIDELINES.md). A control screenshot can retain an unchanged sensitive anchor. The 342 negative images are a different concept from the 600 control arms plus dependent views.

`examples/manifest.jsonl` copies 20 canonical records and adds `example_image_path`. Original `image_path`, IDs, SHA256, split and flags remain intact. It is a documentation selection, not another benchmark split. The full pairs file remains authoritative; example selection lists canonical pair IDs only and does not imply that derivative PNGs are bundled.

Prediction JSONL for `src/evaluate.mjs` must contain every selected image exactly once, including empty lists:

```json
{"id":"trsv2_008c8f1639c0f69d","predictions":[]}
```

Each nonempty prediction is `{ "class_id": 2, "bbox": [x,y,width,height], "score": 0.9 }` with finite in-bounds pixels. Apply one declared confidence cutoff before submission. Example invocation after importing the complete images:

```sh
node src/evaluate.mjs --predictions predictions.jsonl --split test --variant clean --output qa/my_evaluation.json
```

This command evaluates submitted predictions; it does not infer them. The output includes precision/recall/F1, negative false alarms, paired success and glyph coverage, plus application/language/font/theme/stress slices. It does not calculate mAP. Ground-truth text, candidates, masks and pair identities must not become inputs to a screenshot-only detector. Use validation data for model/threshold selection and report clean/stress test slices separately.

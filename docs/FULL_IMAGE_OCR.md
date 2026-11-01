# Full-image Windows OCR baselines — 2026-11-01

Two fixed rule pipelines were evaluated on the **same 240 original clean test
PNGs**, including 56 fully negative images and 120 complete context pairs.
There are 677 ground-truth line-fragment boxes on this slice. The installed
Windows OCR recognizer receives full decoded PNG pixels; prediction receives
only its word text/geometry and image dimensions. Metadata joins/hashes are used
outside prediction for alignment and scoring, not as input features.

| Baseline | TP / FP / FN | Precision | Recall | F1 | Complete pair pass |
|---|---|---:|---:|---:|---:|
| OCR + literal rules | 182 / 520 / 495 | 25.93% | 26.88% | 26.40% | 0/120 |
| OCR + visible-role rules | 142 / 4 / 535 | 97.26% | 20.97% | 34.51% | 7/120 |

Negative-image false alarms: 50/56 and 0/56 respectively. All submissions have
confidence one; this is class-aware score-ordered IoU≥0.5 matching, **not mAP**.
IoU recall does not establish that every sensitive glyph/value was redacted.
This report does not measure transcription accuracy or complete redaction.

## Reproduce the scoring on any Node 22+ host

```sh
npm ci --ignore-scripts
npm run data:prepare
npm test
npm run baseline:ocr:replay
```

The last command losslessly decompresses [raw OCR output](baselines/windows-ocr-test.jsonl.gz),
recomputes both predictions and writes [the complete result](baselines/windows-ocr-rules.json).
CI checks that it matches. All ten class slices, image/pair details, hashes,
false alarms and environment are available. No image/OS recognizer/model/provider
is run during replay; the source PNGs are only needed to regenerate OCR.

## Regenerate OCR on Windows with the full local dataset

```powershell
powershell.exe -NoProfile -NonInteractive -ExecutionPolicy RemoteSigned -File tools/ocr-windows.ps1 -DatasetRoot . -Language tr
node tools/evaluate-windows-ocr.mjs --pack
```

The RemoteSigned option applies only to that PowerShell process; it does not set
the machine/user policy. The script is local source. Output files must not exist;
use a fresh checkout/output copy to preserve prior evidence. Missing OCR language
support fails rather than installing/downloading a recognizer. The recorded
environment is [here](baselines/windows-ocr-environment.json): Windows OCR, `tr`,
Windows build and process elapsed time. No external-service client is called by
the runner; OS internals/telemetry were not instrumented.

## Limitations and frozen scope

Rules were written after the dataset was public and after its general visual QA;
this is **not** a blind, pre-registered or independently reviewed study. Rules
include release-specific credential shapes and a small bilingual role vocabulary.
They are not a general DLP engine. The 48px/620px context window and two-pixel word
padding were fixed before the full run; no held-out-score optimization was done.

The context pipeline filters literal candidates by recognized nearby field roles.
Its higher precision is bought with lower recall. Incomplete OCR, fragmented
credential strings, missed names/roles and rough word boxes all matter; most
target fragments are missed. Neither method is suitable for unattended privacy
redaction. Results do not establish transfer to real screenshots, unseen roles or
valid real identity/account formats. The separate 200-image local ablation pilot
was not mixed into the v0.2 scoring set.

Earlier v0.1 four-class OCR numbers and metadata/oracle-text diagnostics use
different inputs and denominators and must not be presented as directly
comparable. No detector training, new model download, paid inference or EVREN
credits were used. **Existing OS OCR inference was performed locally.** Every
human_verified flag remains false. Gzip stores observation JSONL, not code or
weights, under the synthetic data's CC BY 4.0 scope; the scripts are MIT.

# Prepared repository metadata

Status: public repository created at https://github.com/temurcanbulut/TR-SecretVision. Source and research payload publication is tracked separately in the workspace publication report. The dataset itself is public on [EVREN](https://evren.ssyz.org.tr/datasets/u300f9431e45f/tr-secretvision-context-v02). Keep that link as the main dataset entry point.

Suggested repository name: `TR-SecretVision`.

Suggested description:

> Synthetic Turkish/English screenshot benchmark for sensitive-vs-benign context: 600 pairs, 10 classes, application-disjoint splits, generator and QA.

Suggested topics: `computer-vision`, `dataset`, `turkish`, `synthetic-data`, `secret-detection`, `data-loss-prevention`, `ocr`, `benchmark`.

Prepared release title: **v0.2.0 — Context pairs, complete metadata and reproducible QA**.

Prepared release text:

> TR-SecretVision Context v0.2.0 contains 1,200 canonical synthetic screenshots, 600 scenario pairs, 240 dependent stress views, 10 classes and 4,255 line-fragment boxes. This code/metadata distribution adds the original generator and evaluator, full paired metadata, YOLO/COCO annotations, glyph masks, technical QA and twenty unchanged examples. The full image collection is separate; preserve the application-disjoint 720/360/360 split. All human_verified flags remain false. No v0.2 model-performance or real-world transfer result is claimed. Data/docs are CC BY 4.0, code MIT and bundled fonts OFL. The primary dataset page is on EVREN.

The README image at `docs/assets/context-pair.png` is a truthful preview of a real synthetic pair. It must not be advertised as detector output. It is a wide README illustration, not a separately prepared GitHub social-preview cover. Full-size example images retain their original SHA256.

The root `CITATION.cff` uses `type: dataset` and the real EVREN URL. GitHub documents this citation format in [About CITATION files](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-citation-files). No DOI, model score or CI badge has been invented.

Before an authorized remote publication, review the licenses, attribution, repository contents and local QA report. Upload repository contents, not `node_modules`, local archives, generated output or account/browser evidence. Publishing a code repository is separate from starting training or using EVREN exports. After a real repository exists, its actual URL can be added to the EVREN page and citation metadata.

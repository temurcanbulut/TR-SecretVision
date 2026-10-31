# Public source distribution

Repository: [temurcanbulut/TR-SecretVision](https://github.com/temurcanbulut/TR-SecretVision). Primary dataset: [TR-SecretVision Context v0.2 on EVREN](https://evren.ssyz.org.tr/datasets/u300f9431e45f/tr-secretvision-context-v02).

The repository exposes source code, documentation, licenses, example PNGs and small QA summaries as ordinary files. The complete 1,440-record manifest, 600 scenario pairs, all YOLO/COCO labels and 1,440 masks are in `data/research-metadata-v0.2.0.zip`; `npm run data:prepare` verifies and unpacks them offline. The full 1,440 screenshot collection is separate from this code/metadata distribution.

Version: dataset v0.2.0. Data/docs CC BY 4.0, code MIT, fonts OFL. All human_verified values remain false. No v0.2 model-performance, expert human-review or real-world transfer result is claimed. No training or additional EVREN spending was required for this publication.

The README preview is an explanation of an actual synthetic pair, not detector output. No DOI, model score or CI badge is invented. Citation metadata is in the root CITATION.cff. GitHub documents the citation format in [About CITATION files](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-citation-files).

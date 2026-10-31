# Public EVREN distribution status

The v0.2 dataset was imported and, with explicit user authorization, published publicly on EVREN on 31 October 2026: [TR-SecretVision Context v0.2](https://evren.ssyz.org.tr/datasets/u300f9431e45f/tr-secretvision-context-v02).

Observed inventory: 1,440 images, 4,255 boxes, 10 classes and 342 intentional negatives. Split membership is 720/360/360. An earlier server-export round trip checked every image SHA256, class, negative label and split against the local source; maximum box-coordinate discrepancy was approximately 0.001536 pixels. This is transfer verification, not model performance. No v0.2 model was trained or evaluated.

The public Benioku page now includes an inline image of an actual synthetic context pair. Its persistence after page reload and image decoding were checked. No dataset items were added for promotion. Synthetic provenance and human_verified=false disclosures remain. No new export, training, additional credit spending or reservation was made for this presentation/code-package update. This statement concerns this update; it is not a claim that the account has never spent credits.

The standard YOLO transfer does not carry the complete contrastive-pair, benign-candidate and glyph-mask semantics. This repository preserves that research metadata separately. EVREN's native A/90 health display is an automated dataset-quality signal, not model accuracy or recall. No native contrastive leaderboard was observed. Anonymous page access was not separately verified.

The root workspace contains private transfer/account evidence; those files are deliberately excluded here. A public-safe summary is in [metadata/publication.json](metadata/publication.json). Original local build archives remain immutable historical artifacts; current repository documentation reflects the subsequent public status.

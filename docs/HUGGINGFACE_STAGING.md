# Prepare a Hub distribution

Use the complete local v0.2 images, not the 20-example source checkout:

```sh
npm run data:prepare
npm run data:import -- --archive ./TR-SecretVision-v0.2.0-EVREN-YOLO.zip
node tools/export-huggingface.mjs --output ../TR-SecretVision-hf-staging
```

The exporter preflights all 1,440 image SHA256/dimensions and the frozen manifest
before writing, refuses an existing destination and never authenticates/uploads.
It emits ImageFolder train/validation/test directories, JSONL metadata, pixel
xywh boxes, class IDs, group/pair provenance, original card/license and citation.
The separate unpublished format-ablation pilot is not silently mixed into v0.2.

The directory follows [Hugging Face ImageFolder metadata](https://huggingface.co/docs/datasets/image_dataset).
Hub upload needs the owner's authenticated account and destination. Review the
staging card and data before an explicit publication; do not create credentials
or accept account terms on the owner's behalf. No Hub result is claimed here.

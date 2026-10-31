# Research annotation payload

`research-metadata-v0.2.0.zip` contains the complete original manifest, pair metadata, YOLO/COCO labels, glyph masks and QA evidence. It contains no real person records or live credentials. Data CC BY 4.0.

After `npm ci --ignore-scripts`, run `npm run data:prepare` and `npm run verify`. Extraction is local, checksummed and refuses conflicting existing files. Full screenshot pixels are separate, except the twenty examples in `examples/images`.

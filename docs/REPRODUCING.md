# Reproduction and release boundaries

Node.js 22+ is required. Install the pinned dependencies with `npm ci --ignore-scripts`; this may use the npm network. Run `npm run data:prepare` to unpack the included research metadata archive first. `npm test`, `npm run verify` and `npm run example` need no platform account, GPU or EVREN credit.

For the exact released pixels, prefer the checksummed original local archive described in [DATA_ACCESS.md](DATA_ACCESS.md). Run `npm run validate` after import for the full 1,440-image QA, including masks, coordinates and cross-split similarity. The pre-existing QA report is evidence from the original build; `npm run verify` checks repository contents and does not pretend to repeat image checks on absent images.

To regenerate all images locally instead:

```sh
npm run generate -- --browser "C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe"
npm run validate
```

Use a separate working copy if preserving original release bytes. The generator opens a new isolated local browser context, serves fixtures locally and blocks external requests. It does not read an existing browser profile or EVREN account. The pinned npm package supplies Playwright code; a Chromium-family executable must already be installed or provisioned separately. The script does not download a browser for you.

The original environment is recorded in [metadata/environment.json](../metadata/environment.json): Node 24.19.0, Brave/Chromium 156.0.8078.80, scale factor 1, bundled fonts. Browser/OS/font-rasterizer differences can change exact pixels. Stable scenarios, grouped identities and class semantics do not guarantee byte-identical pixels across environments. Publish regenerated pixels as a clearly identified derivative when their hashes differ, rather than claiming the frozen release checksum.

`metadata/generation_plan.json` records the source hashes of five files. `checkPlan()` rejects edits to these frozen inputs. Do not run `npm run plan` to hide a mismatch or tune a test set after seeing model results. A genuinely new dataset revision needs a new plan, documented lineage and separate validation.

`npm run package` creates only `dist/TR-SecretVision-v0.2.0-GitHub-ready.zip`; full imported images, node_modules, generated previews and local work files are excluded. It never rewrites the original sibling image/research ZIPs. `src/package.mjs` is a compatibility wrapper for this repository packager; the five frozen rendering sources are unchanged.

No training was run in preparing this package. The evaluator accepts externally produced predictions but does not train or call a model. See [RESEARCH_PROTOCOL.md](../RESEARCH_PROTOCOL.md) for valid model inputs and reporting rules.

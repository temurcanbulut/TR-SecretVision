# Image access without a new platform export

The public dataset is on [EVREN](https://evren.ssyz.org.tr/datasets/u300f9431e45f/tr-secretvision-context-v02). This code repository contains 20 unchanged canonical example PNGs, a checksummed archive of complete metadata/labels/masks, and the original generator. Run `npm run data:prepare` after `npm ci --ignore-scripts` to unpack the research annotations locally. It does not contain all 1,440 image files.

If you already have the original local archive, import it:

```sh
npm run data:import -- --archive "./TR-SecretVision-v0.2.0-EVREN-YOLO.zip"
npm run validate
```

Required SHA256: `420e5cc665e93c165dcfb6b224fca4d79909542a2e8efd4aa23396888eedf6af` (85,872,682 bytes). The archive was prepared locally and is distinct from a server-generated YOLO export. The importer deliberately rejects other archives, even if their images might be equivalent. See [release metadata](../metadata/release.json).

The importer performs no network requests. It checks the complete archive checksum, exact inventory, safe relative paths, every image SHA256 and every label before it writes. Existing identical files are skipped; differing files are refused. Imported images remain ignored by Git. The archive itself is not bundled here or assigned an invented download URL.

EVREN exports can consume credits. This repository never invokes one automatically. The platform's standard YOLO export omits the pair/candidate metadata and was observed to omit license/README files; keep the full metadata and licenses alongside it. The existing release's 720/360/360 membership must not be reassigned.

If no archive is available, the included examples still support `npm test`, `npm run verify` and `npm run example`. [Local regeneration](REPRODUCING.md) is another option. A separately published image archive or code repository URL must be added only when it actually exists; none is claimed here.

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { gzipSync, gunzipSync } from "node:zlib";
import { ROOT } from "../src/plan.mjs";
import { CLASSES, sha256 } from "../src/specs.mjs";
import { predictOcr, OCR_RULE_CONFIG } from "../src/ocr-rules.mjs";
import { score } from "../src/evaluate.mjs";

const directory = resolve(ROOT, "docs/baselines"),
  packed = resolve(directory, "windows-ocr-test.jsonl.gz");
let bytes;
try {
  bytes = await readFile(resolve(directory, "windows-ocr-test.jsonl"));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
  bytes = gunzipSync(await readFile(packed));
}
const raw = bytes.toString().trim().split("\n").map(JSON.parse),
  byId = new Map(raw.map((r) => [r.id, r]));
const manifest = await readFile(resolve(ROOT, "metadata/manifest.jsonl"));
const records = manifest
  .toString()
  .trim()
  .split("\n")
  .map(JSON.parse)
  .filter((r) => r.split === "test" && r.variant === "clean");
if (raw.length !== 240 || byId.size !== 240 || records.length !== 240)
  throw Error("Missing/duplicate OCR records");
const input = (record) => {
  const r = byId.get(record.id);
  if (
    !r ||
    r.image_sha256 !== record.image_sha256 ||
    r.width !== record.width ||
    r.height !== record.height
  )
    throw Error("OCR/image mismatch");
  // Explicitly discard IDs, labels, candidate fields, app names and all metadata.
  return { width: r.width, height: r.height, lines: r.lines };
};
const results = {};
for (const mode of ["literal", "context"]) {
  const predictions = records.map((r) => ({
    id: r.id,
    predictions: predictOcr(input(r), CLASSES, mode),
  }));
  results[mode] = await score(records, predictions, { pixels: false });
}
const source = await readFile(resolve(ROOT, "src/ocr-rules.mjs"));
const environment = JSON.parse(
  await readFile(resolve(directory, "windows-ocr-environment.json"), "utf8"),
);
const report = {
  scope:
    "Full original clean test PNGs -> installed Windows OCR -> fixed text/word-box rules. No DOM, target crops, source values, candidate/ground-truth regions or class hints enter prediction. Rules written after public release; not blind/pre-registered. No trained detector, tuning, model download, provider API, training or credits. Existing OS OCR inference is performed locally.",
  split: "test",
  variant: "clean",
  images: 240,
  manifest_sha256: sha256(manifest),
  ocr_sha256: sha256(bytes),
  rule_source_sha256: sha256(source),
  config: OCR_RULE_CONFIG,
  environment,
  results,
};
await writeFile(
  resolve(directory, "windows-ocr-rules.json"),
  JSON.stringify(report, null, 2) + "\n",
);
if (process.argv.includes("--pack"))
  await writeFile(packed, gzipSync(bytes, { level: 9 }));
console.log(
  JSON.stringify(
    Object.fromEntries(
      Object.entries(results).map(([name, r]) => [
        name,
        {
          ...r.overall,
          contrastive_pair_pass: r.contrastive_pairs.pass_rate,
          negative_false_alarm: r.negative_image_false_alarm_rate,
        },
      ]),
    ),
  ),
);

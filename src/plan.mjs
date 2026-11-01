import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  makeSpecs,
  safetyErrors,
  sha256,
  VERSION,
  SEED,
  CLASSES,
  APPS,
  SPLIT_BY_APP,
} from "./specs.mjs";
export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const SOURCE_FILES = [
  "src/specs.mjs",
  "src/screens.mjs",
  "src/generate.mjs",
  "src/image-utils.mjs",
  "src/plan.mjs",
];
export function stressPairIds(specs) {
  return ["val", "test"].flatMap((split) =>
    [...new Set(specs.filter((s) => s.split === split).map((s) => s.pair_id))]
      .sort((a, b) => sha256(a).localeCompare(sha256(b)))
      .slice(0, 30),
  );
}
export async function makePlan() {
  const specs = makeSpecs(),
    errors = specs.flatMap((s) => safetyErrors(s).map((x) => s.id + ": " + x));
  if (errors.length) throw new Error(errors.slice(0, 10).join("\n"));
  const sources = Object.fromEntries(
    await Promise.all(
      SOURCE_FILES.map(async (p) => [
        p,
        sha256(await readFile(resolve(ROOT, p))),
      ]),
    ),
  );
  const plan = {
    version: VERSION,
    seed: SEED,
    status: "FROZEN_GENERATION_PLAN",
    created_on: "2026-10-31",
    evaluation_status:
      "No model evaluated on this release; visual/QA access is not blind testing",
    canonical_images: specs.length,
    canonical_pairs: specs.length / 2,
    robustness_companions: 240,
    expected_images: 1440,
    classes: CLASSES,
    split_policy:
      "Whole application families held out: 6 train / 2 val / 2 test; layouts, pairs, payload identities and derivatives stay in their parent split",
    application_splits: SPLIT_BY_APP,
    application_groups: APPS.length,
    structural_layouts: 40,
    payloads_per_layout: 15,
    planned_splits: { train: 720, val: 360, test: 360 },
    stress_pair_ids: stressPairIds(specs),
    stress_variants: [
      { name: "downscale_065", scale: 0.65 },
      { name: "blur_070", sigma_css: 0.7 },
    ],
    specs_sha256: sha256(JSON.stringify(specs)),
    sources,
  };
  await mkdir(resolve(ROOT, "metadata"), { recursive: true });
  await writeFile(
    resolve(ROOT, "metadata/generation_plan.json"),
    JSON.stringify(plan, null, 2) + "\n",
  );
  console.log(
    JSON.stringify({
      status: plan.status,
      images: plan.expected_images,
      specs_sha256: plan.specs_sha256,
    }),
  );
  return plan;
}
export async function checkPlan() {
  const p = JSON.parse(
    await readFile(resolve(ROOT, "metadata/generation_plan.json"), "utf8"),
  );
  if (p.specs_sha256 !== sha256(JSON.stringify(makeSpecs())))
    throw new Error("Specifications differ from generation plan");
  for (const [path, checksum] of Object.entries(p.sources)) {
    const current = sha256(await readFile(resolve(ROOT, path)));
    if (current === checksum) continue;
    // v0.2 bytes are an immutable provenance record, not rewritten to match
    // later formatting or maintenance. The generated specification hash above
    // must still match exactly; only these two archived sources are allowed.
    if (
      p.version !== "0.2.0" ||
      !["src/specs.mjs", "src/plan.mjs"].includes(path) ||
      sha256(
        await readFile(
          resolve(ROOT, "src/frozen-v0.2", path.split("/").at(-1)),
        ),
      ) !== checksum
    ) {
      throw new Error("Generation source differs from plan: " + path);
    }
  }
  return p;
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  await makePlan();

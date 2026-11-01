/** Unrendered, separate format-ablation design. Never relabels v0.2 images.
 * Checksum validity does not establish that a number is unassigned in reality.
 * Values have no associated person/account and are never checked with a service.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { makeSpecs, hash, mod97, validNationalId } from "./specs.mjs";

export function checksumNationalId(key) {
  const hex = hash("format-ablation|" + key, 18);
  const digits = [...hex.slice(0, 9)].map((d) => parseInt(d, 16) % 10);
  digits[0] = 1 + (digits[0] % 9);
  const odd = digits[0] + digits[2] + digits[4] + digits[6] + digits[8];
  const even = digits[1] + digits[3] + digits[5] + digits[7];
  digits.push((((odd * 7 - even) % 10) + 10) % 10);
  digits.push(digits.reduce((sum, d) => sum + d, 0) % 10);
  const value = digits.join("");
  if (!validNationalId(value)) throw Error("Invalid ablation checksum");
  return value;
}

export function checksumIban(key) {
  const account = BigInt("0x" + hash("iban-ablation|" + key, 15))
    .toString()
    .padStart(16, "0")
    .slice(-16);
  const base = "TR00" + "000000" + account; // nonexistent 00000 bank code; no payment account
  const value =
    "TR" + String(98 - mod97(base)).padStart(2, "0") + base.slice(4);
  if (mod97(value) !== 1) throw Error("Invalid ablation checksum");
  return value;
}

export function ablationPlan() {
  const selected = makeSpecs().filter((s) =>
    s.slots.some((v) => ["national_id", "iban"].includes(v.category)),
  );
  const records = selected.flatMap((spec) =>
    ["reserved_invalid", "checksum_valid"].map((format) => {
      const record = structuredClone(spec);
      record.id = `${spec.id}_format_${format}`;
      record.source_release_id = spec.id;
      record.source = "fully_synthetic_unrendered_format_ablation";
      record.format_slice = format;
      record.rendered = false;
      record.annotations_valid = false;
      record.human_verified = false;
      record.leakage_group_id = spec.leakage_group_id;
      if (format === "checksum_valid")
        for (const slot of record.slots) {
          if (slot.category === "national_id")
            slot.value = checksumNationalId(spec.pair_id + slot.id);
          if (slot.category === "iban" && slot.sensitive)
            slot.value = checksumIban(spec.pair_id + slot.id);
        }
      return record;
    }),
  );
  return {
    status: "UNRENDERED_RESEARCH_PLAN",
    records,
    images_generated: 0,
    training: false,
    limitations:
      "No real records or lookup. A generated checksum-valid ID can coincide with an assigned ID; no non-collision guarantee. IBAN bank code is nonexistent. New DOM boxes/render review required. Keep all formats, both arms and derivatives in the same source split. Not a v0.2 model result.",
  };
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const output = resolve("examples/output/format-ablation-plan.json");
  await mkdir(resolve("examples/output"), { recursive: true });
  await writeFile(output, JSON.stringify(ablationPlan(), null, 2) + "\n", {
    flag: "wx",
  });
  console.log(
    JSON.stringify({
      status: "UNRENDERED_RESEARCH_PLAN",
      output,
      images_generated: 0,
    }),
  );
}

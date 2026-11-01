/** Candidate-text diagnostics with oracle boxes. This is not full-image OCR. */
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ROOT } from "../src/plan.mjs";
import { sha256 } from "../src/specs.mjs";
import { score } from "../src/evaluate.mjs";

export function chooseLiteral(category, value) {
  switch (category) {
    case "email":
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    case "credential_uri":
      return /^[a-z]+:\/\/[^:]+:[^@]+@/i.test(value) && !value.includes("${");
    case "private_key":
      return value.includes("BEGIN PRIVATE KEY");
    case "phone":
      return /^\+90[ (]/.test(value);
    case "iban":
      return /^TR\d{2}/.test(value);
    case "national_id":
      return /^\d{11}$/.test(value);
    case "verification_code":
      return /^\d{6}$/.test(value);
    case "api_token":
      return /^(?:[a-f\d]{32}|v2\.|b2ZmbGluZS)/.test(value);
    case "password":
      return /![a-f\d]{12}#$/.test(value);
    default:
      return false;
  }
}

export function baselinePredictions(records, mode) {
  if (!["literal_only", "visible_role_rules"].includes(mode))
    throw Error("Unknown baseline");
  return records.map((record) => ({
    id: record.id,
    predictions: record.candidates
      .filter((candidate) => {
        const slot = record.slots.find((s) => s.id === candidate.candidate_id);
        if (!slot) throw Error("Missing candidate text");
        // Never read sensitive/arm/annotations. Roles are provided oracle text too.
        if (mode === "literal_only")
          return chooseLiteral(slot.category, slot.value);
        return /erişim|anahtar|parola|şifre|yetkilendirme|kişisel|kullanıcı e-postası|iletişim|cep telefonu|kimlik|tckn|alıcı|maaş|ödeme hesabı|çalışan adı|hesap sahibinin|kişinin adı|tek kullanımlık|doğrulama kodu|oturum onay|access token|api credential|authorization|password|passphrase|user email|personal email|contact|mobile phone|identity|citizen id|beneficiary|payroll|payout account|employee full name|account holder name|person name|one-time code|verification code|login confirmation|database connection|connection string|service dsn|veritabanı bağlantısı|bağlantı dizesi|servis bağlantısı|private key|signing key/i.test(
          slot.role,
        );
      })
      .map((candidate) => ({
        class_id: candidate.class_id,
        bbox: candidate.bbox,
        score: 1,
      })),
  }));
}

export async function runBaselines() {
  const bytes = await readFile(resolve(ROOT, "metadata/manifest.jsonl"));
  const records = bytes
    .toString()
    .trim()
    .split("\n")
    .map(JSON.parse)
    .filter((r) => r.split === "test" && r.variant === "clean");
  const results = {};
  for (const mode of ["literal_only", "visible_role_rules"])
    results[mode] = await score(records, baselinePredictions(records, mode), {
      pixels: false,
    });
  const report = {
    scope:
      "Oracle candidate boxes/class hints/transcription; second baseline also sees oracle visible-role transcription. Neither performs OCR or reads image pixels. Rules were written after public release and are not blind/pre-registered. No trained model, inference or credit. Not detector performance.",
    manifest_sha256: sha256(bytes),
    split: "test",
    variant: "clean",
    results,
  };
  const directory = resolve(ROOT, "docs/baselines");
  await mkdir(directory, { recursive: true });
  await writeFile(
    resolve(directory, "oracle-text-rules.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(
    JSON.stringify(
      Object.fromEntries(
        Object.entries(results).map(([name, r]) => [
          name,
          { ...r.overall, pair_pass_rate: r.contrastive_pairs.pass_rate },
        ]),
      ),
    ),
  );
  return report;
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  await runBaselines();

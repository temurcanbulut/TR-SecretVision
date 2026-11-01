/** Full-image baselines consume OCR text/word geometry only, never dataset fields.
 * Rules are deliberately simple and written after the release was public.
 * There is no claim of blind evaluation, complete PII detection or redaction safety.
 */
export const OCR_RULE_CONFIG = Object.freeze({
  version: "windows-ocr-rules-v1",
  padding: 2,
  contextVerticalPixels: 48,
  contextHorizontalPixels: 620,
});

const rules = [
  ["email", /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g],
  ["credential_uri", /(?:postgresql|postgres|mysql|redis):\/\/[^\s]+/gi],
  [
    "api_token",
    /\b(?:[a-f\d]{32,64}|v2\.[a-f\d]{12}\.[a-f\d]{20}|b2ZmbGluZS[A-Za-z0-9_-]{20,})\b/gi,
  ],
  ["password", /[\p{L}]+![a-f\d]{8,32}#/gu],
  ["phone", /(?:\+90|0090)[ ()-]*\d{3}[ ()-]*\d{3}[ -]*\d{2}[ -]*\d{2}/g],
  ["national_id", /(?<!\d)\d{11}(?!\d)/g],
  ["iban", /TR\d{2}(?: ?[A-Z0-9]){22}(?![A-Z0-9])/gi],
  ["verification_code", /(?<!\d)\d{6}(?!\d)/g],
  [
    "private_key",
    /-----BEGIN(?: [A-Z]+)? PRIVATE KEY-----|-----END(?: [A-Z]+)? PRIVATE KEY-----/g,
  ],
  [
    "person_name",
    /\b[A-ZÇĞİÖŞÜ][a-zçğıöşü]{2,}\s+[A-ZÇĞİÖŞÜ][a-zçğıöşü]{2,}\b/gu,
  ],
];

const roleRules = {
  api_token:
    /erişim belirteci|api anahtarı|servis yetkilendirmesi|access token|api credential|service authorization/i,
  password:
    /hesap parolası|veritabanı parolası|oturum şifresi|account password|database password|login passphrase/i,
  email:
    /kullanıcı e.?postası|kişisel e.?posta|iletişim adresi|user email|personal email|contact address/i,
  credential_uri:
    /veritabanı bağlantısı|bağlantı dizesi|servis bağlantısı|database connection|connection string|service dsn/i,
  private_key: /özel anahtar|imzalama anahtarı|private key|signing key/i,
  phone:
    /cep telefonu|iletişim telefonu|kişisel telefon|mobile phone|contact phone|personal phone/i,
  national_id: /kimlik|tckn|identity|citizen id/i,
  iban: /alıcı iban|maaş hesabı|ödeme hesabı|beneficiary iban|payroll account|payout account/i,
  person_name:
    /çalışan adı|hesap sahibinin|kişinin adı|employee full name|account holder name|person name/i,
  verification_code:
    /tek kullanımlık|doğrulama kodu|oturum onay|one.time code|verification code|login confirmation/i,
};
const benignRole =
  /iş referansı|derleme numarası|belge sıra|job reference|build number|document sequence|proje adı|çalışma alanı adı|paket adı|project name|workspace name|package name|içerik özeti|paket özeti|artefakt kimliği|content digest|package hash|artifact identifier|derleme etiketi|sürüm etiketi|kanal adı|build label|release label|channel name|kuyruk sıra|işlem sürüm|paket revizyon|queue sequence|operation revision|bundle revision|değişkeni|variable|şablonu|template|açık anahtar|public key/i;

function lineRecord(line) {
  let text = "";
  const words = [];
  for (const word of line.words) {
    const start = text.length;
    text += word.text;
    words.push({ ...word, start, end: text.length });
    text += " ";
  }
  if (!words.length) return null;
  const left = Math.min(...words.map((w) => w.bbox[0])),
    top = Math.min(...words.map((w) => w.bbox[1]));
  return {
    text,
    words,
    box: [
      left,
      top,
      Math.max(...words.map((w) => w.bbox[0] + w.bbox[2])) - left,
      Math.max(...words.map((w) => w.bbox[1] + w.bbox[3])) - top,
    ],
  };
}

function spanBox(words, start, end, width, height) {
  const selected = words.filter((w) => w.end > start && w.start < end);
  if (!selected.length) return null;
  const x = Math.max(
    0,
    Math.floor(Math.min(...selected.map((w) => w.bbox[0]))) - 2,
  );
  const y = Math.max(
    0,
    Math.floor(Math.min(...selected.map((w) => w.bbox[1]))) - 2,
  );
  const right = Math.min(
    width,
    Math.ceil(Math.max(...selected.map((w) => w.bbox[0] + w.bbox[2]))) + 2,
  );
  const bottom = Math.min(
    height,
    Math.ceil(Math.max(...selected.map((w) => w.bbox[1] + w.bbox[3]))) + 2,
  );
  return [x, y, right - x, bottom - y];
}

export function predictOcr(ocr, classes, mode = "literal") {
  if (!["literal", "context"].includes(mode)) throw Error("Unknown OCR mode");
  const lines = ocr.lines.map(lineRecord).filter(Boolean),
    output = [];
  for (const line of lines)
    for (const [category, regex] of rules) {
      for (const match of line.text.matchAll(
        new RegExp(regex.source, regex.flags),
      )) {
        const box = spanBox(
          line.words,
          match.index,
          match.index + match[0].length,
          ocr.width,
          ocr.height,
        );
        if (!box) continue;
        if (mode === "context") {
          const nearby = lines.filter(
            (other) =>
              Math.abs(other.box[1] - box[1]) <=
                OCR_RULE_CONFIG.contextVerticalPixels &&
              other.box[0] <= box[0] + 40 &&
              other.box[0] + other.box[2] >=
                box[0] - OCR_RULE_CONFIG.contextHorizontalPixels,
          );
          nearby.sort(
            (a, b) => Math.abs(a.box[1] - box[1]) - Math.abs(b.box[1] - box[1]),
          );
          const context = nearby.map((l) => l.text).join("\n");
          if (
            !roleRules[category].test(context) ||
            benignRole.test(nearby[0]?.text ?? "")
          )
            continue;
        }
        const item = {
          class_id: classes.indexOf(category),
          bbox: box,
          score: 1,
        };
        if (item.class_id < 0) throw Error("Missing class");
        if (
          !output.some(
            (p) =>
              p.class_id === item.class_id &&
              p.bbox.every((v, i) => v === box[i]),
          )
        )
          output.push(item);
      }
    }
  return output;
}

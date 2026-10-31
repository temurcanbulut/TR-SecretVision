import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ROOT } from './plan.mjs';
import { CLASSES, sha256 } from './specs.mjs';
const read=async p=>JSON.parse(await readFile(resolve(ROOT,p),'utf8'));
const q=await read('qa/validation_report.json'),s=q.stats,records=(await readFile(resolve(ROOT,'metadata/manifest.jsonl'),'utf8')).trim().split('\n').map(JSON.parse);
const pairs=(await readFile(resolve(ROOT,'metadata/pairs.jsonl'),'utf8')).trim().split('\n').map(JSON.parse);
const exact=pairs.flatMap(p=>p.focal_candidates).filter(c=>c.pair_kind==='identical_payload_context').length;
const visual=await read('qa/visual_review.json'),preservation=await read('qa/v0.1_preservation.json');
const initial=await read('qa/initial_similarity_audit.json'),structure=await read('qa/render_structure_report.json');
const splitRows=Object.entries(s.splits).map(([k,v])=>`| ${k} | ${v.images} | ${v.boxes} | ${v.logical_values} | ${v.negatives} |`).join('\n');
const classRows=CLASSES.map(c=>`| ${c} | ${s.classes[c]||0} | ${s.splits.train.classes[c]||0} | ${s.splits.val.classes[c]||0} | ${s.splits.test.classes[c]||0} |`).join('\n');
const canonical=records.filter(r=>r.variant==='clean'),neg=canonical.filter(r=>r.negative).length;
const summary={same_payload_context_pairs:exact,balanced_candidate_occurrences:exact*2,value_only_deterministic_accuracy_upper_bound:.5,
  bound_scope:'Identical-payload focal two-arm candidate classification only; not image detection accuracy or a measured baseline',
  clean_negatives:neg,clean_mixed_controls:canonical.filter(r=>r.arm==='control'&&!r.negative).length,
  canonical_class_counts:Object.fromEntries(CLASSES.map(c=>[c,canonical.reduce((n,r)=>n+r.slots.filter(s=>s.sensitive&&s.category===c).length,0)])),
  context_type_counts:s.pair_kinds};
const vocabulary=Object.fromEntries(CLASSES.map(category=>[category,Object.fromEntries(['tr','en'].map(language=>[language,{sensitive:[...new Set(canonical.flatMap(r=>r.slots).filter(s=>s.category===category&&s.language===language&&s.sensitive).map(s=>s.role))].sort(),benign:[...new Set(canonical.flatMap(r=>r.slots).filter(s=>s.category===category&&s.language===language&&!s.sensitive).map(s=>s.role))].sort()}]))]));
await writeFile(resolve(ROOT,'metadata/role_vocabulary.json'),JSON.stringify({scope:'Visible field vocabulary from generated fixtures; not an independently curated terminology corpus',classes:vocabulary},null,2)+'\n');
await writeFile(resolve(ROOT,'qa/contribution_summary.json'),JSON.stringify(summary,null,2)+'\n');
const text=`# Kalite ve katkı raporu — v0.2.0

Son durum: **${q.status}**. Bu rapor gerçek üretim ve doğrulama çıktılarından oluşturulmuştur. Tamamen sentetik araştırma adayıdır; yeni model performans sonucu değildir.

## Gerçek kapsam

${s.images} PNG = ${s.canonical_images} temel ekran + ${s.derived_images} ilişkili stres türevi. 600 temel çift, 10 uygulama ailesi, ${Object.keys(s.layouts).length} kompozisyon; ortak UI bileşenleri vardır. ${s.boxes} satır kutusu, ${s.logical_sensitive_values} hassas değer görünümü ve ${s.negatives} tamamen negatif ekran. Aynı mantıksal yükün çiftlerde/türevlerde tekrarları bağımsız varlık sayılmaz.

| Bölüm | Görsel | Kutu | Hassas değer görünümü | Negatif |
|---|---:|---:|---:|---:|
${splitRows}

| Sınıf | Değer görünümü | train | val | test |
|---|---:|---:|---:|---:|
${classRows}

Sınıf tablosu satır kutularını değil mantıksal değer görünümlerini sayar; çok satırlı PEM/bağlantı kutuları daha çok fragment üretir. Türevler bu tabloda kaynaklarının ek görünümleri olarak yer alır. Temel ekran sınıf sayıları qa/contribution_summary.json içindedir.

Dil: ${JSON.stringify(s.languages)}. Tema: ${JSON.stringify(s.themes)}. Kaynak font boyutu: ${JSON.stringify(s.font_sizes)}. Dönüşüm: ${JSON.stringify(s.variants)}.

## Önceki pilottan fark

| Özellik | v0.1 | v0.2 |
|---|---|---|
| Temel ekran | 200 | 1.200 |
| Ek stres türevi | 0 | 240; bağımsız gözlem sayılmaz |
| Sınıf | 4 | 10; Türkçe kişisel veri ve geliştirici sırları |
| Ana ekran türü | 4 | 10 |
| Düzen grubu | 24 | 40 kompozisyon; uygulama aileleri de ayrı tutulur |
| Eşleşmiş bağlam çiftleri | Yok | 600; ${exact} aynı içerikli odak alan çifti |
| Güvenli aday kutuları | Ayrı benchmark yok | Hedef kutularından ayrı aday metaverisi |
| Negatifler | 20, çoğunlukla maskeli/referans | ${s.negatives}; ayrıca ${summary.clean_mixed_controls} temel kontrol ekranında hassas çapa |
| Test metriği | Dört sınıflı eski OCR deneyi var | Henüz model değerlendirilmedi |

${exact} aynı içerikli alan çiftinde, dizgeyi tek başına gören ve iki görünümüne aynı kararı veren deterministik bir sınıflayıcı en fazla %50 doğruluk elde edebilir. Bu yalnızca dengeli aday alt kümesinin matematiksel özelliğidir; OCR sonucu, genel dedektör üst sınırı veya gerçek dünya kazancı değildir.

## Otomatik kontrol kanıtı

- Etiket sınıfları, bütün adayların kaynak metni, JSON kaçışları, fragment tamlığı, pozitif tamsayı koordinatlar, görüntü sınırları ve görünürlük kontrol edildi. YOLO koordinatları geri dönüştürülüp COCO ile aynı kaynak kutularına karşı doğrulandı.
- Bütün PNG ve maskeler CRC ile açıldı. Bozuk dosya ${s.corrupt_files}, birebir dosya yinelenmesi ${s.exact_file_duplicates}, birebir piksel yinelenmesi ${s.exact_pixel_duplicates}.
- ${q.near_duplicates.comparisons.toLocaleString('en-US')} görsel çifti pHash ile karşılaştırıldı. Eşik ≤6: ${q.near_duplicates.candidates} aday, bölümler arası ${q.near_duplicates.cross_split_candidates} aday. Ek 32×32 gri MAE ≤2 eşiğine uyan bölümler arası yüksek benzerlik: ${q.near_duplicates.cross_split_high_similarity}. Adayları otomatik “aynı görsel” saymıyoruz; qa/cross_split_near_candidates.json ayrıntıyı içerir.
- İlk üretim bu kontrolü geçemedi: ${initial.near_duplicates.cross_split_candidates} bölümler arası adayın ${initial.near_duplicates.cross_split_high_similarity} tanesi yüksek benzerlik eşiğine uyuyordu. En yakın tam boyutlu çiftler incelendi, ortak formlar/paneller yerine uygulamaya özgü çalışma alanları yeniden kuruldu. Yukarıdaki nihai sonuç aynı pHash/MAE eşikleriyle elde edildi; eşikler sonucu geçirmek için değiştirilmedi. Başarısız ilk rapor ve tasarım kararları açıkça saklandı.
- Yapısal kaynak denetimi ${structure.status}: 1.200 HTML senaryosunda ${structure.structured_json_blocks} yapılandırılmış JSON blok ve ${structure.inspected_code_objects} kaynak nesne görünümü parse edildi. ${structure.content_structure_signatures} tam içerik DOM imzası; bölümler arasında birebir aynı içerik yapısı ${structure.cross_split_identical_structures.length}. Bu test genel görsel/semantik bağımsızlığın kanıtı değildir.
- Uygulama, düzen, çift, kaynak kimliği ve üretilmiş yük ayrımları kontrol edildi. Ortak genel değişken adları / rol sözlüğü kimlik sayılmadı. Hiçbir küçük şablon varyasyonu başka bölüme taşınmadı.
- Karşıt raster silme ve saklanan maskelerin doğrulaması: ${s.target_ink_pixels.toLocaleString('en-US')} hedef glif pikseli; kutular dışında ${s.outside_target_box_pixels}. Güvenli adaylar da ayrı geometri/raster kontrolünden geçti. Bu, model sansür başarısı değil etiket geometrisi kanıtıdır.
- Sentetik kaynak ve biçim güvenlik ihlali ${s.synthetic_safety_violations}. TCKN/IBAN bilerek geçersiz; telefon 000 kodlu; alan adları .example; PEM gerçek kriptografik anahtar değil. Canlı anahtar, banka, nüfus veya telefon doğrulaması yapılmadı.
- Renderer dış ağ isteği 0; sayfa hatası 0. Üretim planı kaynak kodu özetleriyle eşleşti. 14 regresyon testi güvenlik ve skorlayıcıdaki somut hata sınıflarını denetler; model sonuçları değildir.
- Eski sürüm koruması: ${preservation.status}; ${preservation.data_files_checked} veri dosyası, ${preservation.frozen_sources_checked} dondurulmuş OCR kaynağı ve özgün pilot ZIP özeti değişmedi.

## Görsel denetim

İnceleyen: AI assistant. İnsan incelemesi yok. ${visual.contact_sheet_ids.length} son sürüm örneği 40 düzenden hash ile seçilmiş çiftlerin temas sayfalarında incelendi; ${visual.native_ids.length} örnek tam boyutta ayrıca açıldı. Stres örnekleri ve varsa benzerlik adayları görsel günlüğünde ayrı belirtilir. Bu kapsam tüm 1.440 örneğin insan/uzman kontrolü demek değildir. Tüm human_verified alanları false.

Gözlemler: ${visual.observations.join(' ')}

## Açık sınırlamalar

Kapalı sentetik gramer, sınırlı rol sözlüğü ve ortak UI bileşenleri öğrenilebilir. Kimlik/IBAN/telefonun güvenlik için geçersiz yapılması gerçek veri dağılımıyla fark yaratır. İsimlerin rastlantısal gerçek isimlerle çakışmaması kanıtlanamaz; hiçbir isim bir kişi kaydından alınmadı. Kırılmalar: boşluk/kaçış/PEM satırları ve küçük metin. Bulanıklık kutuları bilerek daha geniştir. Hukuki KVKK sınıflandırması ve gerçek dünya sızıntı riski ölçülmedi. İki test uygulaması geniş üretim evrenini temsil etmez. Görsel QA test düzenlerini açığa çıkarır; kör test iddiası yoktur.

Eski %96,25 recall bu sürümün sonucu değildir. Yeni model/OCR karşılaştırması ve uzman insan incelemesi yapılmadan “başarımı artırdık”, “üretime hazır” veya “dünyada ilk” iddiası kurulmaz. Veri setinin sonraki herkese açık EVREN durumu metadata/publication.json içindedir. Model eğitimi ve insan incelemesi yapılmadı.
`;
await writeFile(resolve(ROOT,'QUALITY_REPORT.md'),text);
// Distribution/publication status is maintained separately in metadata/publication.json.
console.log(JSON.stringify({report:q.status,same_payload_pairs:exact,images:s.images,visual_samples:visual.contact_sheet_ids.length}));

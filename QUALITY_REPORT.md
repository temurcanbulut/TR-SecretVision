# Kalite ve katkı raporu — v0.2.0

Son durum: **PASS**. Bu rapor gerçek üretim ve doğrulama çıktılarından oluşturulmuştur. Tamamen sentetik araştırma adayıdır; yeni model performans sonucu değildir.

## Gerçek kapsam

1440 PNG = 1200 temel ekran + 240 ilişkili stres türevi. 600 temel çift, 10 uygulama ailesi, 40 kompozisyon; ortak UI bileşenleri vardır. 4255 satır kutusu, 2916 hassas değer görünümü ve 342 tamamen negatif ekran. Aynı mantıksal yükün çiftlerde/türevlerde tekrarları bağımsız varlık sayılmaz.

| Bölüm | Görsel | Kutu | Hassas değer görünümü | Negatif |
|---|---:|---:|---:|---:|
| test | 360 | 1013 | 728 | 86 |
| train | 720 | 1973 | 1464 | 168 |
| val | 360 | 1269 | 724 | 88 |

| Sınıf | Değer görünümü | train | val | test |
|---|---:|---:|---:|---:|
| api_token | 296 | 148 | 79 | 69 |
| password | 353 | 160 | 114 | 79 |
| email | 389 | 207 | 110 | 72 |
| credential_uri | 283 | 134 | 93 | 56 |
| private_key | 349 | 162 | 111 | 76 |
| phone | 230 | 115 | 40 | 75 |
| national_id | 207 | 102 | 32 | 73 |
| iban | 201 | 100 | 27 | 74 |
| person_name | 241 | 113 | 38 | 90 |
| verification_code | 367 | 223 | 80 | 64 |

Sınıf tablosu satır kutularını değil mantıksal değer görünümlerini sayar; çok satırlı PEM/bağlantı kutuları daha çok fragment üretir. Türevler bu tabloda kaynaklarının ek görünümleri olarak yer alır. Temel ekran sınıf sayıları qa/contribution_summary.json içindedir.

Dil: {"mixed":480,"en":476,"tr":484}. Tema: {"light":732,"dark":708}. Kaynak font boyutu: {"12":360,"14":352,"16":380,"18":348}. Dönüşüm: {"clean":1200,"blur_070":120,"downscale_065":120}.

## Önceki pilottan fark

| Özellik | v0.1 | v0.2 |
|---|---|---|
| Temel ekran | 200 | 1.200 |
| Ek stres türevi | 0 | 240; bağımsız gözlem sayılmaz |
| Sınıf | 4 | 10; Türkçe kişisel veri ve geliştirici sırları |
| Ana ekran türü | 4 | 10 |
| Düzen grubu | 24 | 40 kompozisyon; uygulama aileleri de ayrı tutulur |
| Eşleşmiş bağlam çiftleri | Yok | 600; 902 aynı içerikli odak alan çifti |
| Güvenli aday kutuları | Ayrı benchmark yok | Hedef kutularından ayrı aday metaverisi |
| Negatifler | 20, çoğunlukla maskeli/referans | 342; ayrıca 320 temel kontrol ekranında hassas çapa |
| Test metriği | Dört sınıflı eski OCR deneyi var | Henüz model değerlendirilmedi |

902 aynı içerikli alan çiftinde, dizgeyi tek başına gören ve iki görünümüne aynı kararı veren deterministik bir sınıflayıcı en fazla %50 doğruluk elde edebilir. Bu yalnızca dengeli aday alt kümesinin matematiksel özelliğidir; OCR sonucu, genel dedektör üst sınırı veya gerçek dünya kazancı değildir.

## Otomatik kontrol kanıtı

- Etiket sınıfları, bütün adayların kaynak metni, JSON kaçışları, fragment tamlığı, pozitif tamsayı koordinatlar, görüntü sınırları ve görünürlük kontrol edildi. YOLO koordinatları geri dönüştürülüp COCO ile aynı kaynak kutularına karşı doğrulandı.
- Bütün PNG ve maskeler CRC ile açıldı. Bozuk dosya 0, birebir dosya yinelenmesi 0, birebir piksel yinelenmesi 0.
- 1,036,080 görsel çifti pHash ile karşılaştırıldı. Eşik ≤6: 3937 aday, bölümler arası 0 aday. Ek 32×32 gri MAE ≤2 eşiğine uyan bölümler arası yüksek benzerlik: 0. Adayları otomatik “aynı görsel” saymıyoruz; qa/cross_split_near_candidates.json ayrıntıyı içerir.
- İlk üretim bu kontrolü geçemedi: 1383 bölümler arası adayın 1084 tanesi yüksek benzerlik eşiğine uyuyordu. En yakın tam boyutlu çiftler incelendi, ortak formlar/paneller yerine uygulamaya özgü çalışma alanları yeniden kuruldu. Yukarıdaki nihai sonuç aynı pHash/MAE eşikleriyle elde edildi; eşikler sonucu geçirmek için değiştirilmedi. Başarısız ilk rapor ve tasarım kararları açıkça saklandı.
- Yapısal kaynak denetimi PASS: 1.200 HTML senaryosunda 120 yapılandırılmış JSON blok ve 120 kaynak nesne görünümü parse edildi. 80 tam içerik DOM imzası; bölümler arasında birebir aynı içerik yapısı 0. Bu test genel görsel/semantik bağımsızlığın kanıtı değildir.
- Uygulama, düzen, çift, kaynak kimliği ve üretilmiş yük ayrımları kontrol edildi. Ortak genel değişken adları / rol sözlüğü kimlik sayılmadı. Hiçbir küçük şablon varyasyonu başka bölüme taşınmadı.
- Karşıt raster silme ve saklanan maskelerin doğrulaması: 6,600,276 hedef glif pikseli; kutular dışında 0. Güvenli adaylar da ayrı geometri/raster kontrolünden geçti. Bu, model sansür başarısı değil etiket geometrisi kanıtıdır.
- Sentetik kaynak ve biçim güvenlik ihlali 0. TCKN/IBAN bilerek geçersiz; telefon 000 kodlu; alan adları .example; PEM gerçek kriptografik anahtar değil. Canlı anahtar, banka, nüfus veya telefon doğrulaması yapılmadı.
- Renderer dış ağ isteği 0; sayfa hatası 0. Üretim planı kaynak kodu özetleriyle eşleşti. 14 regresyon testi güvenlik ve skorlayıcıdaki somut hata sınıflarını denetler; model sonuçları değildir.
- Eski sürüm koruması: PASS; 404 veri dosyası, 4 dondurulmuş OCR kaynağı ve özgün pilot ZIP özeti değişmedi.

## Görsel denetim

İnceleyen: AI assistant. İnsan incelemesi yok. 80 son sürüm örneği 40 düzenden hash ile seçilmiş çiftlerin temas sayfalarında incelendi; 14 örnek tam boyutta ayrıca açıldı. Stres örnekleri ve varsa benzerlik adayları görsel günlüğünde ayrı belirtilir. Bu kapsam tüm 1.440 örneğin insan/uzman kontrolü demek değildir. Tüm human_verified alanları false.

Gözlemler: Ekranlar kapalı sentetik uygulama fikstürleri; ortak tablo/form bileşenleri ve geniş boş çalışma alanları belirgin. Benzerlik kontrolü sonrasında doğrulama/test uygulamaları menü/katalog, malzeme-sürüm, üç bölmeli destek masası ve yerel hata çalışma alanlarıyla yeniden kuruldu; yenilenen örnekler tekrar açıldı. Hassas kol ile kontrol kolunun metin stili aynı; kutular yalnız hedef değerlerin üzerinde. Kontrol kolunda değişmeyen hassas çapalar bulunabiliyor. Türkçe karakterler ve doğal ad listesi / üretilmiş soyadı birleşimleri açılan örneklerde görüntüleniyor; bunlar gerçek kişi kaydı değil. Küçültme küçük metni belirgin zorlaştırıyor; bulanıklıkta glif kenarları yayılıyor. Bu iki dilim temiz başarıyla birleştirilerek gizlenmemeli. Native ve temas sayfası incelemesi insan doğrulaması veya gerçek dünya güvenlik kanıtı değildir.

## Açık sınırlamalar

Kapalı sentetik gramer, sınırlı rol sözlüğü ve ortak UI bileşenleri öğrenilebilir. Kimlik/IBAN/telefonun güvenlik için geçersiz yapılması gerçek veri dağılımıyla fark yaratır. İsimlerin rastlantısal gerçek isimlerle çakışmaması kanıtlanamaz; hiçbir isim bir kişi kaydından alınmadı. Kırılmalar: boşluk/kaçış/PEM satırları ve küçük metin. Bulanıklık kutuları bilerek daha geniştir. Hukuki KVKK sınıflandırması ve gerçek dünya sızıntı riski ölçülmedi. İki test uygulaması geniş üretim evrenini temsil etmez. Görsel QA test düzenlerini açığa çıkarır; kör test iddiası yoktur.

Eski %96,25 recall bu sürümün sonucu değildir. Yeni model/OCR karşılaştırması ve uzman insan incelemesi yapılmadan “başarımı artırdık”, “üretime hazır” veya “dünyada ilk” iddiası kurulmaz. Veri seti daha sonra EVREN üzerinde teknik aktarım kontrolünden geçirildi ve herkese açık yayımlandı. Bu kaynak kalite raporu model değerlendirmesi değildir; güncel dağıtım durumu metadata/publication.json içindedir.

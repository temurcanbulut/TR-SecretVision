# Dataset card — v0.2.0

## Köken ve amaç

TR-SecretVision Context; geliştirici araçları ve Türkçe kişisel veri iş akışlarında, hassas alanın sınırlarını bulurken benzer güvenli değerleri korumayı ölçer. Tüm ekranlar HTML/CSS ile sıfırdan çizilmiştir. Gerçek kurum ekranları, hesaplar, mesajlar, kullanıcı tarayıcı profili veya dış veri seti örnekleri kullanılmaz. Koleksiyon tarihi yoktur; üretim çalışması 31 Ekim 2026 tarihinde başlatılmıştır. Kesin ortam bilgisi `metadata/environment.json` içindedir.

## Birimler ve kapsam

600 senaryo × hassas / kontrol kolu = 1.200 temel ekran. Doğrulama ve testten 30'ar çiftin iki koluna iki dönüşüm uygulanır: 0,65 ölçek ve CSS 0,7 px Gaussian blur; toplam 240 türev. Bu türevler temiz kaynaklarından bağımsız değildir. Görsel dosya sayısı veri çeşitliliğinin tek ölçüsü olarak sunulmaz.

10 uygulama ailesi, her birinde 4 kompozisyon ve 15 senaryo vardır. Kompozisyonlar tablo, form, ağaç, kod, günlük ve diyalog bileşenlerini paylaşır. Her uygulama gerçek bir ürünün bağımsız kod tabanı değildir. Finans ve çalışan kayıtları kişisel veri sınıflarıyla, geliştirici araçları çoğunlukla sır sınıflarıyla oluşturulur. Veri tabanı, destek ve hata ekranları karma bağlamdır.

Temiz ekranlar 1280×800, 1366×864, 1440×900 ve 1536×960; kaynak metin 12/14/16/18 px; iki font eşlemesi ve açık/koyu temalar. Türkçe, İngilizce ve karma alan adları kullanılır. Kapsam gerçek hayatın dil, erişilebilirlik, font, sıkıştırma ve cihaz çeşitliliğini temsil etmez.

Aynı seed farklı işletim sistemi/Chromium sürümünde bit düzeyinde aynı PNG garantisi vermez; font rasterizasyonu ve Canvas filtre uygulaması değişebilir. Kaynak grameri deterministiktir, çalışma ortamı kaydedilir ve SHA256 özetleri dağıtılan somut dosyaları tanımlar.

## Etiket taksonomisi

| YOLO | COCO | Sınıf | Hedef politika |
|---:|---:|---|---|
| 0 | 1 | api_token | Yetkilendirme bağlamında görünen literal belirteç |
| 1 | 2 | password | Parola/şifre olarak gösterilen açık değer |
| 2 | 3 | email | Kişiye ait hesap/iletişim alanında görünen açık e-posta |
| 3 | 4 | credential_uri | Açık kullanıcı/parola içeren bağlantının tamamı; iç içe parola etiketi yok |
| 4 | 5 | private_key | Özel PEM başlığı, gövdesi ve bitiş işaretçisi; gövde gerçek anahtar değildir |
| 5 | 6 | phone | Kişisel telefon alanındaki tam sentetik değer |
| 6 | 7 | national_id | Kimlik alanındaki bilerek geçersiz TCKN benzeri değer |
| 7 | 8 | iban | Alıcı/maaş hesabındaki bilerek geçersiz TR IBAN benzeri değer |
| 8 | 9 | person_name | Kişi adı rolündeki üretilmiş isim |
| 9 | 10 | verification_code | Oturum/doğrulama rolündeki üretilmiş tek kullanımlık kod |

Fiziksel belge, yüz, adres, kart numarası, sağlık verisi, biyometri ve gerçek hizmet sağlayıcı anahtar biçimleri kapsam dışıdır. Bir değerin bu sentetik evrende geçersiz olması onu etiketten çıkarmaz: etiket görünür rolü temel alır. Bu bir hukuki KVKK sınıflandırması değildir; görev için açıkça seçilmiş sansür politikasıdır.

## Karşıt örnek politikası

Bu kontroller bilerek zor kurulmuştur; gerçek uygulamalardaki sıklığı veya hassasiyet dağılımını temsil etmez. Örneğin serbest metinli bir derleme etiketi, parola görünümünü taklit edebilir; bundan bütün paket sistemlerinin bu dizgeyi geçerli sürüm numarası kabul ettiği sonucu çıkarılmaz.

API belirteci, parola, TCKN, kişi adı ve doğrulama kodunda **aynı dizge**, görünür alan adı değişince güvenli teknik tanımlayıcı olur. Örneğin `Person name` hassas, `Project name` güvenlidir. Kaynak belgeye yazılmış bir sırın otomatik güvenli olduğu varsayılmaz. Alan rolü dışında gizli metaveriye dayanan etiket yoktur.

E-posta / telefon / IBAN / bağlantı kontrolleri `${USER_EMAIL}` gibi değişken referanslarıdır. Özel anahtar kontrollerinde yalnızca PRIVATE/PUBLIC işaretçisi ve görünür alan rolü değişir; geçersiz ASCII gövde aynıdır. Bunlar ayrı `pair_kind` olarak raporlanır. Sabit `ops@atlas.example` bir hizmet istemi, kişi e-postası değildir. Tamamen gizlenmiş veya yalnızca referans içeren değerler hedef değildir. İleride belirsiz kamuya açık kişisel veri örnekleri ayrı insan incelemesi gerektirir; bu sürümde bulunmaz.

## Bölümleme ve sızıntı

| Bölüm | Uygulamalar | Temel | Türev | Toplam |
|---|---|---:|---:|---:|
| train | terminal, ide, ci, http, people, finance | 720 | 0 | 720 |
| val | database, vault | 240 | 120 | 360 |
| test | support, error | 240 | 120 | 360 |

Bu, yeni uygulama ailesine aktarımı araştıran zorlu bir ayrımdır; bütün alanların testte aynı oranda temsili yoktur. Aynı ana şablonun küçük varyasyonları bölümler arasında dağılmaz. `application_group_id`, `leakage_group_id`, `pair_id`, `source_identity_group`, kaynak yük kimliği ve değişken referansları dışındaki üretilmiş değerler bölümler arasında kesişmez. Ortak alan sözlüğü, fontlar ve UI bileşenleri paylaşılır. Birkaç yüz eşsiz ekran binlerce bağımsız iş akışına eşit değildir.

İlk benzerlik taramasının ardından ortak ofis paneline fazla benzeyen doğrulama/test arayüzleri uygulamaya özgü veri tabanı, sır deposu, destek masası ve hata çalışma alanlarına dönüştürüldü. Bu nedenle uygulama ve görsel stil değişimleri birlikte gerçekleşir; gelecekteki bir model sonucunu yalnızca bağlam anlayışına bağlamak mümkün değildir. Eş içi karşıt karar skoru bu değişkenlerden daha dar bir soruyu ölçer. İlk başarısız tarama ve düzeltme süreci `DESIGN.md` içinde kayıtlıdır.

Test üretim kodu ve etiketleri açık olduğundan gizli liderlik tablosu testi değildir. Bu geliştirme sırasında test düzenleri görsel QA için görülmüştür; sonuçlar kör test olarak adlandırılamaz. v0.1 test ekranları önceki yöntem geliştirmede görülmüştü; v0.2 ayrı üretilmiş olsa da mutlak yeni gerçek dünya doğrulaması değildir.

## Hassas içerik üretim önlemleri

- E-posta ve ağ uçları RFC 2606 `.example` alanında kalır; hiçbir adrese istek/mesaj gönderilmez.
- TCKN değerleri 0 ile başlar ve 1 ile biter; yerel kontrol basamakları da denetlenir. Gerçek kayıt sorgulanmaz.
- TR IBAN 26 karakteri taklit eder, MOD97 sonucu bilerek 1 değildir. Hesap doğrulama/ödeme işlemi yapılmaz.
- Telefonlarda +90 altında 000 hedef kodu kullanılır; gerçek abone numarası toplanmaz veya aranmaz.
- PEM gövdesi `OFFLINE-FIXTURE-NOT-A-KEY:` ile başlayan ASCII'nin Base64 biçimidir; DER anahtarı üretilmez.
- Belirteçler, parolalar ve OTP'ler deterministik dizgelerdir; hiçbir hizmet tarafından verilmiş veya bir hizmette sınanmış değildir.
- İsimler kapalı bir ad listesi ve soyadı parçalarından üretilir; kimliği olan kişilerden alınmaz. Dünyada aynı isimde biri bulunmadığını, rastgele bir kodun hiçbir aktif OTP ile çakışmadığını kanıtlamak mümkün değildir. İddia kaynak ve ilişkilendirme üzerinedir.

Geçersiz biçimler güvenlik için seçilmiştir ve **öğrenilebilir kestirme yollar oluşturabilir**. Eşleşen teknik kontrol değerleri bazı kestirmeleri azaltır; tümünü ortadan kaldırmaz. Geçerli gerçek TCKN/IBAN/telefon biçimlerine genelleme ölçülmemiştir.

## Etiket kalitesi ve kısıtlar

Kutular tarayıcı DOM karakter aralıklarından, çizim tamamlandıktan sonra alınır; her görünen satır ayrı fragmenttir. İki piksel temiz ekran payı vardır. Türevlerde koordinat dönüşümü ve ek taşma payı uygulanır; karşıt raster kontrolleri tüm örneklerde çalışır. Kaçışlı JSON metni ekranda görünen `\\n` dizgesine göre etiketlenir. OCR transkripsiyonu, varlık tanıma ve kutu bulma aynı metrik değildir.

İnsan incelemesi yapılmadı: bütün `human_verified` alanları false. Rastgele/katmanlı AI görsel incelemesi ve otomatik kontroller `QUALITY_REPORT.md` içindedir. Henüz gerçek dünya örnekleri, dış veri seti aktarım deneyi, eğitilmiş model, uzmanlar arası etiket tutarlılığı veya hukuki uygunluk sertifikası yoktur. Üretim kullanımında insan kararı ve bağımsız test gerekir.

## Lisans ve dağıtım

Veri CC BY 4.0; kod MIT; fontlar OFL. Tam paket üretim kodunu ve açık etiketleri içerir. Veri seti 31 Ekim 2026 tarihinde kullanıcı onayıyla EVREN üzerinde herkese açık yayımlandı. Bu depo dağıtımı kodu, tüm metaveriyi, etiketleri, maskeleri ve 20 değişmemiş örneği içerir; 1.440 görselin tamamını içermez. Ayrıntılar `NOTICE.md`, `EVREN_IMPORT.md` ve `RESEARCH_PROTOCOL.md`.

## 2026-11-01 tarihli OCR değerlendirme eki

240 temiz test görüntüsüne yerleşik Windows OCR (tr) uygulanmış ve iki sabit
kural hattı değerlendirilmiştir; [tam protokol](docs/FULL_IMAGE_OCR.md).
Değer kuralları P/R %25,93/%26,88; alan rolü kuralları %97,26/%20,97. IoU≥0,5
fragment eşleşmesidir; sansür eksiksizliği veya gerçek dünya başarısı değildir.
Algılayıcı eğitilmedi, ücretli çıkarım veya EVREN kredisi kullanılmadı; yerel OS
OCR çıkarımı yapıldı. Etiket ve v0.2 yayın metaverisi değiştirilmedi. İnsan
doğrulaması hâlâ sıfırdır. Oracle metin tabloları bu OCR sonuçlarıyla karıştırılmaz.

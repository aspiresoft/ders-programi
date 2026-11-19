# Ders Programı Editörü — Spesifikasyon (v1)

Tarih: 2026-11-19

## 1. Amaç

Hazır bir okul ders programını teknik bilgisi olmayan kişilerin (okul müdürü, müdür yardımcıları) **tarayıcıda, fare ile, sürükle-bırak** yöntemiyle küçük değişikliklerle güncelleyebilmesi.

Bu bir **ders programı hazırlama aracı değildir**. Program FET ile hazırlanır. Bu araç yalnızca:

1. FET'ten (`*_data_and_timetable.fet`) okul için başlangıç PDF'lerini üretir (programı hazırlayan kişi kullanır),
2. Üretilmiş PDF'leri açar, düzenletir ve yeni versiyon olarak kaydeder (müdür kullanır),
3. Mevcut (eski Python script'leriyle üretilmiş) PDF'leri de açıp düzenletebilir.

### Tasarım ilkesi

Kullanıcılar teknik bilgisi olmayan kişilerdir. Arayüz **sade** olmalı: az buton, kısa ve Türkçe etiketler, gereksiz bilgi ve detay yok. İleri ayarlar (saat profilleri, okul bilgileri) ayrı bir "Ayarlar" ekranında saklı durur; ana ekranda sadece programlar, sürükle-bırak ve uyarılar görünür.

## 2. Platform

- Tek sayfalık **statik web uygulaması**; GitHub Pages'te barındırılır. Sunucu yok.
- Tüm işlemler kullanıcının Chrome/Edge tarayıcısında (masaüstü) yapılır; dosyalar hiçbir yere yüklenmez.
- Fare ile kullanım; tablet/dokunmatik desteği kapsam dışı.
- Kütüphaneler: `pdf-lib` (+ `@pdf-lib/fontkit`) PDF üretimi ve veri eki, `pdf.js` eski PDF'leri okumak için. Türkçe karakter destekli bir yazı tipi PDF'e gömülür.

## 3. Çıktılar

Her kayıtta **iki PDF** birlikte üretilir:

- `<okul>_siniflar_v<N>.pdf` — her sınıf için bir A4 yatay sayfa
- `<okul>_ogretmenler_v<N>.pdf` — her öğretmen için bir A4 yatay sayfa
- (ileride, isteğe bağlı) `<okul>_dersler_v<N>.pdf` — yalnızca görüntüleme amaçlı

Kurallar:

- Versiyon numarası her kayıtta otomatik artar.
- Her sayfanın alt bilgisinde `Versiyon N – GG.AA.YYYY` yazar.
- Her iki PDF'in içine de **aynı program verisi** (JSON) gizli bir dosya eki olarak gömülür. Müdür hangisini açarsa açsın programın tamamı yüklenir.
- PDF'ler gerçek metin içerir (resim değil).
- Kaydetme doğrudan indirme şeklindedir. Chrome destekliyorsa "klasör seç" ile iki dosya aynı klasöre yazılır, desteklemiyorsa iki ayrı indirme yapılır.

## 4. Veri modeli

```
Program
├─ okul: { ad, başlık, logo(PNG, base64), günler[ "Pazartesi", … ] }
├─ saatProfilleri: { id → Profil }
├─ siniflar: [ { ad, profilId, rehberOgretmen } ]
├─ ogretmenler: [ { ad } ]
├─ dersler: [ Ders ]
├─ ayarlar: { haftalikSaatHaricKelimeler: ["ZÜMRE","ŞÖK","TOPLANTI", …] }
└─ meta: { versiyon, tarih, kaynak: "fet" | "eski-pdf" }

Profil
└─ satirlar: sıralı liste
     { tur: "ders", no: 1..n, bas: "09:35", bit: "10:15" }
     { tur: "sabit", ad: "KAHVALTI", bas: "09:00", bit: "09:35", renk }

Ders (bölünmez blok)
└─ { id, ad, siniflar[], ogretmenler[], gun, basDers(no), sure(ders sayısı) }
```

- Bir `Ders` birden fazla öğretmene (Rehberlik, toplantılar) ve birden fazla sınıfa (ortak dersler) ait olabilir. Sınıfı hiç olmayabilir (zümre ve benzeri toplantılar).
- Sınıf ve öğretmen sayfaları her zaman bu tek listeden **türetilir**. Bu yüzden bir değişiklik her iki görünüme anında yansır.
- Paralel ders (aynı sınıfta aynı saatte iki grup) desteklenmez.

## 5. Okul ayar dosyası (`okul.json`)

Her okul için bir dosya hazırlanır. FET'ten yeni program üretilirken kullanılır, sonra programın içinde (PDF'te) taşınır ve editörde değiştirilebilir. İçeriği:

- okul adı, sayfa başlığı ("MANİSA İSABET OKULLARI"), logo dosyası
- gün adları (FET'teki `D1` → `Pazartesi` eşlemesi)
- saat profilleri (ders saatleri ve sabit bölümler: kitap okuma, toplanma, kahvaltı, öğle, ikindi, etüt…)
- sınıf → profil eşlemesi (desen veya liste ile), sınıf başına rehber öğretmen adı
- haftalık saatten düşülecek anahtar kelimeler

## 6. Sayfa tasarımı

- Bugünkü Manisa tasarımı temel alınır: A4 yatay, logo, okul başlığı, ad, sağ üstte rozetler, renkli ders hücreleri, dikey yazılı sabit bölüm sütunları.
- Tüm ders, sınıf ve öğretmen metinleri **Türkçe kurallarına uygun büyük harf** ile yazılır (`i → İ`, `ı → I`).
- Renkler tek bir ortak anahtar kelime → renk tablosundan gelir ("DOĞA" fen rengindedir).
- **Sınıf sayfası:** sınıfın profiline göre sütunlar çizilir. Sağ üstte "Sınıf Rehber Öğretmeni" yazar; bilgi `okul.json`'dan gelir, boşsa gösterilmez. Hücrede ders adı, öğretmen(ler) ve saat yazar.
- **Öğretmen sayfası:** öğretmenin girdiği sınıfların profilleri birleştirilir.
  - Tek profil varsa sınıf sayfasıyla aynı düzen kullanılır.
  - Birden fazla profil varsa her ders numarası tek sütundur. Başlıkta farklı saatler `İ:09:20 / O:09:00` biçiminde gösterilir. Farklı profillerin sabit bölümleri ayrı sütunlar olarak (`ÖĞLE (İ)`, `ÖĞLE (O)`) zaman sırasıyla yerleştirilir.
  - Hücrede sınıf(lar), ders adı ve o dersin kendi profiline göre gerçek saati yazar.
  - Rozet: yalnızca **"Haftalık Ders Saati: N"**. Sınıfı olmayan ve anahtar kelimeye uyan dersler sayılmaz. Kademe rozeti yoktur.

## 7. Editör

### Açılış ekranı

- **PDF Aç:** uygulamanın ürettiği PDF'ler (veri eki varsa kayıpsız açılır) veya eski PDF'ler (bölüm 8).
- **FET'ten Yeni Program:** `.fet` ve `okul.json` seçilir.
- **Taslağı Kurtar:** kaydedilmemiş son çalışma tarayıcıda otomatik saklanır.

### Çalışma ekranı

- Solda sınıf ve öğretmen listesi. Birden fazla seçim yapılabilir; seçilen programlar **yan yana / alt alta** gösterilir (sınıf ve öğretmen karışık olabilir).
- **Sürükle-bırak:**
  - Boş saate bırakma → taşıma.
  - Tekli dersi tekli dersin üstüne bırakma → yer değiştirme.
  - Blok dersi tekli derslerin olduğu yere bırakma → oradaki dersler bloğun eski yerine geçer.
  - Hedef başka bir bloğu yarıda bölüyorsa işlem yapılır, uyarı verilir.
  - Blok dersler bölünmez. Ortak dersler, ait olduğu tüm sınıf ve öğretmenlerde birlikte taşınır.
- **Ders düzenleme paneli** (derse çift tıklayınca): ders adı, öğretmen(ler), sınıf(lar), süre. Ayrıca ders silme ve boş hücreye ders ekleme (tekli veya blok).
- **Yeni öğretmen ekleme:** yalnızca ad girilir; öğretmen için yeni bir sayfa oluşur.
- **Sınıf ekleme ve silme yoktur.**
- **Ayarlar:** okul bilgileri, logo, saat profilleri (sabit bölüm ekle/çıkar, saat ayarla, profili başka sınıflara kopyala/ata), rehber öğretmenler.
- **Geri al / yinele:** Ctrl+Z / Ctrl+Y.
- **Kaydet:** iki PDF indirilir, versiyon artar.

### Çakışma uyarıları (asla engellemez)

- Bir öğretmenin **gerçek saatleri örtüşen** iki dersi varsa (farklı profiller dahil).
- Bir sınıfın aynı saatte iki dersi varsa.
- Bir ders, sınıf profilinde olmayan bir ders saatine düşüyorsa.
- Bölünmüş blok varsa.

Gösterim: ilgili hücrelerde kırmızı çerçeve ve ⚠ ikonu, sabit bir "Uyarılar" paneli ve üst çubukta uyarı sayısı. Panelde bir uyarıya tıklanınca ilgili sınıf ve öğretmen programları yan yana açılır.

## 8. Eski PDF desteği (veri eki olmayan PDF'ler)

Eski Python script'leriyle üretilmiş Manisa, Gaziemir ve Bayraklı PDF'leri desteklenir.

- Kullanıcı **sınıflar ve öğretmenler PDF'lerini birlikte** seçer. Toplantılar yalnızca öğretmen PDF'inde bulunduğu için ikisi de gereklidir.
- Uygulamada: "PDF Aç" ile iki dosya birlikte seçilir (sıra önemli değil; dosya adından veya rozetlerden ayırt edilir). Logo PDF'ten çıkarılır; versiyon dosya adından (`versiyon_8`) alınır ve ilk kayıt `v9` olur.
- Eski "ETÜT" sütunu alınmaz.
- Okuma, metnin sayfadaki konumu ve yazı tipi boyutuna göre yapılır (satır yükseklikleri içeriğe göre değişebildiği için her gün satırı kendi etiketinden hesaplanır):
  - Başlık satırından sütunlar (ders no, saat, sabit bölümler) bulunur, gün etiketlerinden satırlar bulunur.
  - Hücre sınırları ve renkleri, çizilmiş dikdörtgenlerden alınır.
  - Yazı boyutuna göre satırlar ayrılır: kalın büyük yazı = ders/sınıf adı, orta boy = öğretmen/ders, küçük kutu = saat.
- Görsel olarak birleşmiş hücre **bölünmez blok** kabul edilir.
- Sınıf sayfalarından dersler ve öğretmenleri çıkarılır. Öğretmen sayfalarında sınıfı olmayan dersler (toplantılar) aynı gün, saat ve ada göre birleştirilerek çok öğretmenli derslere dönüştürülür.
- Okul bilgileri tahmin edilir: başlık ve logo sayfa başlığından, saat profilleri her sınıf sayfasının başlık satırından alınır. Kullanıcı ayarlardan düzeltebilir.
- **Elle yapıştırılmış resim hücreleri:** özel bir işlem yapılmaz; PDF'te okunan metin olduğu gibi alınır. Gerekli düzeltmeleri kullanıcı içe aktarmadan sonra arayüzden kendisi yapar. (Bilgi: Gaziemir sınıflar sayfa 19, öğretmenler sayfa 19, 41, 46, 49'daki resimlerin altındaki metin eski içeriktir.)
- **Sınıf ve öğretmen PDF'i arasındaki tutarsızlıklar:** sınıf PDF'i esas alınır (sınıfı olan dersler için). Toplantılar öğretmen PDF'inden alınır. Ek bir onay ekranı gösterilmez; olası çakışmalar normal uyarılar olarak görünür.
- İlk kayıttan sonra PDF'ler yeni formatta (veri ekli) olur.

## 9. FET'ten içe aktarma

- `*_data_and_timetable.fet` okunur:
  - `Activity` → ders adı, öğretmenler, sınıflar, süre, kimlik.
  - `ConstraintActivityPreferredStartingTime` → gün ve başlangıç saati.
  - Yerleşimi eksik olan dersler için aynı klasördeki `*_activities.xml` dosyası da okunabilir.
- Pasif (`Active=false`) etkinlikler alınmaz.
- Alt grup adları sınıf adına indirgenir ("Otomatik Alt Grup" ekleri).

## 10. Kapsam dışı (v1)

Paralel/grup dersleri, sınıf ekleme/silme, FET'e geri yazma, değişiklik raporu, tek sayfa çıktı, tablet desteği, çok kullanıcılı eşzamanlı düzenleme.

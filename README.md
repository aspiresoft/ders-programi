# Ders Programı Editörü

Tarayıcıda çalışan, sunucu gerektirmeyen ders programı düzenleyicisi. Ayrıntılı tasarım: [SPEC.md](SPEC.md).

## Klasörler

| Klasör | İçerik |
|---|---|
| `app/` | Web uygulaması (GitHub Pages'e yüklenecek kısım budur) |
| `app/js/` | Kod: FET okuma, veri modeli, sayfa düzeni, PDF çizimi, arayüz |
| `app/vendor/`, `app/fonts/` | pdf-lib, fontkit ve Inter yazı tipi (yerel kopyalar) |
| `okullar/<okul>/` | Her okulun `okul.json` ve `logo.png` dosyası (kişisel veri içerir, **yayınlanmaz**) |
| `tools/` | Komut satırı araçları |

## Çalıştırma (geliştirme)

```bash
python -m http.server 8765 --bind 127.0.0.1
```

Sonra tarayıcıda `http://localhost:8765/app/` açılır.

## Komut satırından FET → PDF

```bash
node tools/fetten-pdf.mjs manisa-fet/manisa_v5_4_data_and_timetable.fet okullar/manisa cikti
```

## Testler

```bash
node tools/test-editor.mjs
```

Eski PDF okuma testi, pdf.js'in Node sürümüyle (`pdfjs-dist@4.10.38` paketindeki `legacy/build/pdf.mjs`) çalışır:

```bash
node tools/test-eski-pdf.mjs <pdfjs-dist>/legacy/build/pdf.mjs _manisa_ders_programi_siniflar_versiyon_8.pdf _manisa_ders_programi_ogretmenler_versiyon_8.pdf cikti
```

## Tarayıcı desteği

Yalnızca masaüstü Chrome / Edge (güncel sürüm) hedeflenir. Bu yüzden `<dialog>`, `command`/`commandfor`, `closedby` ve
`showDirectoryPicker` için ek uyumluluk kodu (polyfill) eklenmez; klasöre kaydetme desteklenmezse normal indirmeye düşülür.

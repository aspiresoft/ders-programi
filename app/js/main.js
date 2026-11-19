// Uygulama: PDF aç, FET'ten yeni program, düzenle, kaydet.

import { fetOku } from './fet-import.js';
import { programOlustur, okulAyariOku } from './okul.js';
import { pdfleriUret, base64Kodla, dosyaAdlari } from './pdf-writer.js';
import { gomuluVeriyiOku } from './pdf-data.js';
import { sinifSayfasi, ogretmenSayfasi } from './layout.js';
import { programKarti, el } from './view.js';
import { bugun, trUpper, programiHazirla } from './model.js';
import { YAZI_TIPLERI, yaziTipiAnahtari, fontBaytlari, cssAilesi } from './fonts.js';
import { dersTasi, dersEkle, dersSil, dersGuncelle, yerBosMu } from './editor.js';
import { uyarilariBul } from './uyarilar.js';
import { Gecmis, taslakKaydet, taslakOku, taslakSil } from './gecmis.js';
import { surukleKur } from './surukle.js';
import { dersPenceresiAc } from './ders-penceresi.js';
import { eskiPdfdenProgram, pdfTuruTahmin } from './eski-pdf.js';
import { pdfAc as pdfAcPdfjs, sayfalariOku, logoCikar } from './pdfjs-sayfalar.js';
import { ayarlarPenceresiAc } from './ayarlar-penceresi.js';
import { ayarlariUygula } from './ayarlar.js';

const $ = (id) => document.getElementById(id);

const durum = {
  program: null,
  acilanVersiyon: 0,     // açılan PDF'in versiyonu (FET'ten yeni ise 0)
  secili: [],            // [{ tur: 'sinif'|'ogretmen', ad }]
  degisti: false,
  uyarilar: { liste: [], dersler: new Set() },
};
const gecmis = new Gecmis();

// ---------- Yardımcılar ----------

function mesaj(metin, hata = false) {
  const m = $('durum');
  m.textContent = metin;
  m.title = metin; // tek satıra sığmazsa üzerine gelince tamamı görünür
  m.classList.toggle('hata', hata);
}

const libHazir = () => new Promise((tamam) => {
  if (globalThis.PDFLib && globalThis.fontkit) return tamam();
  window.addEventListener('load', () => tamam(), { once: true });
});

const fontDosyaOnbellek = new Map();
async function fontDosyasi(yol) {
  if (!fontDosyaOnbellek.has(yol)) {
    fontDosyaOnbellek.set(yol, (async () => {
      const yanit = await fetch(yol);
      if (!yanit.ok) throw new Error(`Yazı tipi yüklenemedi: ${yol}`);
      return new Uint8Array(await yanit.arrayBuffer());
    })());
  }
  return fontDosyaOnbellek.get(yol);
}
const fontlariGetir = (program) => fontBaytlari(program, fontDosyasi);

/** Seçilen yazı tipini ekranda kullanılabilir yapar (FontFace ile) */
const yuklenenYazilar = new Map();
function yaziYukle(anahtar) {
  if (!YAZI_TIPLERI[anahtar]) return Promise.resolve();
  if (!yuklenenYazilar.has(anahtar)) {
    const { dosyalar } = YAZI_TIPLERI[anahtar];
    const agirlik = { yari: '600', kalin: '700', siyah: '900' };
    yuklenenYazilar.set(anahtar, Promise.all(Object.entries(dosyalar).map(async ([k, yol]) => {
      const yuz = new FontFace(cssAilesi(anahtar), `url(${yol})`, { weight: agirlik[k] });
      document.fonts.add(await yuz.load());
    })).catch((e) => console.warn('Yazı tipi yüklenemedi', e)));
  }
  return yuklenenYazilar.get(anahtar);
}
function ekranYazisiniUygula() {
  const anahtar = yaziTipiAnahtari(durum.program);
  yaziYukle(anahtar);
  document.documentElement.style.setProperty('--program-yazi', `"${cssAilesi(anahtar)}"`);
}

const varlikAdi = (v) => trUpper(v.ad);

// ---------- Program yükleme ----------

function dosyaBilgisiYaz() {
  const p = durum.program;
  const s = $('surumBilgisi');
  s.hidden = false;
  s.textContent = durum.acilanVersiyon ? `v${durum.acilanVersiyon}` : 'Yeni';
  s.classList.toggle('degisti', durum.degisti);
  s.title = `${p.okul.ad} · ${durum.acilanVersiyon ? `Versiyon ${durum.acilanVersiyon}` : 'Yeni program'}${durum.degisti ? ' · kaydedilmemiş değişiklik var' : ''}`;
}

function programiYukle(program, acilanVersiyon, { secili, degisti = false } = {}) {
  programiHazirla(program);
  durum.program = program;
  durum.acilanVersiyon = acilanVersiyon;
  durum.degisti = degisti;
  durum.secili = secili ?? (program.siniflar.length ? [{ tur: 'sinif', ad: program.siniflar[0].ad }] : []);
  gecmis.temizle();
  $('baslangic').hidden = true;
  $('calisma').hidden = false;
  $('duzenButonlari').hidden = false;
  $('btnKaydet').disabled = false;
  yenidenCiz();
}

let pdfjsOnbellek = null;
async function pdfjsYukle() {
  if (!pdfjsOnbellek) {
    pdfjsOnbellek = await import('../vendor/pdf.min.mjs');
    pdfjsOnbellek.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdf.worker.min.mjs', import.meta.url).href;
  }
  return pdfjsOnbellek;
}

async function pdfAc(dosyalar) {
  if (durum.degisti && !confirm('Kaydedilmemiş değişiklikler var. Yine de başka bir PDF açılsın mı?')) return;
  mesaj('PDF okunuyor…');
  try {
    await libHazir();
    const okunan = await Promise.all(dosyalar.map(async (f) => ({ dosya: f, bayt: new Uint8Array(await f.arrayBuffer()) })));
    // Yeni biçim: PDF'lerden birinde gömülü veri varsa onu kullan
    for (const { dosya, bayt } of okunan) {
      const program = await gomuluVeriyiOku(globalThis.PDFLib, bayt);
      if (program) {
        programiYukle(program, program.meta.versiyon);
        taslakSil();
        mesaj(`"${dosya.name}" açıldı.`);
        return;
      }
    }
    await eskiPdfAc(okunan);
  } catch (e) {
    console.error(e);
    mesaj(`PDF açılamadı: ${e.message}`, true);
  }
}

/** Eski biçim: sınıflar ve öğretmenler PDF'lerinden programı yeniden kurar. */
async function eskiPdfAc(okunan) {
  if (okunan.length < 2) {
    mesaj('Bu PDF eski biçimde. Lütfen "PDF Aç" ile sınıflar ve öğretmenler PDF\'lerini birlikte seçin (Ctrl ile iki dosyayı seçebilirsiniz).', true);
    return;
  }
  mesaj('Eski PDF okunuyor, bu birkaç saniye sürebilir…');
  const pdfjs = await pdfjsYukle();
  const parcalar = [];
  for (const o of okunan.slice(0, 2)) {
    const doc = await pdfAcPdfjs(pdfjs, o.bayt);
    const sayfalar = await sayfalariOku(doc);
    parcalar.push({ ...o, doc, sayfalar, tur: pdfTuruTahmin(sayfalar, o.dosya.name) });
  }
  let sinif = parcalar.find((p) => p.tur === 'sinif');
  let ogr = parcalar.find((p) => p.tur === 'ogretmen');
  if (!sinif || !ogr || sinif === ogr) [sinif, ogr] = parcalar; // tahmin edilemezse seçim sırası
  const { program, versiyon, uyarilar } = eskiPdfdenProgram(sinif.sayfalar, ogr.sayfalar, sinif.dosya.name);
  program.okul.logo = await logoCikar(pdfjs, sinif.doc);
  for (const p of parcalar) p.doc.destroy();
  programiYukle(program, versiyon, { degisti: true });
  taslagiYaz();
  const ek = uyarilar.length ? ` ${uyarilar.join(' ')}` : '';
  mesaj(`Eski PDF okundu: ${program.siniflar.length} sınıf, ${program.ogretmenler.length} öğretmen. Kaydettiğinizde yeni biçimde (Versiyon ${versiyon + 1}) kaydedilir.${ek}`);
}

async function fettenOlustur(dosyalar) {
  const bul = (re) => dosyalar.find((f) => re.test(f.name));
  const fet = bul(/\.fet$/i);
  const json = bul(/\.json$/i);
  const xml = bul(/activities\.xml$/i);
  const logo = bul(/\.(png|jpe?g)$/i);
  if (!fet) return mesaj('.fet dosyası seçilmedi.', true);
  if (!json) return mesaj('okul.json dosyası seçilmedi.', true);
  mesaj('Program oluşturuluyor…');
  try {
    const ayar = okulAyariOku(await json.text());
    const { ham, uyarilar } = fetOku(await fet.text(), xml ? await xml.text() : undefined);
    const logoVeri = logo
      ? { tip: /png$/i.test(logo.name) ? 'png' : 'jpg', veri: base64Kodla(new Uint8Array(await logo.arrayBuffer())) }
      : null;
    const program = programOlustur(ayar, ham, logoVeri, 'fet');
    program.meta.versiyon = 0;
    programiYukle(program, 0, { degisti: true });
    taslagiYaz();
    mesaj(`${program.siniflar.length} sınıf, ${program.ogretmenler.length} öğretmen yüklendi.${uyarilar.length ? ' ' + uyarilar.join(' ') : ''}`);
  } catch (e) {
    console.error(e);
    mesaj(e.message, true);
  }
}

// ---------- Değişiklikler ----------

/** Tüm düzenlemeler buradan geçer: geri alma kaydı, taslak, yeniden çizim, uyarı mesajı. */
function degistir(islem, basariMesaji) {
  const once = durum.program;
  gecmis.kaydet(once);
  const oncekiUyari = durum.uyarilar.liste.length;
  islem(durum.program);
  durum.degisti = true;
  taslagiYaz();
  yenidenCiz();
  const yeniUyari = durum.uyarilar.liste.length;
  if (yeniUyari > oncekiUyari) mesaj(`Dikkat: bu değişiklik ${yeniUyari - oncekiUyari} çakışma oluşturdu. Üstteki ⚠ düğmesinden görebilirsiniz.`, true);
  else mesaj(basariMesaji);
}

function geriAl() {
  const s = gecmis.geriAl(durum.program);
  if (!s) return;
  durum.program = s;
  durum.degisti = true;
  taslagiYaz();
  yenidenCiz();
  mesaj('Geri alındı.');
}

function yinele() {
  const s = gecmis.yinele(durum.program);
  if (!s) return;
  durum.program = s;
  durum.degisti = true;
  taslagiYaz();
  yenidenCiz();
  mesaj('Yinelendi.');
}

function taslagiYaz() {
  taslakKaydet({ program: durum.program, acilanVersiyon: durum.acilanVersiyon, secili: durum.secili });
}

const dersBul = (id) => durum.program.dersler.find((d) => d.id === id);

function dersiDuzenle(id) {
  const d = dersBul(id);
  if (!d) return;
  dersPenceresiAc(durum.program, d, {
    kaydet: (alanlar) => degistir((p) => dersGuncelle(p, id, alanlar), 'Ders güncellendi.'),
    sil: () => degistir((p) => dersSil(p, id), 'Ders silindi. (Geri almak için Ctrl+Z)'),
  });
}

function dersEklePenceresi(tur, ad, gun, bas) {
  dersPenceresiAc(durum.program, {
    ad: '', siniflar: tur === 'sinif' ? [ad] : [], ogretmenler: tur === 'ogretmen' ? [ad] : [], gun, bas, sure: 1,
  }, {
    kaydet: (alanlar) => degistir((p) => dersEkle(p, alanlar), 'Ders eklendi.'),
  });
}

// ---------- Kaydetme ----------

async function kaydet() {
  const p = durum.program;
  if (!p) return;
  const btn = $('btnKaydet');
  btn.disabled = true;
  mesaj('PDF hazırlanıyor…');
  try {
    await libHazir();
    const kayit = structuredClone(p);
    kayit.meta.versiyon = durum.acilanVersiyon + 1;
    kayit.meta.tarih = bugun();
    const pdfler = await pdfleriUret(globalThis.PDFLib, globalThis.fontkit, await fontlariGetir(kayit), kayit);
    const adlar = dosyaAdlari(kayit);
    const yazildi = await klasoreYaz([[adlar.siniflar, pdfler.siniflar], [adlar.ogretmenler, pdfler.ogretmenler]]);
    if (yazildi === 'iptal') { mesaj('Kaydetme iptal edildi.'); return; }
    durum.program = kayit;
    durum.acilanVersiyon = kayit.meta.versiyon;
    durum.degisti = false;
    taslakSil();
    dosyaBilgisiYaz();
    const uyari = durum.uyarilar.liste.length ? ` (${durum.uyarilar.liste.length} uyarı hâlâ duruyor)` : '';
    mesaj(`Kaydedildi: ${adlar.siniflar} ve ${adlar.ogretmenler}${uyari}`);
  } catch (e) {
    console.error(e);
    mesaj(`Kaydedilemedi: ${e.message}`, true);
  } finally {
    btn.disabled = false;
  }
}

/** Chrome'da klasör seçtirerek iki dosyayı yazar; desteklenmiyorsa indirir. */
async function klasoreYaz(dosyalar) {
  if ('showDirectoryPicker' in window) {
    let klasor;
    try {
      klasor = await window.showDirectoryPicker({ id: 'ders-programi', mode: 'readwrite' });
    } catch (e) {
      if (e.name === 'AbortError') return 'iptal';
      klasor = null; // izin verilmedi vb. → indirmeye geç
    }
    if (klasor) {
      for (const [ad, bayt] of dosyalar) {
        const h = await klasor.getFileHandle(ad, { create: true });
        const w = await h.createWritable();
        await w.write(bayt);
        await w.close();
      }
      return 'klasor';
    }
  }
  for (const [ad, bayt] of dosyalar) {
    const url = URL.createObjectURL(new Blob([bayt], { type: 'application/pdf' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: ad });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
  return 'indirme';
}

// ---------- Çizim ----------

const seciliMi = (tur, ad) => durum.secili.some((s) => s.tur === tur && s.ad === ad);

/** Listedeki sıra: önce sınıflar (liste sırası), sonra öğretmenler (alfabetik) */
function siraNo({ tur, ad }) {
  const p = durum.program;
  return tur === 'sinif' ? p.siniflar.findIndex((s) => s.ad === ad) : 100000 + p.ogretmenler.findIndex((o) => o.ad === ad);
}

/** Yeni seçileni sıradaki yerine yerleştirir (kullanıcının ◀ ▶ ile yaptığı sıralamayı bozmadan) */
function secimeEkle(oge) {
  if (seciliMi(oge.tur, oge.ad)) return;
  const n = siraNo(oge);
  const i = durum.secili.findIndex((s) => siraNo(s) > n);
  if (i < 0) durum.secili.push(oge);
  else durum.secili.splice(i, 0, oge);
}

function secimDegistir(tur, ad, ac) {
  const var_ = seciliMi(tur, ad);
  if (var_ && ac !== true) durum.secili = durum.secili.filter((s) => !(s.tur === tur && s.ad === ad));
  else if (!var_ && ac !== false) secimeEkle({ tur, ad });
  secimSonrasi();
}

function secimSonrasi() {
  listeleriCiz();
  sahneyiCiz();
  if (durum.program && durum.degisti) taslagiYaz();
}

function kartTasi(i, yon) {
  const j = i + yon;
  if (j < 0 || j >= durum.secili.length) return;
  [durum.secili[i], durum.secili[j]] = [durum.secili[j], durum.secili[i]];
  sahneyiCiz();
  if (durum.degisti) taslagiYaz();
}

function yenidenCiz() {
  // Silinmiş/yeniden adlandırılmış varlıkları seçimden çıkar
  const p = durum.program;
  durum.secili = durum.secili.filter((s) => (s.tur === 'sinif' ? p.siniflar.some((x) => x.ad === s.ad) : p.ogretmenler.some((x) => x.ad === s.ad)));
  durum.uyarilar = uyarilariBul(p);
  ekranYazisiniUygula();
  dosyaBilgisiYaz();
  listeleriCiz();
  sahneyiCiz();
  uyarilariCiz();
  $('btnGeri').disabled = !gecmis.geriVar;
  $('btnIleri').disabled = !gecmis.ileriVar;
}

function listeleriCiz() {
  const p = durum.program;
  const uyariVarliklar = new Set(durum.uyarilar.liste.flatMap((u) => u.varliklar.map((v) => `${v.tur}:${v.ad}`)));
  const doldur = (ul, tur, adlar) => {
    ul.replaceChildren(...adlar.map((ad) => el('li', {},
      el('button', {
        type: 'button', 'aria-pressed': String(seciliMi(tur, ad)),
        class: uyariVarliklar.has(`${tur}:${ad}`) ? 'uyarili' : null,
        onclick: () => secimDegistir(tur, ad),
      }, trUpper(ad), uyariVarliklar.has(`${tur}:${ad}`) ? el('span', { class: 'liste-uyari', 'aria-label': 'çakışma var' }, ' ⚠') : null))));
  };
  doldur($('sinifListesi'), 'sinif', p.siniflar.map((s) => s.ad));
  doldur($('ogretmenListesi'), 'ogretmen', p.ogretmenler.map((o) => o.ad));
}

function sahneyiCiz() {
  const p = durum.program;
  const sahne = $('sahne');
  const kaydirma = [sahne.scrollLeft, sahne.scrollTop];
  if (!durum.secili.length) {
    sahne.replaceChildren(el('p', { class: 'sahne-bos' }, 'Soldan bir sınıf veya öğretmen seçin. Birden fazla seçebilirsiniz.'));
    return;
  }
  const son = durum.secili.length - 1;
  sahne.replaceChildren(...durum.secili.map(({ tur, ad }, i) => {
    const sayfa = tur === 'sinif' ? sinifSayfasi(p, ad, { editor: true }) : ogretmenSayfasi(p, ad, { editor: true });
    return programKarti(sayfa, {
      kapat: () => secimDegistir(tur, ad, false),
      sola: i > 0 ? () => kartTasi(i, -1) : null,
      saga: i < son ? () => kartTasi(i, 1) : null,
      uyariDersler: durum.uyarilar.dersler,
    });
  }));
  [sahne.scrollLeft, sahne.scrollTop] = kaydirma;
}

function uyarilariCiz() {
  const { liste } = durum.uyarilar;
  const btn = $('btnUyari');
  btn.hidden = !liste.length;
  btn.textContent = `⚠ ${liste.length} uyarı`;
  $('uyariListesi').replaceChildren(...liste.map((u) => el('li', {},
    el('button', {
      type: 'button',
      onclick: () => {
        for (const v of u.varliklar) secimeEkle({ tur: v.tur, ad: v.ad });
        listeleriCiz();
        sahneyiCiz();
        $('uyariPaneli').hidePopover();
        document.querySelector(`#sahne article[data-ad="${CSS.escape(u.varliklar[0].ad)}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      },
    }, u.mesaj, el('small', {}, u.varliklar.map(varlikAdi).join(' · '))))));
  if (!liste.length && $('uyariPaneli').matches(':popover-open')) $('uyariPaneli').hidePopover();
}

// ---------- Olaylar ----------

const pdfSec = () => $('pdfSecici').click();
$('btnAc').addEventListener('click', pdfSec);
$('kartAc').addEventListener('click', pdfSec);
$('pdfSecici').addEventListener('change', (e) => {
  const f = [...(e.target.files ?? [])];
  if (f.length) pdfAc(f);
  e.target.value = '';
});
$('btnKaydet').addEventListener('click', kaydet);
$('btnGeri').addEventListener('click', geriAl);
$('btnIleri').addEventListener('click', yinele);
$('btnAyarlar').addEventListener('click', () => {
  ayarlarPenceresiAc(durum.program, {
    uygula: (kopya) => {
      // Adı değişen öğretmenlerin açık kartları kapanmasın
      const yeniAd = kopya.yeniAdlar ?? {};
      durum.secili = durum.secili.map((s) => (s.tur === 'ogretmen' && yeniAd[s.ad] ? { ...s, ad: yeniAd[s.ad] } : s));
      degistir((p) => ayarlariUygula(p, kopya), 'Ayarlar uygulandı. (Geri almak için Ctrl+Z)');
    },
    yaziYukle,
  });
});

// Soldaki listeler: tümünü göster / seçimi temizle
for (const b of document.querySelectorAll('[data-tumu]')) {
  b.addEventListener('click', () => {
    const tur = b.dataset.tumu;
    const adlar = tur === 'sinif' ? durum.program.siniflar.map((s) => s.ad) : durum.program.ogretmenler.map((o) => o.ad);
    for (const ad of adlar) secimeEkle({ tur, ad });
    secimSonrasi();
  });
}
for (const b of document.querySelectorAll('[data-temizle]')) {
  b.addEventListener('click', () => {
    durum.secili = durum.secili.filter((s) => s.tur !== b.dataset.temizle);
    secimSonrasi();
  });
}

const fetGirdi = $('fetDosyalari');
fetGirdi.addEventListener('change', () => {
  const adlar = [...fetGirdi.files].map((f) => f.name);
  $('secilenler').textContent = adlar.join(', ');
  $('btnOlustur').disabled = !adlar.some((a) => /\.fet$/i.test(a)) || !adlar.some((a) => /\.json$/i.test(a));
});
$('btnOlustur').addEventListener('click', () => {
  $('fetPenceresi').close();
  if (durum.degisti && !confirm('Kaydedilmemiş değişiklikler var. Yine de yeni program oluşturulsun mu?')) return;
  fettenOlustur([...fetGirdi.files]);
});

// Çift tıklama: dolu hücre → düzenle, boş hücre → ekle
$('sahne').addEventListener('dblclick', (e) => {
  const td = e.target.closest('td.ders[data-no]');
  if (!td) return;
  if (td.dataset.ders) return dersiDuzenle(Number(td.dataset.ders));
  const kart = td.closest('article.program');
  const gun = Number(td.closest('tr').dataset.gun);
  dersEklePenceresi(kart.dataset.tur, kart.dataset.ad, gun, Number(td.dataset.no));
});

// Sürükle-bırak
surukleKur($('sahne'), {
  dersBul,
  dersSayisi: () => durum.program.dersSayisi,
  izinli: (ders, kart) => (kart.dataset.tur === 'sinif' ? ders.siniflar : ders.ogretmenler).includes(kart.dataset.ad),
  bosMu: (ders, gun, bas) => yerBosMu(durum.program, ders, gun, bas),
  birak: (id, gun, bas, baglam) => {
    const d = dersBul(id);
    if (!d || (d.gun === gun && d.bas === bas)) return;
    degistir((p) => dersTasi(p, id, gun, bas, baglam), 'Ders taşındı. (Geri almak için Ctrl+Z)');
  },
});

// Klavye kısayolları
document.addEventListener('keydown', (e) => {
  if (!durum.program || document.querySelector('dialog[open]:modal')) return;
  if (e.target.closest?.('input, textarea, select')) return;
  const ctrl = e.ctrlKey || e.metaKey;
  if (ctrl && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); geriAl(); }
  else if (ctrl && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) { e.preventDefault(); yinele(); }
  else if (ctrl && e.key.toLowerCase() === 's') { e.preventDefault(); kaydet(); }
});

// Kaydedilmemiş değişiklikle sayfadan çıkarken uyar
window.addEventListener('beforeunload', (e) => {
  if (durum.degisti) e.preventDefault();
});

// Yarım kalan çalışma
const taslak = taslakOku();
if (taslak) {
  const zaman = new Date(taslak.zaman);
  $('taslakBilgi').textContent = `${taslak.program.okul.ad} · ${zaman.toLocaleDateString('tr-TR')} ${zaman.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })} · kaldığınız yerden devam edin`;
  $('kartTaslak').hidden = false;
  $('kartTaslak').addEventListener('click', () => {
    programiYukle(taslak.program, taslak.acilanVersiyon ?? 0, { secili: taslak.secili, degisti: true });
    mesaj('Yarım kalan çalışma açıldı.');
  });
}

// Düzenleme motoru testleri:  node tools/test-editor.mjs
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const kok = join(dirname(fileURLToPath(import.meta.url)), '..');
const imp = (p) => import(pathToFileURL(join(kok, 'app', p)).href);
const { dersTasi, dersEkle, dersSil, dersGuncelle, ogretmenEkle, yerBosMu } = await imp('js/editor.js');
const { uyarilariBul } = await imp('js/uyarilar.js');
const { programOlustur, okulAyariOku } = await imp('js/okul.js');
const { profilleriCevir } = await imp('js/okul.js');
const { sinifSayfasi, ogretmenSayfasi } = await imp('js/layout.js');

let gecen = 0;
const test = (ad, fn) => { fn(); gecen++; console.log('✓', ad); };

// Küçük, elle kurulmuş bir program
function kucuk() {
  const ayar = {
    okul: { ad: 'Test' },
    profiller: [{ id: 'g', satirlar: [
      { ders: 1, saat: '09:00-09:40' }, { ders: 2, saat: '09:50-10:30' }, { ders: 3, saat: '10:40-11:20' },
      { sabit: 'ÖĞLE', saat: '11:20-12:00' }, { ders: 4, saat: '12:00-12:40' }] }],
  };
  const ham = {
    gunler: ['Pazartesi', 'Salı'], dersSayisi: 4, siniflar: ['5-A', '5-B'], ogretmenler: ['ALİ', 'AYŞE', 'REHBER'],
    dersler: [
      { id: 1, ad: 'Matematik', siniflar: ['5-A'], ogretmenler: ['ALİ'], gun: 0, bas: 1, sure: 1 },
      { id: 2, ad: 'Fen', siniflar: ['5-A'], ogretmenler: ['AYŞE'], gun: 0, bas: 2, sure: 1 },
      { id: 3, ad: 'Türkçe', siniflar: ['5-A'], ogretmenler: ['ALİ'], gun: 0, bas: 3, sure: 2 }, // blok
      { id: 4, ad: 'Fen', siniflar: ['5-B'], ogretmenler: ['AYŞE'], gun: 0, bas: 1, sure: 1 },
      { id: 5, ad: 'Rehberlik', siniflar: ['5-B'], ogretmenler: ['ALİ', 'REHBER'], gun: 1, bas: 1, sure: 1 },
      { id: 6, ad: 'Zümre Toplantısı', siniflar: [], ogretmenler: ['ALİ', 'AYŞE'], gun: 1, bas: 4, sure: 1 },
    ],
  };
  return programOlustur(ayar, ham, null, 'test');
}
const d = (p, id) => p.dersler.find((x) => x.id === id);
const sinif5A = { tur: 'sinif', ad: '5-A' };

test('başlangıçta çakışma yok', () => {
  assert.equal(uyarilariBul(kucuk()).liste.length, 0);
});

test('boş saate taşıma', () => {
  const p = kucuk();
  dersTasi(p, 1, 1, 2, sinif5A);
  assert.deepEqual([d(p, 1).gun, d(p, 1).bas], [1, 2]);
});

test('tekli ↔ tekli yer değiştirme', () => {
  const p = kucuk();
  const r = dersTasi(p, 1, 0, 2, sinif5A);
  assert.deepEqual([d(p, 1).bas, d(p, 2).bas], [2, 1]);
  assert.deepEqual(r.tasinan.sort(), [1, 2]);
});

test('blok, iki tekli dersin yerine gidince onlar bloğun eski yerine geçer', () => {
  const p = kucuk();
  dersTasi(p, 3, 0, 1, sinif5A); // Türkçe (3-4) → 1-2
  assert.deepEqual([d(p, 3).bas, d(p, 1).bas, d(p, 2).bas], [1, 3, 4]);
  assert.equal(d(p, 3).sure, 2, 'blok bölünmez');
});

test('tekli ders bloğun ortasına bırakılınca blok bütün olarak yer değiştirir', () => {
  const p = kucuk();
  dersTasi(p, 1, 0, 4, sinif5A); // Matematik → 4 (Türkçe 3-4 bloğunun ikinci saati)
  assert.equal(d(p, 1).bas, 4);
  assert.equal(d(p, 3).bas, 1, 'blok, matematiğin boşalttığı yere taşındı');
  assert.equal(d(p, 3).sure, 2);
  // Blok 1-2'ye geçti ve Fen (2) ile çakışıyor → uyarı (engellenmez)
  assert.ok(uyarilariBul(p).liste.some((u) => u.mesaj.includes('5-A')));
});

test('aynı gün iç içe kaydırma (blok bir saat sağa)', () => {
  const p = kucuk();
  dersGuncelle(p, 3, { bas: 1 }); dersGuncelle(p, 1, { bas: 3 }); dersGuncelle(p, 2, { bas: 4 }); // Türkçe 1-2, Mat 3, Fen 4
  dersTasi(p, 3, 0, 2, sinif5A); // Türkçe → 2-3; Mat (3) boşalan 1'e
  assert.deepEqual([d(p, 3).bas, d(p, 1).bas, d(p, 2).bas], [2, 1, 4]);
  assert.equal(uyarilariBul(p).liste.length, 0);
});

test('ortak ders (iki öğretmenli) tek nesne olarak taşınır', () => {
  const p = kucuk();
  dersTasi(p, 5, 1, 3, { tur: 'ogretmen', ad: 'REHBER' });
  const sayfaAli = ogretmenSayfasi(p, 'ALİ', { editor: true });
  const sali = sayfaAli.satirlar[1].hucreler.find((h) => h.no === 3);
  assert.equal(sali.dersler[0].id, 5);
});

test('öğretmen çakışması uyarısı (farklı sınıflar)', () => {
  const p = kucuk();
  dersTasi(p, 4, 0, 2, { tur: 'sinif', ad: '5-B' }); // AYŞE: 5-B Fen → 2, 5-A Fen zaten 2'de
  const u = uyarilariBul(p);
  assert.ok(u.liste.some((x) => x.mesaj.startsWith('AYŞE')));
  assert.ok(u.dersler.has(2) && u.dersler.has(4));
});

test('toplantıyla çakışma uyarısı', () => {
  const p = kucuk();
  dersTasi(p, 1, 1, 4, sinif5A); // ALİ Salı 4: zümre var
  assert.ok(uyarilariBul(p).liste.some((x) => x.mesaj.includes('ZÜMRE')));
});

test('ders ekleme yeni öğretmeni de ekler, silme', () => {
  const p = kucuk();
  const yeni = dersEkle(p, { ad: 'Müzik', siniflar: ['5-B'], ogretmenler: ['Zeynep Kaya'], gun: 1, bas: 2, sure: 1 });
  assert.ok(p.ogretmenler.some((o) => o.ad === 'Zeynep Kaya'));
  assert.equal(ogretmenEkle(p, 'ZEYNEP KAYA'), 'Zeynep Kaya', 'aynı öğretmen iki kez eklenmez');
  assert.equal(p.ogretmenler.filter((o) => o.ad === 'Zeynep Kaya').length, 1);
  assert.ok(ogretmenSayfasi(p, 'Zeynep Kaya', { editor: true }).satirlar[1].hucreler.some((h) => h.dersler[0]?.id === yeni.id));
  dersSil(p, yeni.id);
  assert.ok(!p.dersler.some((x) => x.id === yeni.id));
});

test('blok olarak ders ekleme ve süre sınırı', () => {
  const p = kucuk();
  const b = dersEkle(p, { ad: 'Atölye', siniflar: ['5-B'], ogretmenler: ['AYŞE'], gun: 1, bas: 2, sure: 2 });
  assert.equal(b.sure, 2);
  dersGuncelle(p, b.id, { bas: 4 }); // 4-5 olamaz → 3-4'e çekilir
  assert.equal(d(p, b.id).bas, 3);
});

test('yerBosMu: ipucu hesabı', () => {
  const p = kucuk();
  assert.equal(yerBosMu(p, d(p, 1), 1, 2), true);
  assert.equal(yerBosMu(p, d(p, 1), 0, 3), false); // ALİ'nin Türkçe bloğu
  assert.equal(yerBosMu(p, d(p, 3), 1, 4), false); // blok gün dışına taşar
});

test('editör görünümü ayrı dersleri birleştirmez, PDF görünümü birleştirir', () => {
  const p = kucuk();
  dersGuncelle(p, 2, { ad: 'Matematik', ogretmenler: ['ALİ'] }); // 1 ve 2 aynı görünümlü
  const pdf = sinifSayfasi(p, '5-A').satirlar[0].hucreler[0];
  const ed = sinifSayfasi(p, '5-A', { editor: true }).satirlar[0].hucreler[0];
  assert.equal(pdf.genislik, 2);
  assert.equal(ed.genislik, 1);
});

// Ayarlar
const { profilSirala, profilSorunlari, yeniProfil, profilSil, sabitEkle, siniflaraProfilAta, ayarlariUygula } = await imp('js/ayarlar.js');

test('sabit bölüm saatine göre doğru yere yerleşir', () => {
  const p = kucuk();
  const prof = p.profiller[0];
  const s = sabitEkle(prof);
  Object.assign(s, { ad: 'KAHVALTI', bas: '08:30', bit: '09:00' });
  const t = sabitEkle(prof);
  Object.assign(t, { ad: 'TENEFFÜS', bas: '10:30', bit: '10:40' });
  profilSirala(prof);
  assert.deepEqual(prof.satirlar.map((r) => r.tur === 'ders' ? r.no : r.ad), ['KAHVALTI', 1, 2, 'TENEFFÜS', 3, 'ÖĞLE', 4]);
  assert.equal(profilSorunlari(prof).length, 0);
});

test('saat sorunları bulunur', () => {
  const p = kucuk();
  const prof = p.profiller[0];
  prof.satirlar.find((r) => r.no === 2).bit = '09:30'; // başlangıçtan önce
  prof.satirlar.find((r) => r.no === 3).bas = '';
  const s = profilSorunlari(prof);
  assert.ok(s.some((x) => x.includes('2. ders')));
  assert.ok(s.some((x) => x.includes('3. ders: saat girilmemiş')));
});

test('saat düzeni kopyalama, atama ve silme', () => {
  const p = kucuk();
  const kopya = structuredClone(p);
  const yeni = yeniProfil(kopya, kopya.profiller[0]);
  yeni.satirlar.find((r) => r.no === 1).bas = '08:50';
  assert.equal(profilSil(kopya, kopya.profiller[0].id), false, 'kullanılan düzen silinmez');
  siniflaraProfilAta(kopya, ['5-B'], yeni.id);
  kopya.siniflar.find((s) => s.ad === '5-B').rehber = 'AYŞE';
  ayarlariUygula(p, kopya);
  assert.equal(p.siniflar.find((s) => s.ad === '5-B').profil, yeni.id);
  assert.equal(p.siniflar.find((s) => s.ad === '5-B').rehber, 'AYŞE');
  assert.equal(p.dersler.length, 6, 'dersler değişmez');
  // 5-B'nin 1. dersi artık 08:50'de
  assert.equal(sinifSayfasi(p, '5-B').satirlar[0].hucreler[0].saat.startsWith('08:50'), true);
  siniflaraProfilAta(p, ['5-B'], p.profiller[0].id);
  assert.equal(profilSil(p, yeni.id), true);
});

const { ogretmenAdlandir, ogretmenSil, ogretmenEkleAyar, dersAdlandir, dersAdiSil, dersAdiEkle, dersRengiAta } = await imp('js/ayarlar.js');
const { dersRengi, PALET } = await imp('js/colors.js');
const { programiHazirla } = await imp('js/model.js');

test('öğretmen adı değişince dersler ve rehber de değişir', () => {
  const p = kucuk();
  p.siniflar[0].rehber = 'ALİ';
  assert.equal(ogretmenAdlandir(p, 'ALİ', 'Ali Veli'), null);
  assert.ok(p.dersler.filter((d) => d.ogretmenler.includes('Ali Veli')).length === 4);
  assert.equal(p.siniflar[0].rehber, 'Ali Veli');
  assert.ok(ogretmenAdlandir(p, 'AYŞE', 'ali veli'), 'aynı ad ikinci kez verilemez');
  assert.ok(ogretmenEkleAyar(p, 'AYŞE'), 'var olan eklenemez');
});

test('öğretmen silinince derslerden çıkar, yalnız ona ait toplantı silinir', () => {
  const p = kucuk();
  dersEkle(p, { ad: 'Nöbet', siniflar: [], ogretmenler: ['REHBER'], gun: 1, bas: 2, sure: 1 });
  const silinen = ogretmenSil(p, 'REHBER');
  assert.equal(silinen, 1);
  assert.deepEqual(d(p, 5).ogretmenler, ['ALİ']);
});

test('ders adı değiştirme, ekleme, silme ve renk', () => {
  const p = programiHazirla(kucuk());
  assert.ok(p.dersListesi.some((x) => x.ad === 'Fen'));
  assert.equal(dersAdlandir(p, 'Fen', 'Fen Bilimleri'), null);
  assert.equal(p.dersler.filter((x) => x.ad === 'Fen Bilimleri').length, 2);
  assert.equal(dersAdiSil(p, 'Fen Bilimleri'), false, 'kullanılan ders silinmez');
  assert.equal(dersAdiEkle(p, 'Satranç'), null);
  assert.equal(dersAdiSil(p, 'Satranç'), true);
  assert.equal(dersRengi('Matematik', p), PALET.turuncu, 'otomatik renk');
  dersRengiAta(p, 'Matematik', 'mavi');
  assert.equal(dersRengi('Matematik', p), PALET.mavi);
  assert.equal(sinifSayfasi(p, '5-A').satirlar[0].hucreler[0].renk, PALET.mavi);
});

test('süreler: başlıkta ve hücrede (teneffüs hariç toplam)', () => {
  const p = kucuk();
  const s = sinifSayfasi(p, '5-A');
  assert.equal(s.sutunlar.find((c) => c.no === 1).sure, '40dk');
  const blok = s.satirlar[0].hucreler.find((h) => h.dersler[0]?.id === 3); // 3–4, arada öğle var → iki hücre
  assert.match(blok.saat, /\(40dk\)$/);
  const sabit = s.sutunlar.find((c) => c.tur === 'sabit');
  assert.equal(sabit.sure, '40dk');
});

// Gerçek veri: Manisa
const { fetOku } = await imp('js/fet-import.js');
test('Manisa FET verisinde çakışma yok', () => {
  const ayar = okulAyariOku(readFileSync(join(kok, 'okullar/manisa/okul.json'), 'utf8'));
  const { ham } = fetOku(readFileSync(join(kok, 'manisa-fet/manisa_v5_4_data_and_timetable.fet'), 'utf8'));
  const p = programOlustur(ayar, ham, null, 'fet');
  const u = uyarilariBul(p);
  if (u.liste.length) console.log(u.liste.slice(0, 5).map((x) => x.mesaj));
  assert.equal(u.liste.length, 0);
});

console.log(`\n${gecen} test geçti.`);

// Ayarlar: saat düzenleri (profiller), sınıf atamaları, okul bilgileri.
// DOM'dan bağımsız; programın çalışma kopyası üzerinde çalışır.

import { dk, trUpper, trSirala } from './model.js';

/**
 * Satırları sıralar: dersler numara sırasında kalır, sabit bölümler (mola vb.)
 * başlangıç saatlerine göre derslerin arasına yerleşir.
 */
export function profilSirala(profil) {
  const dersler = profil.satirlar.filter((r) => r.tur === 'ders').sort((a, b) => a.no - b.no);
  const sabitler = profil.satirlar.filter((r) => r.tur === 'sabit')
    .map((r, i) => ({ r, i })) // eşit saatlerde eski sırayı koru
    .sort((a, b) => (dk(a.r.bas) || 0) - (dk(b.r.bas) || 0) || a.i - b.i)
    .map((x) => x.r);
  const sonuc = [...dersler];
  for (const s of sabitler) {
    const sb = dk(s.bas);
    let yer = sonuc.length;
    if (!Number.isNaN(sb)) {
      const i = sonuc.findIndex((r) => r.tur === 'ders' && !Number.isNaN(dk(r.bas)) && dk(r.bas) >= sb);
      if (i >= 0) {
        yer = i;
        // Aynı noktadaki diğer sabitlerden sonra gelsin
        while (yer > 0 && sonuc[yer - 1].tur === 'sabit' && (dk(sonuc[yer - 1].bas) || 0) > sb) yer--;
      }
    }
    sonuc.splice(yer, 0, s);
  }
  profil.satirlar = sonuc;
  return profil;
}

/** Saat düzenindeki sorunlar (engellemez; yalnızca gösterilir). */
export function profilSorunlari(profil) {
  const sorunlar = [];
  const ad = (r) => (r.tur === 'ders' ? `${r.no}. ders` : trUpper(r.ad || 'Sabit bölüm'));
  for (const r of profil.satirlar) {
    const a = dk(r.bas), b = dk(r.bit);
    if (Number.isNaN(a) || Number.isNaN(b)) sorunlar.push(`${ad(r)}: saat girilmemiş.`);
    else if (b <= a) sorunlar.push(`${ad(r)}: bitiş saati başlangıçtan önce.`);
  }
  const sirali = profil.satirlar.filter((r) => !Number.isNaN(dk(r.bas)) && !Number.isNaN(dk(r.bit)));
  for (let i = 1; i < sirali.length; i++) {
    if (dk(sirali[i].bas) < dk(sirali[i - 1].bit)) sorunlar.push(`${ad(sirali[i - 1])} ile ${ad(sirali[i])} saatleri çakışıyor.`);
  }
  return sorunlar;
}

export function yeniProfil(program, kaynak) {
  let n = program.profiller.length + 1;
  while (program.profiller.some((p) => p.id === `p${n}`)) n++;
  const p = kaynak
    ? { ...structuredClone(kaynak), id: `p${n}`, ad: `${kaynak.ad || 'Saat düzeni'} (kopya)`, kisa: '' }
    : {
      id: `p${n}`, ad: `Saat düzeni ${n}`, kisa: '',
      satirlar: Array.from({ length: program.dersSayisi }, (_, i) => ({ tur: 'ders', no: i + 1, bas: '', bit: '' })),
    };
  program.profiller.push(p);
  return p;
}

export const profilKullananlar = (program, id) => program.siniflar.filter((s) => s.profil === id).map((s) => s.ad);

export function profilSil(program, id) {
  if (profilKullananlar(program, id).length || program.profiller.length <= 1) return false;
  program.profiller = program.profiller.filter((p) => p.id !== id);
  if (program.varsayilanProfil === id) program.varsayilanProfil = program.profiller[0].id;
  return true;
}

export function sabitEkle(profil) {
  const r = { tur: 'sabit', ad: 'YENİ BÖLÜM', bas: '', bit: '', renk: null };
  profil.satirlar.push(r);
  return r;
}

export function siniflaraProfilAta(program, sinifAdlari, profilId) {
  for (const s of program.siniflar) if (sinifAdlari.includes(s.ad)) s.profil = profilId;
}

// ---------------------------------------------------------------- Öğretmenler

const ayni = (a, b) => trUpper(String(a).trim()) === trUpper(String(b).trim());
const temizAd = (s) => String(s ?? '').trim().replace(/\s+/g, ' ');

/** @returns {string|null} hata mesajı */
export function ogretmenAdlandir(program, eski, yeni) {
  yeni = temizAd(yeni);
  if (!yeni) return 'Ad boş olamaz.';
  if (yeni === eski) return null;
  if (program.ogretmenler.some((o) => o.ad !== eski && ayni(o.ad, yeni))) return `"${yeni}" zaten listede.`;
  const o = program.ogretmenler.find((x) => x.ad === eski);
  if (!o) return null;
  o.ad = yeni;
  // Açık programların (ekrandaki kartların) adı da güncellensin diye kaydı tutulur
  program.yeniAdlar ??= {};
  for (const [a, b] of Object.entries(program.yeniAdlar)) if (b === eski) program.yeniAdlar[a] = yeni;
  program.yeniAdlar[eski] = yeni;
  for (const d of program.dersler) d.ogretmenler = d.ogretmenler.map((x) => (x === eski ? yeni : x));
  for (const s of program.siniflar) if (s.rehber === eski) s.rehber = yeni;
  program.ogretmenler.sort((a, b) => trSirala(a.ad, b.ad));
  return null;
}

export function ogretmenEkleAyar(program, ad) {
  ad = temizAd(ad);
  if (!ad) return 'Ad boş olamaz.';
  if (program.ogretmenler.some((o) => ayni(o.ad, ad))) return `"${ad}" zaten listede.`;
  program.ogretmenler.push({ ad });
  program.ogretmenler.sort((a, b) => trSirala(a.ad, b.ad));
  return null;
}

export const ogretmenDersSayisi = (program, ad) => program.dersler.filter((d) => d.ogretmenler.includes(ad)).length;

/**
 * Öğretmeni siler ve derslerden çıkarır. Sınıfı ve başka öğretmeni kalmayan dersler (ör. yalnız ona ait toplantı) silinir.
 * @returns {number} silinen ders sayısı
 */
export function ogretmenSil(program, ad) {
  program.ogretmenler = program.ogretmenler.filter((o) => o.ad !== ad);
  let silinen = 0;
  program.dersler = program.dersler.filter((d) => {
    if (!d.ogretmenler.includes(ad)) return true;
    d.ogretmenler = d.ogretmenler.filter((x) => x !== ad);
    if (!d.ogretmenler.length && !d.siniflar.length) { silinen++; return false; }
    return true;
  });
  for (const s of program.siniflar) if (s.rehber === ad) s.rehber = '';
  return silinen;
}

// ---------------------------------------------------------------- Dersler (ders adları ve renkleri)

export const dersKullanimi = (program, ad) => program.dersler.filter((d) => d.ad === ad).length;

export function dersAdiEkle(program, ad) {
  ad = temizAd(ad);
  if (!ad) return 'Ad boş olamaz.';
  if (program.dersListesi.some((x) => ayni(x.ad, ad))) return `"${ad}" zaten listede.`;
  program.dersListesi.push({ ad, renk: null });
  program.dersListesi.sort((a, b) => trSirala(a.ad, b.ad));
  return null;
}

/** Ders adını değiştirir; o adı taşıyan bütün dersler de güncellenir. */
export function dersAdlandir(program, eski, yeni) {
  yeni = temizAd(yeni);
  if (!yeni) return 'Ad boş olamaz.';
  if (yeni === eski) return null;
  if (program.dersListesi.some((x) => x.ad !== eski && ayni(x.ad, yeni))) return `"${yeni}" zaten listede.`;
  const k = program.dersListesi.find((x) => x.ad === eski);
  if (k) k.ad = yeni;
  for (const d of program.dersler) if (d.ad === eski) d.ad = yeni;
  program.dersListesi.sort((a, b) => trSirala(a.ad, b.ad));
  return null;
}

/** Yalnızca hiçbir derste kullanılmayan ad silinebilir. */
export function dersAdiSil(program, ad) {
  if (dersKullanimi(program, ad)) return false;
  program.dersListesi = program.dersListesi.filter((x) => x.ad !== ad);
  return true;
}

export function dersRengiAta(program, ad, renk) {
  const k = program.dersListesi.find((x) => x.ad === ad);
  if (k) k.renk = renk || null;
}

/** Çalışma kopyasındaki ayarları gerçek programa aktarır. */
export function ayarlariUygula(program, kopya) {
  for (const p of kopya.profiller) profilSirala(p);
  for (const alan of ['okul', 'profiller', 'siniflar', 'ogretmenler', 'dersler', 'dersListesi', 'gorunum', 'ayarlar']) {
    program[alan] = structuredClone(kopya[alan]);
  }
  program.varsayilanProfil = kopya.profiller.some((p) => p.id === kopya.varsayilanProfil) ? kopya.varsayilanProfil : kopya.profiller[0].id;
  for (const s of program.siniflar) {
    if (!program.profiller.some((p) => p.id === s.profil)) s.profil = program.varsayilanProfil;
  }
}

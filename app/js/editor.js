// Düzenleme işlemleri (DOM'dan bağımsız; programı yerinde değiştirir).
// Geri alma için çağıran taraf işlemden önce programın kopyasını saklar.

import { yeniDersId, trSirala } from './model.js';

const dersiBul = (program, id) => program.dersler.find((d) => d.id === id);

/** Bir varlığın (sınıf/öğretmen) derslerinden, verilen gün ve saat aralığıyla çakışanlar. */
function aralikta(program, tur, ad, gun, bas, bit, haricId) {
  return program.dersler.filter((d) => d.id !== haricId && d.gun === gun
    && (tur === 'sinif' ? d.siniflar.includes(ad) : d.ogretmenler.includes(ad))
    && d.bas <= bit && d.bas + d.sure - 1 >= bas);
}

/**
 * Dersi (bloğu) yeni yerine taşır. Hedefte o sınıfın/öğretmenin başka dersleri varsa
 * onlar dersin boşalttığı yere geçer (yer değiştirme).
 * @param baglam { tur: 'sinif'|'ogretmen', ad }  sürüklemenin yapıldığı program
 * @returns {{ tasinan: number[] }} yeri değişen ders kimlikleri
 */
export function dersTasi(program, dersId, hedefGun, hedefBas, baglam) {
  const d = dersiBul(program, dersId);
  if (!d) return { tasinan: [] };
  const N = program.dersSayisi;
  hedefBas = Math.max(1, Math.min(hedefBas, N - d.sure + 1));
  if (d.gun === hedefGun && d.bas === hedefBas) return { tasinan: [] };

  const hedefBit = hedefBas + d.sure - 1;
  const eskiGun = d.gun;
  const eskiSlotlar = Array.from({ length: d.sure }, (_, i) => d.bas + i);
  const yeniSlotlar = new Set(Array.from({ length: d.sure }, (_, i) => hedefBas + i));

  const engeller = baglam ? aralikta(program, baglam.tur, baglam.ad, hedefGun, hedefBas, hedefBit, d.id) : [];
  d.gun = hedefGun;
  d.bas = hedefBas;
  const tasinan = [d.id];
  if (!engeller.length) return { tasinan };

  // Dersin boşalttığı saatler (aynı gün ve iç içe geçen taşımada yeni yerle kesişenler hariç)
  const bosalan = eskiSlotlar.filter((s) => !(eskiGun === hedefGun && yeniSlotlar.has(s)));
  engeller.sort((a, b) => a.bas - b.bas);
  let i = 0;
  for (const e of engeller) {
    // Bloklar bölünmez: engel, boşalan saatlerin sıradakinden başlayarak bütün olarak yerleşir
    const bas = bosalan[Math.min(i, bosalan.length - 1)] ?? eskiSlotlar[0];
    e.gun = eskiGun;
    e.bas = Math.max(1, Math.min(bas, N - e.sure + 1));
    i += e.sure;
    tasinan.push(e.id);
  }
  return { tasinan };
}

/** Ders adı listede yoksa ekler (renk otomatik). */
export function dersAdiKaydet(program, ad) {
  program.dersListesi ??= [];
  const temiz = String(ad).trim();
  if (temiz && !program.dersListesi.some((x) => x.ad === temiz)) {
    program.dersListesi.push({ ad: temiz, renk: null });
    program.dersListesi.sort((a, b) => trSirala(a.ad, b.ad));
  }
}

export function dersEkle(program, { ad, siniflar = [], ogretmenler = [], gun, bas, sure = 1 }) {
  for (const o of ogretmenler) ogretmenEkle(program, o);
  dersAdiKaydet(program, ad);
  const ders = { id: yeniDersId(program), ad: ad.trim(), siniflar: [...siniflar], ogretmenler: [...ogretmenler], gun, bas, sure };
  program.dersler.push(ders);
  return ders;
}

export function dersSil(program, dersId) {
  program.dersler = program.dersler.filter((d) => d.id !== dersId);
}

export function dersGuncelle(program, dersId, alanlar) {
  const d = dersiBul(program, dersId);
  if (!d) return null;
  if (alanlar.ogretmenler) for (const o of alanlar.ogretmenler) ogretmenEkle(program, o);
  if (alanlar.ad) dersAdiKaydet(program, alanlar.ad);
  for (const k of ['ad', 'siniflar', 'ogretmenler', 'gun', 'bas', 'sure']) {
    if (alanlar[k] !== undefined) d[k] = Array.isArray(alanlar[k]) ? [...alanlar[k]] : alanlar[k];
  }
  d.ad = String(d.ad).trim();
  d.sure = Math.max(1, Math.min(d.sure, program.dersSayisi));
  d.bas = Math.max(1, Math.min(d.bas, program.dersSayisi - d.sure + 1));
  return d;
}

/** Listede yoksa yeni öğretmen ekler (alfabetik sıraya). */
export function ogretmenEkle(program, ad) {
  const temiz = String(ad).trim().replace(/\s+/g, ' ');
  if (!temiz) return null;
  const var_ = program.ogretmenler.find((o) => o.ad.toLocaleUpperCase('tr-TR') === temiz.toLocaleUpperCase('tr-TR'));
  if (var_) return var_.ad;
  program.ogretmenler.push({ ad: temiz });
  program.ogretmenler.sort((a, b) => trSirala(a.ad, b.ad));
  return temiz;
}

/** Öğretmen adını listedeki yazımla eşleştirir (büyük/küçük harf farkını yok sayar). */
export function ogretmenAdiBul(program, ad) {
  const u = String(ad).trim().toLocaleUpperCase('tr-TR');
  return program.ogretmenler.find((o) => o.ad.toLocaleUpperCase('tr-TR') === u)?.ad ?? String(ad).trim();
}

/** Dersin bu güne ve saate konması, sınıf/öğretmenleri için boş mu? (sürüklerken ipucu için) */
export function yerBosMu(program, ders, gun, bas) {
  const bit = bas + ders.sure - 1;
  if (bas < 1 || bit > program.dersSayisi) return false;
  for (const s of ders.siniflar) if (aralikta(program, 'sinif', s, gun, bas, bit, ders.id).length) return false;
  for (const o of ders.ogretmenler) if (aralikta(program, 'ogretmen', o, gun, bas, bit, ders.id).length) return false;
  return true;
}

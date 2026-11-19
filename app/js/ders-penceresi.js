// Ders ekleme / düzenleme penceresi. Ders adı, sınıf ve öğretmenler açılır listeden seçilir.

import { el } from './view.js';
import { trUpper, trSirala } from './model.js';

const YENI = '__yeni__';

/**
 * @param program
 * @param baslangic { id?, ad, siniflar, ogretmenler, gun, bas, sure }
 * @param se { kaydet(alanlar), sil?() }
 */
export function dersPenceresiAc(program, baslangic, se) {
  const pencere = document.getElementById('dersPenceresi');
  const yeni = baslangic.id == null;
  const secim = { siniflar: [...baslangic.siniflar], ogretmenler: [...baslangic.ogretmenler] };

  // --- Ders adı ---
  const adlar = [...new Set([...(program.dersListesi ?? []).map((x) => x.ad), ...program.dersler.map((d) => d.ad)])].sort(trSirala);
  if (baslangic.ad && !adlar.includes(baslangic.ad)) adlar.unshift(baslangic.ad);
  const adSec = el('select', { id: 'dpAd' },
    el('option', { value: '', selected: !baslangic.ad, disabled: true }, '— Ders seçin —'),
    ...adlar.map((a) => el('option', { value: a, selected: a === baslangic.ad }, trUpper(a))),
    el('option', { value: YENI }, '+ Listede yok, yeni ders adı…'));
  const yeniAd = el('input', { id: 'dpYeniAd', placeholder: 'Yeni ders adı', hidden: true, autocomplete: 'off' });
  adSec.addEventListener('change', () => {
    yeniAd.hidden = adSec.value !== YENI;
    if (!yeniAd.hidden) yeniAd.focus();
  });

  // --- Sınıflar ---
  const sinifCipleri = el('div', { class: 'cipler' });
  const sinifSec = el('select', { id: 'dpSinif', 'aria-label': 'Sınıf ekle' });
  const siniflariCiz = () => {
    sinifCipleri.replaceChildren(...secim.siniflar.map((s) => cip(trUpper(s), () => { secim.siniflar = secim.siniflar.filter((x) => x !== s); siniflariCiz(); })));
    sinifSec.replaceChildren(el('option', { value: '' }, '+ Sınıf ekle'),
      ...program.siniflar.filter((s) => !secim.siniflar.includes(s.ad)).map((s) => el('option', { value: s.ad }, trUpper(s.ad))));
  };
  sinifSec.addEventListener('change', () => {
    if (sinifSec.value) secim.siniflar.push(sinifSec.value);
    siniflariCiz();
  });

  // --- Öğretmenler ---
  const ogrCipleri = el('div', { class: 'cipler' });
  const ogrSec = el('select', { id: 'dpOgretmen', 'aria-label': 'Öğretmen ekle' });
  const yeniOgr = el('input', { placeholder: 'Yeni öğretmenin adı soyadı', autocomplete: 'off', 'aria-label': 'Yeni öğretmen adı' });
  const yeniOgrSatiri = el('div', { class: 'satir', hidden: true }, yeniOgr,
    el('button', { type: 'button', class: 'btn', onclick: () => yeniOgretmenEkle() }, 'Ekle'));
  const ogrNot = el('p', { class: 'not' });
  const ogretmenleriCiz = () => {
    ogrCipleri.replaceChildren(...secim.ogretmenler.map((o) => cip(trUpper(o), () => { secim.ogretmenler = secim.ogretmenler.filter((x) => x !== o); ogretmenleriCiz(); })));
    ogrSec.replaceChildren(el('option', { value: '' }, '+ Öğretmen ekle'),
      ...program.ogretmenler.filter((o) => !secim.ogretmenler.includes(o.ad)).map((o) => el('option', { value: o.ad }, trUpper(o.ad))),
      el('option', { value: YENI }, '+ Listede yok, yeni öğretmen…'));
  };
  ogrSec.addEventListener('change', () => {
    if (ogrSec.value === YENI) { yeniOgrSatiri.hidden = false; yeniOgr.focus(); ogrSec.value = ''; return; }
    if (ogrSec.value) secim.ogretmenler.push(ogrSec.value);
    ogretmenleriCiz();
  });
  function yeniOgretmenEkle() {
    const ad = yeniOgr.value.trim().replace(/\s+/g, ' ');
    if (!ad) return;
    const kayitli = program.ogretmenler.find((o) => o.ad.toLocaleUpperCase('tr-TR') === ad.toLocaleUpperCase('tr-TR'))?.ad;
    const son = kayitli ?? ad;
    if (!secim.ogretmenler.includes(son)) secim.ogretmenler.push(son);
    ogrNot.textContent = kayitli ? '' : `"${trUpper(ad)}" öğretmen listesine de eklenecek.`;
    yeniOgr.value = '';
    yeniOgrSatiri.hidden = true;
    ogretmenleriCiz();
  }
  yeniOgr.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); yeniOgretmenEkle(); }
  });

  // --- Zaman ---
  const N = program.dersSayisi;
  const secici = (id, etiket, secenekler, deger) => {
    const s = el('select', { id }, ...secenekler.map(([v, t]) => el('option', { value: v, selected: String(v) === String(deger) }, t)));
    return el('label', { class: 'alan' }, el('span', {}, etiket), s);
  };
  const gunAlani = secici('dpGun', 'Gün', program.gunler.map((g, i) => [i, g]), baslangic.gun);
  const basAlani = secici('dpBas', 'Saat', Array.from({ length: N }, (_, i) => [i + 1, `${i + 1}. ders`]), baslangic.bas);
  const sureAlani = secici('dpSure', 'Süre', Array.from({ length: N }, (_, i) => [i + 1, i === 0 ? '1 saat' : `${i + 1} saat (blok)`]), baslangic.sure ?? 1);

  const hata = el('p', { class: 'hata-yazi', role: 'alert' });

  const form = el('form', { method: 'dialog', class: 'pencere' },
    el('h2', { id: 'dpBaslik' }, yeni ? 'Yeni Ders' : 'Dersi Düzenle'),
    el('label', { class: 'alan', for: 'dpAd' }, el('span', {}, 'Ders')), adSec, yeniAd,
    el('div', { class: 'alan' }, el('span', {}, 'Sınıflar'), sinifCipleri, sinifSec),
    el('div', { class: 'alan' }, el('label', { for: 'dpOgretmen' }, 'Öğretmenler'), ogrCipleri, ogrSec, yeniOgrSatiri, ogrNot),
    el('div', { class: 'zaman' }, gunAlani, basAlani, sureAlani),
    hata,
    el('div', { class: 'pencere-butonlar' },
      !yeni ? el('button', { type: 'button', class: 'btn btn-sil', onclick: () => { pencere.close(); se.sil?.(); } }, 'Dersi sil') : null,
      el('span', { class: 'bosluk' }),
      el('button', { type: 'button', class: 'btn', onclick: () => pencere.close() }, 'Vazgeç'),
      el('button', { type: 'button', class: 'btn btn-ana', onclick: kaydet }, 'Kaydet')),
  );

  function kaydet() {
    if (!yeniOgrSatiri.hidden && yeniOgr.value.trim()) yeniOgretmenEkle();
    const ad = adSec.value === YENI ? yeniAd.value.trim() : adSec.value;
    if (!ad) { hata.textContent = 'Ders seçin.'; (adSec.value === YENI ? yeniAd : adSec).focus(); return; }
    if (!secim.siniflar.length && !secim.ogretmenler.length) { hata.textContent = 'En az bir sınıf veya öğretmen seçin.'; return; }
    pencere.close();
    se.kaydet({
      ad,
      siniflar: secim.siniflar,
      ogretmenler: secim.ogretmenler,
      gun: Number(form.querySelector('#dpGun').value),
      bas: Number(form.querySelector('#dpBas').value),
      sure: Number(form.querySelector('#dpSure').value),
    });
  }

  siniflariCiz();
  ogretmenleriCiz();
  pencere.replaceChildren(form);
  pencere.showModal();
  adSec.focus();
}

function cip(metin, kaldir) {
  return el('span', { class: 'cip' }, metin,
    el('button', { type: 'button', 'aria-label': `${metin} kaldır`, onclick: kaldir }, '×'));
}

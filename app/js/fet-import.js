// FET (.fet) dosyasından program verisi çıkarır.
// Kaynak: <okul>_data_and_timetable.fet  (etkinlikler + kilitli yerleşimler)
// İsteğe bağlı: <okul>_activities.xml   (yerleşimi .fet'te bulunmayan etkinlikler için)

import { parseXml, kids, kid, txt } from './xml.js';
import { GUN_ADLARI } from './model.js';

const aktif = (el) => txt(el, 'Active') !== 'false';

/**
 * @param {string} fetMetni
 * @param {string} [activitiesXml]
 * @returns {{ ham, uyarilar: string[] }}
 */
export function fetOku(fetMetni, activitiesXml) {
  const uyarilar = [];
  const root = kid(parseXml(fetMetni), 'fet');
  if (!root) throw new Error('Bu dosya bir FET dosyası değil.');

  // Günler ve ders saatleri
  const gunAdlari = kids(kid(root, 'Days_List'), 'Day').map((d) => txt(d, 'Name'));
  const saatAdlari = kids(kid(root, 'Hours_List'), 'Hour').map((h) => txt(h, 'Name'));
  const gunIndex = new Map(gunAdlari.map((g, i) => [g, i]));
  const saatIndex = new Map(saatAdlari.map((h, i) => [h, i + 1]));
  const gunler = gunAdlari.map((g, i) => (/^D\d+$/i.test(g) ? GUN_ADLARI[i] ?? g : g));

  // Öğrenci yapısı: Yıl → Grup → Alt grup. Sınıf = Grup (grubu olmayan yıl kendisi sınıftır).
  const siniflar = [];
  const ogrenciSinif = new Map(); // ad → [sınıf adları]
  for (const yil of kids(kid(root, 'Students_List'), 'Year')) {
    const yilAd = txt(yil, 'Name');
    const gruplar = kids(yil, 'Group');
    if (!gruplar.length) {
      siniflar.push(yilAd);
      ogrenciSinif.set(yilAd, [yilAd]);
      continue;
    }
    const yilSiniflari = [];
    for (const g of gruplar) {
      const gAd = txt(g, 'Name');
      if (!siniflar.includes(gAd)) siniflar.push(gAd);
      yilSiniflari.push(gAd);
      ogrenciSinif.set(gAd, [gAd]);
      for (const sg of kids(g, 'Subgroup')) ogrenciSinif.set(txt(sg, 'Name'), [gAd]);
    }
    ogrenciSinif.set(yilAd, yilSiniflari);
  }

  const ogretmenler = kids(kid(root, 'Teachers_List'), 'Teacher').map((t) => txt(t, 'Name')).filter(Boolean);

  // Yerleşimler: kilitli / %100 tercih edilen başlangıç zamanı
  const yer = new Map();
  for (const c of kids(kid(root, 'Time_Constraints_List'), 'ConstraintActivityPreferredStartingTime')) {
    if (!aktif(c)) continue;
    if (Number(txt(c, 'Weight_Percentage') || 100) < 100) continue;
    const id = Number(txt(c, 'Activity_Id'));
    const gun = gunIndex.get(txt(c, 'Day'));
    const bas = saatIndex.get(txt(c, 'Hour'));
    if (gun == null || bas == null) continue;
    const kilitli = txt(c, 'Permanently_Locked') === 'true';
    if (!yer.has(id) || kilitli) yer.set(id, { gun, bas });
  }
  if (activitiesXml) {
    const at = kid(parseXml(activitiesXml), 'Activities_Timetable');
    for (const a of kids(at, 'Activity')) {
      const id = Number(txt(a, 'Id'));
      if (yer.has(id)) continue;
      const gun = gunIndex.get(txt(a, 'Day'));
      const bas = saatIndex.get(txt(a, 'Hour'));
      if (gun != null && bas != null) yer.set(id, { gun, bas });
    }
  }

  // Etkinlikler → dersler
  const dersler = [];
  let yerlesmemis = 0;
  for (const a of kids(kid(root, 'Activities_List'), 'Activity')) {
    if (!aktif(a)) continue;
    const id = Number(txt(a, 'Id'));
    const p = yer.get(id);
    if (!p) { yerlesmemis++; continue; }
    const sinifSet = [];
    for (const s of kids(a, 'Students')) {
      const ad = s.text.trim();
      const liste = ogrenciSinif.get(ad);
      if (!liste) { uyarilar.push(`Bilinmeyen öğrenci grubu: ${ad}`); continue; }
      for (const x of liste) if (!sinifSet.includes(x)) sinifSet.push(x);
    }
    dersler.push({
      id,
      ad: txt(a, 'Subject'),
      siniflar: sinifSet,
      ogretmenler: kids(a, 'Teacher').map((t) => t.text.trim()).filter(Boolean),
      gun: p.gun,
      bas: p.bas,
      sure: Math.max(1, Number(txt(a, 'Duration')) || 1),
    });
  }
  if (yerlesmemis) uyarilar.push(`${yerlesmemis} etkinliğin saati bulunamadı (programa eklenmedi).`);

  // Derslerde geçen ama listede olmayan öğretmenleri de ekle
  for (const d of dersler) for (const t of d.ogretmenler) if (!ogretmenler.includes(t)) ogretmenler.push(t);

  return {
    ham: { gunler, dersSayisi: saatAdlari.length, siniflar, ogretmenler, dersler },
    uyarilar,
  };
}

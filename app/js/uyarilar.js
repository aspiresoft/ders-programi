// Çakışma uyarıları. Hiçbir işlem engellenmez; burada yalnızca tespit edilir.

import { trUpper, dersAraligi, dersProfili, dersSaati } from './model.js';

const dersEtiketi = (d) => `${trUpper(d.ad)}${d.siniflar.length ? ` (${trUpper(d.siniflar.join(', '))})` : ''}`;
const saatEtiketi = (program, d) => `${program.gunler[d.gun]} ${d.bas}.${d.sure > 1 ? `–${d.bas + d.sure - 1}.` : ''} ders`;

/**
 * @returns {{ liste: Array<{ mesaj, dersIdler: number[], varliklar: Array<{tur, ad}> }>, dersler: Set<number> }}
 */
export function uyarilariBul(program) {
  const liste = [];
  const ekle = (mesaj, dersler, varliklar) => liste.push({ mesaj, dersIdler: dersler.map((d) => d.id), varliklar });

  // Saat dışında kalan dersler
  for (const d of program.dersler) {
    const p = dersProfili(program, d);
    const sonNo = d.bas + d.sure - 1;
    if (d.bas < 1 || sonNo > program.dersSayisi || !dersSaati(p, d.bas) || !dersSaati(p, sonNo)) {
      ekle(`${dersEtiketi(d)} günün ders saatlerinin dışında kalıyor.`, [d],
        [...d.siniflar.map((ad) => ({ tur: 'sinif', ad })), ...d.ogretmenler.map((ad) => ({ tur: 'ogretmen', ad }))]);
    }
  }

  // Sınıf çakışmaları: aynı sınıfta aynı saatte birden fazla ders
  for (const s of program.siniflar) {
    const ds = program.dersler.filter((d) => d.siniflar.includes(s.ad));
    ciftleriBul(ds, (a, b) => a.gun === b.gun && a.bas <= b.bas + b.sure - 1 && b.bas <= a.bas + a.sure - 1, (a, b) =>
      ekle(`${trUpper(s.ad)} sınıfında aynı saatte iki ders var: ${saatEtiketi(program, b)} – ${trUpper(a.ad)} ve ${trUpper(b.ad)}.`,
        [a, b], [{ tur: 'sinif', ad: s.ad }]));
  }

  // Öğretmen çakışmaları: gerçek saatleri örtüşen dersler (farklı saat profilleri dahil)
  for (const o of program.ogretmenler) {
    const ds = program.dersler.filter((d) => d.ogretmenler.includes(o.ad));
    const aralik = new Map(ds.map((d) => [d.id, dersAraligi(program, d, o.ad)]));
    ciftleriBul(ds, (a, b) => {
      if (a.gun !== b.gun) return false;
      const x = aralik.get(a.id), y = aralik.get(b.id);
      if (!x || !y) return a.bas <= b.bas + b.sure - 1 && b.bas <= a.bas + a.sure - 1;
      return x.basDk < y.bitDk && y.basDk < x.bitDk;
    }, (a, b) => {
      const varliklar = [{ tur: 'ogretmen', ad: o.ad }];
      for (const s of [...a.siniflar, ...b.siniflar]) if (!varliklar.some((v) => v.ad === s)) varliklar.push({ tur: 'sinif', ad: s });
      ekle(`${trUpper(o.ad)} aynı saatte iki derste: ${program.gunler[a.gun]} – ${dersEtiketi(a)} ve ${dersEtiketi(b)}.`, [a, b], varliklar);
    });
  }

  const dersler = new Set(liste.flatMap((u) => u.dersIdler));
  return { liste, dersler };
}

function ciftleriBul(ds, cakisirMi, bildir) {
  const sirali = [...ds].sort((a, b) => a.gun - b.gun || a.bas - b.bas);
  for (let i = 0; i < sirali.length; i++) {
    for (let j = i + 1; j < sirali.length; j++) {
      if (sirali[j].gun !== sirali[i].gun) break;
      if (cakisirMi(sirali[i], sirali[j])) bildir(sirali[i], sirali[j]);
    }
  }
}

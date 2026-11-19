// Sayfa düzeni: bir sınıf veya öğretmen için sütunları ve hücreleri hesaplar.
// Hem PDF çizici hem de ekrandaki editör bu düzeni kullanır.
//
// Sayfa = {
//   tur: 'sinif' | 'ogretmen', ad, rozetler: [{ etiket, deger }],
//   sutunlar: [ { tur: 'sabit', ad, bas, bit, saat, sure, renk } | { tur: 'ders', no, baslik, saat, sure } ],
//   satirlar: [ { gun, gunIndex, kisa, hucreler: [ { sutun, genislik, no, dersler: [ders], ust, alt, saat, renk } ] } ]
// }
// "sutun": sutunlar dizisindeki başlangıç indeksi; "genislik": kapladığı ders sütunu sayısı.
// "saat": "09:35 - 10:15", "sure": "40 dk"; renk: colors.js PALET öğesi.

import {
  trUpper, gunKisa, profilBul, sinifBul, dersSaati, dersProfili, sureYaz, sureDk,
  sinifDersleri, ogretmenDersleri, ogretmenProfilleri, haftalikDersSaati,
} from './model.js';
import { dersRengi, sabitRengi } from './colors.js';

const saatYaz = (a, b) => (a && b ? `${a} - ${b}` : '');

function sabitSutun(ad, r) {
  return { tur: 'sabit', ad, bas: r.bas, bit: r.bit, saat: saatYaz(r.bas, r.bit), sure: sureYaz(r.bas, r.bit), renk: sabitRengi(r.ad, r.renk) };
}

/** Tek profilden sütun listesi. */
function profilSutunlari(profil) {
  return profil.satirlar.map((r) =>
    r.tur === 'ders'
      ? { tur: 'ders', no: r.no, baslik: `${r.no}. DERS`, saat: saatYaz(r.bas, r.bit), sure: sureYaz(r.bas, r.bit) }
      : sabitSutun(trUpper(r.ad), r));
}

/** Birden fazla profili tek sütun düzeninde birleştirir (ör. İlkokul + Ortaokul). */
function birlesikSutunlar(profiller, dersSayisi) {
  // Her sabit bölümün kaç dersten sonra geldiği (boşluk indeksi)
  const bosluklar = Array.from({ length: dersSayisi + 1 }, () => []);
  for (const p of profiller) {
    let once = 0;
    for (const r of p.satirlar) {
      if (r.tur === 'ders') { once = Math.max(once, r.no); continue; }
      const g = Math.min(once, dersSayisi);
      const var_ = bosluklar[g].find((x) => trUpper(x.r.ad) === trUpper(r.ad) && x.r.bas === r.bas && x.r.bit === r.bit);
      if (var_) var_.profiller.push(p);
      else bosluklar[g].push({ r, profiller: [p] });
    }
  }
  const etiket = (p) => p.kisa || p.ad;
  const sutunlar = [];
  for (let g = 0; g <= dersSayisi; g++) {
    const liste = bosluklar[g].sort((a, b) => a.r.bas.localeCompare(b.r.bas));
    for (const s of liste) {
      const herkes = s.profiller.length === profiller.length;
      const ek = herkes ? '' : ` (${s.profiller.map(etiket).join('/')})`;
      sutunlar.push(sabitSutun(trUpper(s.r.ad) + ek, s.r));
    }
    if (g < dersSayisi) {
      const no = g + 1;
      const saatler = profiller.map((p) => ({ p, r: dersSaati(p, no) })).filter((x) => x.r);
      const ayniSaat = saatler.every((x) => x.r.bas === saatler[0]?.r.bas && x.r.bit === saatler[0]?.r.bit);
      const sureler = saatler.map((x) => sureYaz(x.r.bas, x.r.bit));
      const ayniSure = sureler.every((x) => x === sureler[0]);
      const saat = !saatler.length ? ''
        : ayniSaat ? saatYaz(saatler[0].r.bas, saatler[0].r.bit)
          : saatler.map((x) => `${etiket(x.p)}:${x.r.bas}`).join(' / ');
      const sure = !saatler.length ? ''
        : ayniSure ? sureler[0]
          : saatler.map((x, i) => `${etiket(x.p)}:${sureler[i]}`).join(' / ');
      sutunlar.push({ tur: 'ders', no, baslik: `${no}. DERS`, saat, sure });
    }
  }
  return sutunlar;
}

/** Ders hücresinin görünüm anahtarı: aynı anahtarlı yan yana hücreler birleştirilir. */
const anahtar = (d) => (d ? `${d.ad}|${d.siniflar.join(',')}|${d.ogretmenler.join(',')}` : '');

// gorsel: PDF'teki gibi aynı içerikli yan yana dersleri tek hücrede göster.
// editor: yalnızca gerçek blokları (aynı ders) birleştir; ayrı dersler ayrı hücre kalsın.
function satirlariKur(program, sutunlar, dersListesi, hucreMetni, editor = false) {
  const ayniMi = editor ? (a, b) => a.id === b.id : (a, b) => anahtar(a) === anahtar(b);

  return program.gunler.map((gun, gunIndex) => {
    // Bu gün, her ders saatinde hangi dersler var?
    const slot = new Map();
    for (const d of dersListesi) {
      if (d.gun !== gunIndex) continue;
      for (let k = 0; k < d.sure; k++) {
        const no = d.bas + k;
        if (!slot.has(no)) slot.set(no, []);
        slot.get(no).push(d);
      }
    }
    const hucreler = [];
    let i = 0;
    while (i < sutunlar.length) {
      const s = sutunlar[i];
      if (s.tur !== 'ders') { i++; continue; }
      const burada = slot.get(s.no) ?? [];
      const ilk = burada[0] ?? null;
      let genislik = 1;
      // Ara sütun gelmediği sürece aynı dersle devam eden hücreleri birleştir
      while (ilk && burada.length === 1) {
        const sonraki = sutunlar[i + genislik];
        if (!sonraki || sonraki.tur !== 'ders') break;
        const o = slot.get(sonraki.no) ?? [];
        if (o.length !== 1 || !ayniMi(o[0], ilk)) break;
        genislik++;
      }
      const sonNo = sutunlar[i + genislik - 1].no;
      const h = { sutun: i, genislik, no: s.no, dersler: burada };
      if (ilk) Object.assign(h, hucreMetni(ilk, burada, s.no, sonNo), { renk: dersRengi(ilk.ad, program) });
      hucreler.push(h);
      i += genislik;
    }
    return { gun, gunIndex, kisa: gunKisa(gun), hucreler };
  });
}

/** "09:35 - 11:05 (80dk)" — süre, aradaki teneffüsler hariç ders sürelerinin toplamıdır */
function aralikMetni(program, ders, basNo, sonNo, ogretmenAd) {
  const p = dersProfili(program, ders, ogretmenAd);
  const a = dersSaati(p, basNo);
  const b = dersSaati(p, sonNo);
  if (!a || !b) return '';
  let toplam = 0;
  for (let no = basNo; no <= sonNo; no++) {
    const r = dersSaati(p, no);
    if (r) toplam += sureDk(r.bas, r.bit);
  }
  return `${saatYaz(a.bas, b.bit)}${toplam ? ` (${toplam}dk)` : ''}`;
}

export function sinifSayfasi(program, sinifAd, { editor = false } = {}) {
  const sinif = sinifBul(program, sinifAd);
  const profil = profilBul(program, sinif?.profil);
  const sutunlar = profilSutunlari(profil);
  const satirlar = satirlariKur(program, sutunlar, sinifDersleri(program, sinifAd), (d, hepsi, basNo, sonNo) => ({
    ust: hepsi.map((x) => trUpper(x.ad)).join(' / '),
    alt: trUpper(hepsi.flatMap((x) => x.ogretmenler).filter((v, i, a) => a.indexOf(v) === i).join(', ')),
    saat: aralikMetni(program, d, basNo, sonNo),
  }), editor);
  const rozetler = sinif?.rehber ? [{ etiket: 'Sınıf Rehber Öğretmeni', deger: trUpper(sinif.rehber) }] : [];
  return { tur: 'sinif', ad: trUpper(sinifAd), anahtarAd: sinifAd, rozetler, sutunlar, satirlar };
}

export function ogretmenSayfasi(program, ogrAd, { editor = false } = {}) {
  let profiller = ogretmenProfilleri(program, ogrAd);
  if (!profiller.length) profiller = [profilBul(program, program.varsayilanProfil)];
  // Birleşik düzende profiller okulun profil sırasına göre dursun
  profiller.sort((a, b) => program.profiller.indexOf(a) - program.profiller.indexOf(b));
  const sutunlar = profiller.length === 1 ? profilSutunlari(profiller[0]) : birlesikSutunlar(profiller, program.dersSayisi);
  const satirlar = satirlariKur(program, sutunlar, ogretmenDersleri(program, ogrAd), (d, hepsi, basNo, sonNo) => {
    const siniflar = hepsi.flatMap((x) => x.siniflar).filter((v, i, a) => a.indexOf(v) === i);
    const adlar = hepsi.map((x) => trUpper(x.ad)).join(' / ');
    return {
      ust: siniflar.length ? trUpper(siniflar.join(', ')) : adlar,
      alt: siniflar.length ? adlar : '',
      saat: aralikMetni(program, d, basNo, sonNo, ogrAd),
    };
  }, editor);
  const rozetler = [{ etiket: 'Haftalık Ders Saati', deger: String(haftalikDersSaati(program, ogrAd)) }];
  return { tur: 'ogretmen', ad: trUpper(ogrAd), anahtarAd: ogrAd, rozetler, sutunlar, satirlar };
}

export const tumSinifSayfalari = (program) => program.siniflar.map((s) => sinifSayfasi(program, s.ad));
export const tumOgretmenSayfalari = (program) => program.ogretmenler.map((o) => ogretmenSayfasi(program, o.ad));

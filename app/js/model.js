// Program veri modeli ve ortak yardımcılar.
//
// Program = {
//   format: 'ders-programi', surum: 1,
//   meta: { versiyon, tarih, kaynak },
//   okul: { ad, baslik, dosyaAdi, logo: { tip: 'png'|'jpg', veri: base64 } | null },
//   gunler: ['Pazartesi', ...],
//   dersSayisi: 8,
//   varsayilanProfil: 'genel',
//   profiller: [{ id, ad, kisa, satirlar: [{ tur:'ders', no, bas, bit } | { tur:'sabit', ad, bas, bit }] }],
//   siniflar: [{ ad, profil, rehber }],
//   ogretmenler: [{ ad }],
//   dersler: [{ id, ad, siniflar: [], ogretmenler: [], gun, bas, sure }],   // gun: 0..; bas: 1..dersSayisi
//   ayarlar: { haftalikSaatHaric: [] }
// }

export const FORMAT = 'ders-programi';
export const SURUM = 1;

export const VARSAYILAN_HARIC = ['ZÜMRE', 'ZUMRE', 'ŞÖK', 'TOPLANTI'];
export const GUN_ADLARI = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];

/** Türkçe kurallarına uygun büyük harf (i → İ, ı → I). */
export const trUpper = (s) => String(s ?? '').toLocaleUpperCase('tr-TR');

export const gunKisa = (ad) => {
  const s = String(ad);
  return s.slice(0, 1).toLocaleUpperCase('tr-TR') + s.slice(1, 2).toLocaleLowerCase('tr-TR');
};

/** "09:35" → 575 dakika */
export const dk = (hhmm) => {
  const m = /^(\d{1,2})[:.](\d{2})$/.exec(String(hhmm).trim());
  return m ? +m[1] * 60 + +m[2] : NaN;
};

export const saatNormalize = (s) => {
  const m = /^(\d{1,2})[:.](\d{2})$/.exec(String(s).trim());
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : String(s).trim();
};

export function profilBul(program, id) {
  return program.profiller.find((p) => p.id === id) ?? program.profiller.find((p) => p.id === program.varsayilanProfil) ?? program.profiller[0];
}

export function sinifBul(program, ad) {
  return program.siniflar.find((s) => s.ad === ad);
}

/** Profil içinde n. dersin saatleri. */
export function dersSaati(profil, no) {
  return profil.satirlar.find((r) => r.tur === 'ders' && r.no === no) ?? null;
}

/** Bir dersin (bloğun) ait olduğu saat profili. Sınıfı yoksa öğretmenin profili kullanılır. */
export function dersProfili(program, ders, ogretmenAd) {
  if (ders.siniflar.length) {
    const s = sinifBul(program, ders.siniflar[0]);
    if (s) return profilBul(program, s.profil);
  }
  if (ogretmenAd) return ogretmenAnaProfil(program, ogretmenAd);
  if (ders.ogretmenler.length) return ogretmenAnaProfil(program, ders.ogretmenler[0]);
  return profilBul(program, program.varsayilanProfil);
}

/** Dersin gerçek başlangıç-bitiş saati (dakika). */
export function dersAraligi(program, ders, ogretmenAd) {
  const p = dersProfili(program, ders, ogretmenAd);
  const a = dersSaati(p, ders.bas);
  const b = dersSaati(p, ders.bas + ders.sure - 1);
  if (!a || !b) return null;
  return { bas: a.bas, bit: b.bit, basDk: dk(a.bas), bitDk: dk(b.bit) };
}

export const sinifDersleri = (program, sinifAd) => program.dersler.filter((d) => d.siniflar.includes(sinifAd));
export const ogretmenDersleri = (program, ogrAd) => program.dersler.filter((d) => d.ogretmenler.includes(ogrAd));

/** Öğretmenin girdiği sınıfların profilleri (sık kullanılandan aza). */
export function ogretmenProfilleri(program, ogrAd) {
  const say = new Map();
  for (const d of ogretmenDersleri(program, ogrAd)) {
    for (const sAd of d.siniflar) {
      const s = sinifBul(program, sAd);
      if (!s) continue;
      say.set(s.profil, (say.get(s.profil) ?? 0) + d.sure);
    }
  }
  const ids = [...say.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
  return ids.map((id) => profilBul(program, id)).filter((p, i, arr) => p && arr.indexOf(p) === i);
}

export function ogretmenAnaProfil(program, ogrAd) {
  return ogretmenProfilleri(program, ogrAd)[0] ?? profilBul(program, program.varsayilanProfil);
}

/** Haftalık ders saati: sınıfı olan ve hariç kelimelere uymayan derslerin süreleri toplamı. */
export function haftalikDersSaati(program, ogrAd) {
  const haric = (program.ayarlar?.haftalikSaatHaric ?? VARSAYILAN_HARIC).map(trUpper);
  let t = 0;
  for (const d of ogretmenDersleri(program, ogrAd)) {
    if (!d.siniflar.length) continue;
    const ad = trUpper(d.ad);
    if (haric.some((k) => k && ad.includes(k))) continue;
    t += d.sure;
  }
  return t;
}

export function yeniDersId(program) {
  return program.dersler.reduce((m, d) => Math.max(m, d.id), 0) + 1;
}

export const bugun = () => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
};

/** Türkçe sıralama */
export const trSirala = (a, b) => a.localeCompare(b, 'tr-TR', { numeric: true });

/** İki saat arasındaki süre (dakika) */
export const sureDk = (bas, bit) => {
  const s = dk(bit) - dk(bas);
  return Number.isFinite(s) && s > 0 ? s : 0;
};
/** "40dk" */
export const sureYaz = (bas, bit) => {
  const s = sureDk(bas, bit);
  return s ? `${s}dk` : '';
};

/**
 * Eksik alanları tamamlar (eski kayıtlar için): ders adları listesi ve görünüm ayarları.
 * Programı yerinde değiştirir ve döndürür.
 */
export function programiHazirla(program) {
  program.gorunum ??= { yazi: 'inter' };
  program.dersListesi ??= [];
  const var_ = new Set(program.dersListesi.map((x) => x.ad));
  for (const d of program.dersler) {
    if (!var_.has(d.ad)) { program.dersListesi.push({ ad: d.ad, renk: null }); var_.add(d.ad); }
  }
  program.dersListesi.sort((a, b) => trSirala(a.ad, b.ad));
  return program;
}

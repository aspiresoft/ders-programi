// okul.json → program ayarları
//
// okul.json biçimi (elle yazması kolay olsun diye kısa tutuldu):
// {
//   "okul": { "ad": "Manisa İsabet Okulları", "baslik": "MANİSA İSABET OKULLARI", "dosyaAdi": "manisa" },
//   "gunler": ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma"],          (isteğe bağlı)
//   "varsayilanProfil": "genel",
//   "profiller": [
//     { "id": "genel", "ad": "Genel", "kisa": "",
//       "satirlar": [ { "sabit": "KAHVALTI", "saat": "09:00-09:35" }, { "ders": 1, "saat": "09:35-10:15" }, ... ] }
//   ],
//   "profilKurallari": [ { "desen": "^[5-8]-", "profil": "ortaokul" } ],     (sırayla, ilk eşleşen)
//   "siniflar": { "5-A": { "rehber": "AD SOYAD", "profil": "ortaokul" } },   (isteğe bağlı)
//   "haftalikSaatHaric": ["ZÜMRE", "ŞÖK", "TOPLANTI"],                        (isteğe bağlı)
//   "gorunum": { "yazi": "inter" },              inter | outfit | nunito | roboto | google-sans (isteğe bağlı)
//   "dersRenkleri": { "Matematik": "turuncu" }   renk adları colors.js PALET'inde (isteğe bağlı)
// }
// Sabit bölüm satırlarına "renk": "sari" gibi bir renk de verilebilir.

import { VARSAYILAN_HARIC, saatNormalize, programiHazirla } from './model.js';

/** okul.json metnini okur (Not Defteri'nin eklediği BOM karakterini yok sayar). */
export function okulAyariOku(metin) {
  try {
    return JSON.parse(String(metin).replace(/^﻿/, ''));
  } catch (e) {
    throw new Error(`okul.json okunamadı: ${e.message}`);
  }
}

function saatAyir(s) {
  const [a, b] = String(s).split('-').map((x) => saatNormalize(x));
  return { bas: a, bit: b };
}

export function profilleriCevir(liste) {
  return (liste ?? []).map((p) => ({
    id: String(p.id),
    ad: p.ad ?? String(p.id),
    kisa: p.kisa ?? '',
    satirlar: (p.satirlar ?? []).map((r) => {
      if (r.tur) return { ...r };
      const { bas, bit } = saatAyir(r.saat);
      return r.ders != null ? { tur: 'ders', no: Number(r.ders), bas, bit } : { tur: 'sabit', ad: String(r.sabit), bas, bit, renk: r.renk ?? null };
    }),
  }));
}

/** Okul ayarına göre bir sınıfın profil kimliği. */
export function sinifProfiliSec(ayar, sinifAd) {
  const ozel = ayar.siniflar?.[sinifAd]?.profil;
  if (ozel) return ozel;
  for (const k of ayar.profilKurallari ?? []) {
    try {
      if (new RegExp(k.desen, 'iu').test(sinifAd)) return k.profil;
    } catch { /* hatalı desen: atla */ }
  }
  return ayar.varsayilanProfil ?? ayar.profiller?.[0]?.id;
}

/**
 * Okul ayarı + ham program verisinden tam program nesnesi oluşturur.
 * ham = { gunler, dersSayisi, siniflar: [ad], ogretmenler: [ad], dersler: [...] }
 */
export function programOlustur(ayar, ham, logo, kaynak) {
  const profiller = profilleriCevir(ayar.profiller);
  if (!profiller.length) {
    // Saat bilgisi verilmemişse yalnızca ders numaralarından oluşan bir profil kur.
    profiller.push({
      id: 'genel', ad: 'Genel', kisa: '',
      satirlar: Array.from({ length: ham.dersSayisi }, (_, i) => ({ tur: 'ders', no: i + 1, bas: '', bit: '' })),
    });
  }
  const varsayilanProfil = ayar.varsayilanProfil && profiller.some((p) => p.id === ayar.varsayilanProfil)
    ? ayar.varsayilanProfil : profiller[0].id;
  const gecerli = (id) => (profiller.some((p) => p.id === id) ? id : varsayilanProfil);

  return programiHazirla({
    format: 'ders-programi',
    surum: 1,
    meta: { versiyon: 1, tarih: '', kaynak },
    gorunum: { yazi: ayar.gorunum?.yazi ?? 'inter' },
    dersListesi: Object.entries(ayar.dersRenkleri ?? {}).map(([ad, renk]) => ({ ad, renk })),
    okul: {
      ad: ayar.okul?.ad ?? '',
      baslik: ayar.okul?.baslik ?? ayar.okul?.ad ?? '',
      dosyaAdi: ayar.okul?.dosyaAdi ?? 'okul',
      logo: logo ?? null,
    },
    gunler: ayar.gunler?.length ? ayar.gunler.slice(0, ham.gunler.length) : ham.gunler,
    dersSayisi: ham.dersSayisi,
    varsayilanProfil,
    profiller,
    siniflar: ham.siniflar.map((ad) => ({
      ad,
      profil: gecerli(sinifProfiliSec(ayar, ad)),
      rehber: ayar.siniflar?.[ad]?.rehber ?? '',
    })),
    ogretmenler: ham.ogretmenler.map((ad) => ({ ad })),
    dersler: ham.dersler,
    ayarlar: { haftalikSaatHaric: ayar.haftalikSaatHaric ?? VARSAYILAN_HARIC },
  });
}

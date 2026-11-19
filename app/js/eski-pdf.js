// Eski (veri eki olmayan) ders programı PDF'lerini okur.
// Eski Python script'leriyle (Manisa, Gaziemir, Bayraklı) üretilmiş sınıf + öğretmen PDF'leri için.
//
// Girdi sayfa biçimi (pdf.js'ten bağımsız):
//   { width, height, items: [{ str, x, y, w, size, rot }] }   y: sayfanın üstünden taban çizgisine uzaklık
//
// Yöntem:
//   * Başlıktaki "N. DERS" yazıları ders sütunlarını, saatleri ve x konumlarını verir.
//   * Gün etiketleri (Pa, Sa, ...) satırları verir.
//   * Her ders hücresinin altındaki saat kutusu ("09:35 - 11:05") hücrenin kesin saat aralığını verir;
//     hücredeki diğer satırlar bu kutuya yatayda en yakın olanlardır.
//   * En büyük yazı = ders adı (sınıf sayfası) / sınıflar (öğretmen sayfası); küçük yazı = öğretmenler / ders adı.

import { trUpper, saatNormalize, VARSAYILAN_HARIC, programiHazirla } from './model.js';

const SAAT_ARALIGI = /^(\d{1,2}[:.]\d{2})\s*[-–]\s*(\d{1,2}[:.]\d{2})$/;
const DERS_BASLIK = /^(\d{1,2})\s*\.\s*DERS$/i;
const GUN_KISA = /^(Pa|Sa|Ça|Pe|Cu|Ct|Pz)$/;
const yakin = (a, b, t) => Math.abs(a - b) <= t;
const merkez = (it) => it.x + it.w / 2;
// Harf aralıklı yazı ("M A N İ S A", "B AY R A K L I") → "MANİSA"
const harfAraliksiz = (s) => {
  const p = s.trim().split(/\s+/);
  return p.length > 1 && p.filter((x) => x.length <= 1).length >= p.length * 0.6 ? p.join('') : s.trim();
};
// Karşılaştırma için: büyük harf, boşluk ve noktalama farkını yok say
const esitle = (s) => trUpper(s).replace(/[^0-9A-ZÇĞİÖŞÜ]/g, '');

// ---------------------------------------------------------------- Sayfa çözümleme

export function sayfaCoz(sayfa) {
  const items = sayfa.items.filter((it) => it.str.trim());
  const duz = items.filter((it) => !it.rot);

  // Ders sütunları
  const dersBasliklari = duz.filter((it) => DERS_BASLIK.test(it.str.trim()))
    .map((it) => ({ no: Number(DERS_BASLIK.exec(it.str.trim())[1]), cx: merkez(it), y: it.y }))
    .sort((a, b) => a.cx - b.cx);
  if (!dersBasliklari.length) return null;
  const baslikY = Math.min(...dersBasliklari.map((d) => d.y));

  // Gün satırları
  const ilkSutunX = dersBasliklari[0].cx;
  const gunEtiketleri = duz.filter((it) => GUN_KISA.test(it.str.trim()) && merkez(it) < ilkSutunX - 30 && it.y > baslikY)
    .sort((a, b) => a.y - b.y);
  if (!gunEtiketleri.length) return null;
  const gunler = gunEtiketleri.map((g) => {
    const uzun = duz.find((it) => it !== g && it.y > g.y && it.y < g.y + 15 && yakin(merkez(it), merkez(g), 20));
    // Gün hücresinin dikey ortası (kısa ad üstte, uzun ad altta)
    const orta = ((g.y - g.size * 0.75) + (uzun ? uzun.y : g.y)) / 2;
    return { kisa: g.str.trim(), ad: uzun?.str.trim() ?? g.str.trim(), y: g.y, orta };
  });
  // Başlık satırının altı: başlık bandındaki en alttaki yazı
  const basBant = duz.filter((it) => it.y >= baslikY - 14 && it.y <= baslikY + 22);
  const satirUst = Math.max(...basBant.map((it) => it.y)) + 2;
  // Satır yükseklikleri içeriğe göre değişebilir: gün etiketi satırın ortasındadır
  const satirlar = [];
  let satirBas = satirUst;
  gunler.forEach((g, i) => {
    let alt = 2 * g.orta - satirBas;
    const sonraki = gunler[i + 1];
    if (sonraki) alt = Math.min(Math.max(alt, g.y + 8), sonraki.orta - 10);
    else alt = Math.max(alt, sayfa.height);
    satirlar.push({ ...g, ust: satirBas, alt });
    satirBas = alt;
  });

  // Başlık bandındaki öğeler: ders sütunlarına veya sabit (mola) sütunlarına ait
  const gunX = merkez(gunEtiketleri[0]);
  const bant = duz.filter((it) => it.y >= baslikY - 14 && it.y < satirUst && merkez(it) > gunX + 12);
  const dersSutun = dersBasliklari.map((d) => ({ ...d, saatler: [] }));
  const sabitOgeler = [];
  for (const it of bant) {
    const enYakin = dersSutun.reduce((m, d) => (Math.abs(d.cx - merkez(it)) < Math.abs(m.cx - merkez(it)) ? d : m));
    if (Math.abs(enYakin.cx - merkez(it)) < 22) {
      if (!DERS_BASLIK.test(it.str.trim())) enYakin.saatler.push(it.str.trim());
    } else sabitOgeler.push(it);
  }
  for (const d of dersSutun) {
    const m = SAAT_ARALIGI.exec(d.saatler.join(' ').trim());
    d.bas = m ? saatNormalize(m[1]) : '';
    d.bit = m ? saatNormalize(m[2]) : '';
  }

  // Sabit sütunları x'e göre kümele
  sabitOgeler.sort((a, b) => merkez(a) - merkez(b));
  const sabitler = [];
  for (const it of sabitOgeler) {
    const son = sabitler.at(-1);
    if (son && Math.abs(son.cx - merkez(it)) < 12) { son.ogeler.push(it); son.cx = (son.cx + merkez(it)) / 2; }
    else sabitler.push({ cx: merkez(it), ogeler: [it] });
  }
  // Dikey (döndürülmüş) yazılar: mola sütunlarının tam adı
  const dikeyler = [];
  for (const it of items.filter((x) => x.rot).sort((a, b) => a.x - b.x)) {
    const son = dikeyler.at(-1);
    if (son && Math.abs(son.x - it.x) < 4) son.ogeler.push(it);
    else dikeyler.push({ x: it.x, ogeler: [it] });
  }
  for (const s of sabitler) {
    const metin = s.ogeler.sort((a, b) => a.y - b.y || a.x - b.x).map((x) => x.str.trim()).join(' ');
    const saat = /(\d{1,2}[:.]\d{2})\s*[-–]\s*(\d{1,2}[:.]\d{2})/.exec(metin);
    s.bas = saat ? saatNormalize(saat[1]) : '';
    s.bit = saat ? saatNormalize(saat[2]) : '';
    s.ad = metin.replace(/(\d{1,2}[:.]\d{2})\s*[-–]?/g, '').replace(/\s+/g, ' ').trim();
    const dikey = dikeyler.find((d) => yakin(d.x, s.cx, 14));
    if (dikey) {
      // Aşağıdan yukarı okunur: sayfada alttaki kelime önce gelir
      const ad = dikey.ogeler.sort((a, b) => b.y - a.y).map((x) => harfAraliksiz(x.str.trim())).join(' ');
      s.ad = ad.replace(/\s+(İLKOKUL|ORTAOKUL|ANASINIFI)$/i, '').trim();
    }
  }

  // Üst bilgi: ad, okul başlığı, rozetler
  const ust = duz.filter((it) => it.y < baslikY - 14);
  const enBuyuk = Math.max(...ust.map((it) => it.size), 0);
  const ad = ust.filter((it) => yakin(it.size, enBuyuk, 0.5)).sort((a, b) => a.y - b.y || a.x - b.x).map((it) => it.str.trim()).join(' ');
  const ortaX = sayfa.width / 2;
  const baslik = ust.filter((it) => it.size < enBuyuk - 2 && Math.abs(merkez(it) - ortaX) < sayfa.width * 0.2)
    .sort((a, b) => a.y - b.y || a.x - b.x);
  const okulBasligi = baslik.length ? baslik.filter((it) => yakin(it.y, baslik[0].y, 2)).map((it) => harfAraliksiz(it.str.trim())).join(' ') : '';
  const sagMetin = satirMetinleri(ust.filter((it) => merkez(it) > sayfa.width * 0.68));
  const rehberM = /Sınıf\s+(?:Rehber\s+)?Öğretmeni\s*:\s*(.+)/i.exec(sagMetin.join('\n'));
  const ogretmenRozeti = sagMetin.some((s) => /Haftalık Ders Saati|Öğretmeni$/i.test(s.trim()) && !/Sınıf/i.test(s));

  // Gövde hücreleri
  const govde = duz.filter((it) => it.y > satirUst && it.y < satirlar.at(-1).alt && merkez(it) > gunX + 15
    && !gunEtiketleri.includes(it) && !gunler.some((g) => g.ad === it.str.trim() && merkez(it) < ilkSutunX - 30));
  const hucreler = [];
  satirlar.forEach((satir, gunIndex) => {
    const bunlar = govde.filter((it) => it.y > satir.ust && it.y <= satir.alt);
    const kutular = bunlar.filter((it) => SAAT_ARALIGI.test(it.str.trim()));
    if (!kutular.length) return;
    const kutuBoyu = Math.min(...kutular.map((k) => k.size));
    const saatKutulari = kutular.filter((k) => yakin(k.size, kutuBoyu, 0.3));
    const gruplar = saatKutulari.map((k) => ({ kutu: k, ogeler: [] }));
    for (const it of bunlar) {
      if (saatKutulari.includes(it) || it.str.trim() === '---') continue;
      const g = gruplar.reduce((m, x) => (Math.abs(merkez(x.kutu) - merkez(it)) < Math.abs(merkez(m.kutu) - merkez(it)) ? x : m));
      if (Math.abs(merkez(g.kutu) - merkez(it)) < 60 && it.y <= g.kutu.y + 1) g.ogeler.push(it);
    }
    for (const g of gruplar) {
      const m = SAAT_ARALIGI.exec(g.kutu.str.trim());
      const boy = Math.max(...g.ogeler.map((it) => it.size), 0);
      const birincil = satirMetinleri(g.ogeler.filter((it) => yakin(it.size, boy, 0.3))).join(' ');
      const ikincil = satirMetinleri(g.ogeler.filter((it) => !yakin(it.size, boy, 0.3))).join(' ');
      if (!birincil) continue;
      hucreler.push({ gun: gunIndex, cx: merkez(g.kutu), bas: saatNormalize(m[1]), bit: saatNormalize(m[2]), birincil, ikincil });
    }
  });

  // Sütun sırası (profil için): ders ve sabit sütunları x'e göre
  const sutunlar = [
    ...dersSutun.map((d) => ({ tur: 'ders', no: d.no, cx: d.cx, bas: d.bas, bit: d.bit })),
    ...sabitler.map((s) => ({ tur: 'sabit', ad: s.ad, cx: s.cx, bas: s.bas, bit: s.bit })),
  ].sort((a, b) => a.cx - b.cx);

  return {
    ad, okulBasligi, rehber: rehberM ? rehberM[1].trim() : '', ogretmenRozeti,
    gunler: satirlar.map((s) => s.ad), sutunlar, hucreler,
    dersX: new Map(dersSutun.map((d) => [d.no, d.cx])),
  };
}

/** Aynı satırdaki öğeleri birleştirip yukarıdan aşağı satır metinleri döndürür. */
function satirMetinleri(ogeler) {
  const sirali = [...ogeler].sort((a, b) => a.y - b.y || a.x - b.x);
  const satirlar = [];
  for (const it of sirali) {
    const son = satirlar.at(-1);
    if (son && yakin(son.y, it.y, 1.5)) son.metin += ' ' + it.str.trim();
    else satirlar.push({ y: it.y, metin: it.str.trim() });
  }
  return satirlar.map((s) => s.metin.replace(/\s+/g, ' ').trim());
}

// ---------------------------------------------------------------- Program oluşturma

function profilAnahtari(sutunlar) {
  return JSON.stringify(sutunlar.map((s) => (s.tur === 'ders' ? [s.no, s.bas, s.bit] : [trUpper(s.ad), s.bas, s.bit])));
}

function profilKisa(siniflar) {
  const ana = siniflar.every((s) => /^Anas[ıi]n[ıi]f[ıi]/i.test(s));
  const ilk = siniflar.every((s) => /^(Anas[ıi]n[ıi]f[ıi]|[1-4]\s*-)/i.test(s));
  const ort = siniflar.every((s) => /^[5-8]\s*-/.test(s));
  if (ana) return ['A', 'Anasınıfı'];
  if (ilk) return ['İ', 'İlkokul'];
  if (ort) return ['O', 'Ortaokul'];
  return ['', ''];
}

/** Bir hücrenin saat aralığını, verilen profillerden biriyle ders numaralarına çevirir. */
function saatleriCoz(hucre, dersX, profiller, oncelikli) {
  const adaylar = [];
  for (const p of profiller) {
    const dersler = p.satirlar.filter((r) => r.tur === 'ders');
    const a = dersler.find((r) => r.bas === hucre.bas);
    const b = dersler.find((r) => r.bit === hucre.bit);
    if (!a || !b || b.no < a.no) continue;
    const xa = dersX.get(a.no), xb = dersX.get(b.no);
    const sapma = xa != null && xb != null ? Math.abs((xa + xb) / 2 - hucre.cx) : 0;
    adaylar.push({ p, bas: a.no, sure: b.no - a.no + 1, sapma: sapma - (p === oncelikli ? 0.5 : 0) });
  }
  adaylar.sort((x, y) => x.sapma - y.sapma);
  if (adaylar.length && adaylar[0].sapma < 25) return adaylar[0];
  // Saatler eşleşmedi: konuma göre en yakın ders sütunu, 1 saat
  let en = null;
  for (const [no, x] of dersX) if (!en || Math.abs(x - hucre.cx) < Math.abs(en.x - hucre.cx)) en = { no, x };
  return en ? { p: oncelikli, bas: en.no, sure: 1, tahmin: true } : null;
}

const adlariAyir = (s) => s.split(',').map((x) => x.trim().replace(/\s+/g, ' ')).filter(Boolean);

/**
 * Öğretmen sayfası hücresindeki sınıfları ayıklar. Uzun sınıf adları satıra bölünüp
 * bir kısmı ders adı satırına taşmış olabilir ("ANASINIFI 4 YAŞ" + "ŞUBESİ OYUN ...").
 * @returns {{ siniflar: string[], ders: string } | null}  sınıf bulunamazsa null
 */
function sinifAyikla(birincil, ikincil, sinifAdlari) {
  const parcalar = adlariAyir(birincil);
  if (!parcalar.length) return null;
  const bulunan = [];
  let ders = ikincil;
  for (let i = 0; i < parcalar.length; i++) {
    const tam = sinifAdlari.find((c) => esitle(c) === esitle(parcalar[i]));
    if (tam) { bulunan.push(tam); continue; }
    if (i !== parcalar.length - 1) return null;
    // Son parça + ders satırının başı bir sınıf adı mı?
    const kelimeler = ikincil.split(/\s+/).filter(Boolean);
    let eslesti = null;
    for (let k = 1; k <= Math.min(3, kelimeler.length); k++) {
      const aday = `${parcalar[i]} ${kelimeler.slice(0, k).join(' ')}`;
      const c = sinifAdlari.find((x) => esitle(x) === esitle(aday));
      if (c) { eslesti = c; ders = kelimeler.slice(k).join(' '); break; }
    }
    if (!eslesti) return null;
    bulunan.push(eslesti);
  }
  return { siniflar: bulunan, ders };
}

/**
 * @param sinifSayfalari, ogretmenSayfalari  sayfaCoz'a verilecek ham sayfalar
 * @param dosyaAdi  ör. "_manisa_ders_programi_siniflar_versiyon_8.pdf"
 * @returns {{ program, versiyon, uyarilar: string[] }}
 */
export function eskiPdfdenProgram(sinifSayfalari, ogretmenSayfalari, dosyaAdi = '') {
  const uyarilar = [];
  const sinifS = sinifSayfalari.map(sayfaCoz).filter(Boolean);
  const ogrS = ogretmenSayfalari.map(sayfaCoz).filter(Boolean);
  if (!sinifS.length) throw new Error('Sınıf programı sayfaları okunamadı.');

  // --- Saat profilleri (her sınıf sayfasının başlığından) ---
  const profilHaritasi = new Map(); // anahtar → profil
  const sinifProfili = new Map();
  for (const s of sinifS) {
    // Eski PDF'lerdeki uydurma "ETÜT" sütunu alınmaz (gerekirse Ayarlar'dan sabit bölüm eklenir)
    const sutunlar = s.sutunlar.filter((c) => !(c.tur === 'sabit' && /^ET[ÜU]T$/.test(trUpper(c.ad))));
    const k = profilAnahtari(sutunlar);
    if (!profilHaritasi.has(k)) {
      profilHaritasi.set(k, {
        id: `p${profilHaritasi.size + 1}`, ad: '', kisa: '', siniflar: [],
        satirlar: sutunlar.map((c) => (c.tur === 'ders'
          ? { tur: 'ders', no: c.no, bas: c.bas, bit: c.bit }
          : { tur: 'sabit', ad: c.ad || 'ARA', bas: c.bas, bit: c.bit })),
      });
    }
    const p = profilHaritasi.get(k);
    p.siniflar.push(s.ad);
    sinifProfili.set(s.ad, p);
  }
  const profiller = [...profilHaritasi.values()];
  const kullanilan = new Set();
  profiller.forEach((p, i) => {
    let [kisa, ad] = profilKisa(p.siniflar);
    if (!kisa || kullanilan.has(kisa)) { kisa = String(i + 1); ad = `Saat düzeni ${i + 1}`; }
    kullanilan.add(kisa);
    Object.assign(p, { kisa: profiller.length > 1 ? kisa : '', ad });
  });

  const dersSayisi = Math.max(...profiller.flatMap((p) => p.satirlar.filter((r) => r.tur === 'ders').map((r) => r.no)));
  const gunler = sinifS[0].gunler;
  const siniflar = sinifS.map((s) => s.ad);
  const sinifU = new Map(siniflar.map((s) => [trUpper(s), s]));

  // --- Öğretmenler (öğretmen sayfası başlıkları asıl yazımdır) ---
  const ogretmenler = [];
  const ogrU = new Map();
  const ogretmenEkle = (ad) => {
    const u = trUpper(ad);
    if (!ogrU.has(u)) { ogrU.set(u, ad); ogretmenler.push(ad); }
    return ogrU.get(u);
  };
  for (const s of ogrS) ogretmenEkle(s.ad);

  // --- Sınıf sayfalarından dersler ---
  const dersler = [];
  const dersAnahtar = new Map();
  let tahmin = 0;
  for (const s of sinifS) {
    const p = sinifProfili.get(s.ad);
    for (const h of s.hucreler) {
      const z = saatleriCoz(h, s.dersX, [p, ...profiller.filter((x) => x !== p)], p);
      if (!z) continue;
      if (z.tahmin) { tahmin++; continue; } // ders saatine denk gelmeyen hücre (ör. eski "ETÜT" sütunu)
      const ogr = adlariAyir(h.ikincil).map(ogretmenEkle);
      const k = [h.gun, z.bas, z.sure, trUpper(h.birincil), ogr.map(trUpper).sort().join('|')].join('#');
      const var_ = dersAnahtar.get(k);
      if (var_) { if (!var_.siniflar.includes(s.ad)) var_.siniflar.push(s.ad); continue; }
      const d = { id: dersler.length + 1, ad: h.birincil, siniflar: [s.ad], ogretmenler: ogr, gun: h.gun, bas: z.bas, sure: z.sure };
      dersler.push(d);
      dersAnahtar.set(k, d);
    }
  }

  // --- Öğretmen sayfalarından: toplantılar ve eksik öğretmenler ---
  const toplanti = new Map();
  for (const s of ogrS) {
    const ogrAd = ogretmenEkle(s.ad);
    for (const h of s.hucreler) {
      const ayik = sinifAyikla(h.birincil, h.ikincil, siniflar);
      if (ayik) {
        // Sınıflı ders: sınıf sayfasında karşılığı olmalı (sınıf PDF'i esastır; burada yalnızca öğretmen tamamlanır)
        const adaylarP = ayik.siniflar.map((x) => sinifProfili.get(x));
        const z = saatleriCoz(h, s.dersX, [...new Set([...adaylarP, ...profiller])], adaylarP[0]);
        if (!z || z.tahmin) continue;
        const d = dersler.find((x) => x.gun === h.gun && x.bas <= z.bas + z.sure - 1 && z.bas <= x.bas + x.sure - 1
          && ayik.siniflar.some((c) => x.siniflar.includes(c))
          && (!ayik.ders || esitle(x.ad) === esitle(ayik.ders)));
        if (d && !d.ogretmenler.includes(ogrAd)) d.ogretmenler.push(ogrAd);
        continue;
      }
      // Sınıfsız ders (toplantı vb.)
      const z = saatleriCoz(h, s.dersX, profiller, profiller[0]);
      if (!z || z.tahmin) continue;
      const ad = [h.birincil, h.ikincil].filter(Boolean).join(' ');
      const k = [h.gun, z.bas, z.sure, trUpper(ad)].join('#');
      const var_ = toplanti.get(k);
      if (var_) { if (!var_.ogretmenler.includes(ogrAd)) var_.ogretmenler.push(ogrAd); continue; }
      const d = { id: dersler.length + 1, ad, siniflar: [], ogretmenler: [ogrAd], gun: h.gun, bas: z.bas, sure: z.sure };
      dersler.push(d);
      toplanti.set(k, d);
    }
  }
  if (tahmin) uyarilar.push(`${tahmin} hücre ders saatlerine denk gelmediği için alınmadı.`);

  // --- Okul bilgileri ---
  const baslik = sinifS[0].okulBasligi || '';
  const dosyaKok = dosyaAdi.replace(/\.pdf$/i, '').replace(/^_+/, '');
  const dosyaKisa = (dosyaKok.split(/_ders_programi|_siniflar|_ogretmenler/i)[0] || 'okul').toLowerCase();
  const versiyon = Number((/versiyon[_-]?(\d+)/i.exec(dosyaAdi) ?? /_v(\d+)/i.exec(dosyaAdi) ?? [])[1] || 0);

  const enCok = [...profiller].sort((a, b) => b.siniflar.length - a.siniflar.length)[0];
  const program = {
    format: 'ders-programi',
    surum: 1,
    meta: { versiyon, tarih: '', kaynak: 'eski-pdf' },
    okul: { ad: basHarfBuyuk(baslik), baslik, dosyaAdi: dosyaKisa, logo: null },
    gunler,
    dersSayisi,
    varsayilanProfil: enCok.id,
    profiller: profiller.map(({ siniflar: _s, ...p }) => p),
    siniflar: sinifS.map((s) => ({ ad: s.ad, profil: sinifProfili.get(s.ad).id, rehber: s.rehber })),
    ogretmenler: ogretmenler.map((ad) => ({ ad })),
    dersler,
    ayarlar: { haftalikSaatHaric: VARSAYILAN_HARIC },
  };
  return { program: programiHazirla(program), versiyon, uyarilar };
}

function basHarfBuyuk(s) {
  return String(s).toLocaleLowerCase('tr-TR').replace(/(^|\s)(\S)/g, (m, b, h) => b + h.toLocaleUpperCase('tr-TR'));
}

/** Bir PDF sınıf mı öğretmen mi? (rozet ve dosya adına bakarak) */
export function pdfTuruTahmin(sayfalar, dosyaAdi = '') {
  if (/ogretmen|öğretmen/i.test(dosyaAdi)) return 'ogretmen';
  if (/sinif|sınıf/i.test(dosyaAdi)) return 'sinif';
  const cozulen = sayfalar.slice(0, 3).map(sayfaCoz).filter(Boolean);
  const ogr = cozulen.filter((s) => s.ogretmenRozeti).length;
  return ogr > cozulen.length / 2 ? 'ogretmen' : 'sinif';
}

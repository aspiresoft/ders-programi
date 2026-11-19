// Sayfa düzenlerini A4 yatay PDF'e çizer ve program verisini PDF'e gömer.
// pdf-lib ve fontkit dışarıdan verilir (tarayıcı ve Node aynı kodu kullanır).

import { tumSinifSayfalari, tumOgretmenSayfalari } from './layout.js';
import { programiHazirla } from './model.js';
import { VERI_DOSYA_ADI } from './pdf-data.js';

const MM = 72 / 25.4;
const PX = 0.75; // tasarım ölçüleri CSS piksel cinsinden düşünüldü (297mm genişlikte 1px = 0.75pt)
const W = 297 * MM;
const H = 210 * MM;

function hex(lib, h) {
  const n = parseInt(h.slice(1), 16);
  return lib.rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

/** Metni verilen genişliğe sığacak satırlara böler. */
function sar(font, metin, boyut, genislik, kirmaIzni = true) {
  const satirlar = [];
  satirlar.kirildi = false;
  for (const parca of String(metin).split('\n')) {
    const kelimeler = parca.split(/\s+/).filter(Boolean);
    let satir = '';
    for (const k of kelimeler) {
      const deneme = satir ? `${satir} ${k}` : k;
      if (font.widthOfTextAtSize(deneme, boyut) <= genislik) { satir = deneme; continue; }
      if (satir) satirlar.push(satir);
      // tek kelime bile sığmıyorsa harf harf böl
      let w = k;
      if (font.widthOfTextAtSize(w, boyut) > genislik) satirlar.kirildi = true;
      while (kirmaIzni && font.widthOfTextAtSize(w, boyut) > genislik && w.length > 1) {
        let j = w.length - 1;
        while (j > 1 && font.widthOfTextAtSize(w.slice(0, j), boyut) > genislik) j--;
        satirlar.push(w.slice(0, j));
        w = w.slice(j);
      }
      satir = w;
    }
    if (satir) satirlar.push(satir);
  }
  return satirlar;
}

function yuvarlakDikdortgen(x, y, w, h, r) {
  // drawSvgPath için: (0,0) sol üst, y aşağı doğru
  return `M ${x + r} ${y} H ${x + w - r} Q ${x + w} ${y} ${x + w} ${y + r} V ${y + h - r} Q ${x + w} ${y + h} ${x + w - r} ${y + h} H ${x + r} Q ${x} ${y + h} ${x} ${y + h - r} V ${y + r} Q ${x} ${y} ${x + r} ${y} Z`;
}

class Cizici {
  constructor(lib, page, fontlar) {
    this.lib = lib; this.page = page; this.f = fontlar;
  }
  // Tüm koordinatlar sol üst köşeye göre (pt)
  kutu(x, y, w, h, { zemin, kenar, kalinlik = 0.75 } = {}) {
    this.page.drawRectangle({
      x, y: H - y - h, width: w, height: h,
      color: zemin ? hex(this.lib, zemin) : undefined,
      borderColor: kenar ? hex(this.lib, kenar) : undefined,
      borderWidth: kenar ? kalinlik : 0,
    });
  }
  cizgi(x1, y1, x2, y2, renk, kalinlik) {
    this.page.drawLine({ start: { x: x1, y: H - y1 }, end: { x: x2, y: H - y2 }, color: hex(this.lib, renk), thickness: kalinlik });
  }
  yuvarlak(x, y, w, h, r, { zemin, kenar, kalinlik = 0.6, opaklik = 1 }) {
    this.page.drawSvgPath(yuvarlakDikdortgen(0, 0, w, h, r), {
      x, y: H - y,
      color: zemin ? hex(this.lib, zemin) : undefined,
      opacity: opaklik,
      borderColor: kenar ? hex(this.lib, kenar) : undefined,
      borderWidth: kenar ? kalinlik : 0,
    });
  }
  genislik(metin, font, boyut, aralik = 0) {
    return font.widthOfTextAtSize(metin, boyut) + aralik * Math.max(0, metin.length - 1);
  }
  /** Ortalanmış metin; y = satırın üstü */
  yaz(metin, cx, y, font, boyut, renk, { aralik = 0, hiza = 'orta' } = {}) {
    const w = this.genislik(metin, font, boyut, aralik);
    const x = hiza === 'orta' ? cx - w / 2 : hiza === 'sag' ? cx - w : cx;
    const taban = H - y - boyut * 0.8;
    if (aralik) this.page.pushOperators(this.lib.setCharacterSpacing(aralik));
    this.page.drawText(metin, { x, y: taban, size: boyut, font, color: hex(this.lib, renk) });
    if (aralik) this.page.pushOperators(this.lib.setCharacterSpacing(0));
    return w;
  }
  /** Aşağıdan yukarı okunan dikey metin, (cx, cy) merkezli */
  dikeyYaz(metin, cx, cy, font, boyut, renk, aralik = 0) {
    const w = this.genislik(metin, font, boyut, aralik);
    if (aralik) this.page.pushOperators(this.lib.setCharacterSpacing(aralik));
    this.page.drawText(metin, {
      x: cx + boyut * 0.36, y: H - cy - w / 2, size: boyut, font,
      color: hex(this.lib, renk), rotate: this.lib.degrees(90),
    });
    if (aralik) this.page.pushOperators(this.lib.setCharacterSpacing(0));
  }
}

/** Metin bloklarını kutuya sığacak şekilde küçülterek yerleştirir. */
function sigdir(f, bloklar, genislik, yukseklik) {
  // Önce kelimeleri bölmeden küçültmeyi dene; olmazsa en küçük boyutta bölmeye izin ver.
  for (let olcek = 1; olcek >= 0.5; olcek -= 0.05) {
    const son = olcek < 0.52;
    let toplam = 0;
    let kirildi = false;
    const sonuc = bloklar.map((b) => {
      const boyut = b.boyut * olcek;
      const satirlar = b.metin ? sar(b.font, b.metin, boyut, genislik, son) : [];
      kirildi ||= satirlar.kirildi;
      const yuk = satirlar.length * boyut * 1.15;
      toplam += yuk + (satirlar.length ? (b.bosluk ?? 0) * olcek : 0);
      return { ...b, boyut, satirlar, yuk };
    });
    if ((toplam <= yukseklik && !kirildi) || son) return { sonuc, toplam };
  }
  return { sonuc: [], toplam: 0 };
}

function sayfaCiz(lib, pdf, fontlar, logo, program, sayfa, altBilgi) {
  const page = pdf.addPage([W, H]);
  const c = new Cizici(lib, page, fontlar);
  const { yari, kalin, siyah } = fontlar;
  const normal = yari;

  const solX = 7 * MM;
  const sagX = W - 7 * MM;
  const genislik = sagX - solX;

  // ---- Üst bilgi ----
  const ustY = 5 * MM;
  const ustH = 15 * MM;
  if (logo) {
    const maxW = 55 * MM, maxH = 14 * MM;
    const o = Math.min(maxW / logo.width, maxH / logo.height);
    const lw = logo.width * o, lh = logo.height * o;
    page.drawImage(logo, { x: solX, y: H - ustY - (ustH + lh) / 2, width: lw, height: lh });
  }
  const ortaX = W / 2;
  c.yaz(program.okul.baslik || '', ortaX, ustY + 1.5 * MM, kalin, 12 * PX, '#4a5568', { aralik: 2 * PX });
  // ad uzunsa küçült
  let adBoyut = 24 * PX;
  while (adBoyut > 12 && siyah.widthOfTextAtSize(sayfa.ad, adBoyut) > genislik * 0.48) adBoyut -= 0.5;
  c.yaz(sayfa.ad, ortaX, ustY + 6 * MM, siyah, adBoyut, '#1a365d');

  // Rozetler (sağ üst)
  let rozetY = ustY + (sayfa.rozetler.length > 1 ? 1 : 3.5) * MM;
  for (const r of sayfa.rozetler) {
    const b = 10.5 * PX;
    const e = `${r.etiket}: `;
    const w1 = yari.widthOfTextAtSize(e, b);
    const w2 = siyah.widthOfTextAtSize(r.deger, b);
    const pw = w1 + w2 + 16 * PX;
    const ph = b + 8 * PX;
    c.yuvarlak(sagX - pw, rozetY, pw, ph, 5 * PX, { zemin: '#ebf8ff', kenar: '#bee3f8' });
    c.yaz(e, sagX - pw + 8 * PX, rozetY + 4 * PX, yari, b, '#2b6cb0', { hiza: 'sol' });
    c.yaz(r.deger, sagX - pw + 8 * PX + w1, rozetY + 4 * PX, siyah, b, '#2b6cb0', { hiza: 'sol' });
    rozetY += ph + 2 * PX;
  }

  // ---- Tablo ----
  const tabloY = ustY + ustH + 2.5 * MM;
  const tabloH = H - tabloY - 7 * MM;
  const baslikH = 13 * MM;
  const satirH = (tabloH - baslikH) / program.gunler.length;
  const gunW = 16 * MM;
  const sabitSayisi = sayfa.sutunlar.filter((s) => s.tur === 'sabit').length;
  const sabitW = (sabitSayisi > 4 ? 9 : 9.5) * MM;
  const dersSayisi = sayfa.sutunlar.length - sabitSayisi;
  const dersW = (genislik - gunW - sabitW * sabitSayisi) / dersSayisi;

  const xler = [];
  let x = solX + gunW;
  for (const s of sayfa.sutunlar) {
    const w = s.tur === 'sabit' ? sabitW : dersW;
    xler.push({ x, w });
    x += w;
  }
  const govdeY = tabloY + baslikH;
  const IZGARA = '#cbd5e0';

  // Başlık satırı
  c.kutu(solX, tabloY, gunW, baslikH, { zemin: '#edf2f7', kenar: IZGARA });
  c.yaz('GÜN', solX + gunW / 2, tabloY + baslikH / 2 - 5, siyah, 10.5 * PX, '#2d3748');
  sayfa.sutunlar.forEach((s, i) => {
    const { x: sx, w } = xler[i];
    if (s.tur === 'sabit') {
      // Dar sütun: başlıkta yalnızca saatler (adı sütunun içinde dikey yazar)
      c.kutu(sx, tabloY, w, baslikH, { zemin: s.renk.zemin, kenar: IZGARA });
      const { sonuc, toplam } = sigdir(c.f, [
        { metin: s.bas || '', font: siyah, boyut: 9 * PX, renk: '#2d3748', bosluk: 0 },
        { metin: s.bit || '', font: siyah, boyut: 9 * PX, renk: '#2d3748', bosluk: 1 },
        { metin: s.sure ? `(${s.sure})` : '', font: kalin, boyut: 7.5 * PX, renk: '#4a5568' },
      ], w - 2, baslikH - 3);
      blokCiz(c, sonuc, sx + w / 2, tabloY + (baslikH - toplam) / 2);
    } else {
      c.kutu(sx, tabloY, w, baslikH, { zemin: '#edf2f7', kenar: IZGARA });
      const { sonuc, toplam } = sigdir(c.f, [
        { metin: s.baslik, font: siyah, boyut: 10.5 * PX, renk: '#2d3748', bosluk: 1.5 },
        { metin: s.saat, font: yari, boyut: 8.5 * PX, renk: '#4a5568', bosluk: 0.5 },
        { metin: s.sure ? `(${s.sure})` : '', font: yari, boyut: 7.5 * PX, renk: '#718096' },
      ], w - 4, baslikH - 4);
      blokCiz(c, sonuc, sx + w / 2, tabloY + (baslikH - toplam) / 2);
    }
  });

  // Gün satırları
  sayfa.satirlar.forEach((satir, r) => {
    const y = govdeY + r * satirH;
    c.kutu(solX, y, gunW, satirH, { zemin: '#f7fafc', kenar: IZGARA });
    c.yaz(satir.kisa, solX + gunW / 2, y + satirH / 2 - 9, siyah, 14 * PX, '#1a365d');
    c.yaz(satir.gun, solX + gunW / 2, y + satirH / 2 + 3.5, yari, 9 * PX, '#718096');

    for (const h of satir.hucreler) {
      const sx = xler[h.sutun].x;
      const son = xler[h.sutun + h.genislik - 1];
      const w = son.x + son.w - sx;
      if (!h.dersler.length) {
        c.kutu(sx, y, w, satirH, { zemin: '#fafafa', kenar: IZGARA });
        c.yaz('---', sx + w / 2, y + satirH / 2 - 4, normal, 12 * PX, '#cbd5e0');
        continue;
      }
      const renk = h.renk;
      c.kutu(sx, y, w, satirH, { zemin: renk.zemin, kenar: IZGARA });
      c.kutu(sx, y, w, 2.5 * PX, { zemin: renk.kenar });
      const bloklar = [
        { metin: h.ust, font: siyah, boyut: 10.5 * PX, renk: '#1a202c', bosluk: 1 },
        { metin: h.alt, font: yari, boyut: 9 * PX, renk: '#4a5568', bosluk: 2.5 },
      ];
      const saatB = 8 * PX;
      const saatH = h.saat ? saatB + 3 * PX : 0;
      const { sonuc, toplam } = sigdir(c.f, bloklar, w - 6, satirH - saatH - 8);
      const tumH = toplam + saatH;
      let yy = y + (satirH - tumH) / 2;
      yy = blokCiz(c, sonuc, sx + w / 2, yy);
      if (h.saat) {
        const sw = kalin.widthOfTextAtSize(h.saat, saatB) + 6 * PX;
        c.yuvarlak(sx + (w - sw) / 2, yy, sw, saatH, 3 * PX, { zemin: '#ffffff', opaklik: 0.75, kenar: '#e2e8f0', kalinlik: 0.5 });
        c.yaz(h.saat, sx + w / 2, yy + 1.5 * PX, kalin, saatB, '#4a5568');
      }
    }
  });

  // Sabit bölüm sütunları (tüm günler boyunca tek parça)
  sayfa.sutunlar.forEach((s, i) => {
    if (s.tur !== 'sabit') return;
    const { x: sx, w } = xler[i];
    const renk = s.renk;
    const h = satirH * program.gunler.length;
    c.kutu(sx, govdeY, w, h, { zemin: renk.zemin, kenar: IZGARA });
    c.cizgi(sx, govdeY, sx, govdeY + h, renk.kenar, 1.1);
    c.cizgi(sx + w, govdeY, sx + w, govdeY + h, renk.kenar, 1.1);
    // Dikey: ad ve saat (aşağıdan yukarı okunur)
    let b = 10.5 * PX;
    const aralik = 3 * PX;
    const saat = s.saat ? `${s.saat}${s.sure ? ` (${s.sure})` : ''}` : '';
    const olc = () => {
      const w1 = c.genislik(s.ad, siyah, b, aralik);
      const w2 = saat ? c.genislik(saat, kalin, b * 0.85, 0.5) : 0;
      return { w1, w2, bosluk: saat ? b * 1.6 : 0 };
    };
    let m = olc();
    while (b > 5 && m.w1 + m.bosluk + m.w2 > h - 12) { b -= 0.25; m = olc(); }
    const alt = govdeY + h / 2 + (m.w1 + m.bosluk + m.w2) / 2;
    c.dikeyYaz(s.ad, sx + w / 2, alt - m.w1 / 2, siyah, b, renk.yazi, aralik);
    if (saat) c.dikeyYaz(saat, sx + w / 2, alt - m.w1 - m.bosluk - m.w2 / 2, kalin, b * 0.85, renk.yazi, 0.5);
  });

  // Kalın çizgiler: dış çerçeve, başlık altı, gün sütunu sağı
  c.cizgi(solX, govdeY, sagX, govdeY, '#4a5568', 1.5);
  c.cizgi(solX + gunW, tabloY, solX + gunW, tabloY + tabloH, '#4a5568', 1.5);
  c.kutu(solX, tabloY, genislik, tabloH, { kenar: '#2d3748', kalinlik: 1.1 });

  // Alt bilgi
  c.yaz(altBilgi, sagX, H - 5.5 * MM, normal, 7 * PX, '#a0aec0', { hiza: 'sag' });
}

function blokCiz(c, sonuc, cx, y) {
  for (const b of sonuc) {
    for (const s of b.satirlar) {
      c.yaz(s, cx, y, b.font, b.boyut, b.renk);
      y += b.boyut * 1.15;
    }
    if (b.satirlar.length) y += b.bosluk ?? 0;
  }
  return y;
}

/**
 * Program için iki PDF üretir.
 * @param lib   pdf-lib modülü
 * @param fontkit  @pdf-lib/fontkit
 * @param fontBaytlari { normal, yari, kalin, siyah } → Uint8Array (TTF)
 * @returns {Promise<{ siniflar: Uint8Array, ogretmenler: Uint8Array }>}
 */
export async function pdfleriUret(lib, fontkit, fontBaytlari, program) {
  programiHazirla(program);
  const json = new TextEncoder().encode(JSON.stringify(program));
  const altBilgi = `Versiyon ${program.meta.versiyon} – ${program.meta.tarih}`;

  async function tek(baslik, sayfalar) {
    const pdf = await lib.PDFDocument.create();
    pdf.registerFontkit(fontkit);
    const fontlar = {};
    const gomulu = new Map(); // aynı dosya iki kez gömülmesin (ör. Google Sans'ta kalın = en kalın)
    for (const [k, b] of Object.entries(fontBaytlari)) {
      if (!gomulu.has(b)) gomulu.set(b, await pdf.embedFont(b, { subset: false })); // fontkit alt kümelemesi bazı harfleri bozuyor
      fontlar[k] = gomulu.get(b);
    }
    let logo = null;
    if (program.okul.logo?.veri) {
      const bayt = base64Coz(program.okul.logo.veri);
      logo = program.okul.logo.tip === 'jpg' ? await pdf.embedJpg(bayt) : await pdf.embedPng(bayt);
    }
    for (const s of sayfalar) sayfaCiz(lib, pdf, fontlar, logo, program, s, altBilgi);
    pdf.setTitle(`${program.okul.ad} – ${baslik} (Versiyon ${program.meta.versiyon})`);
    pdf.setSubject('ders-programi');
    pdf.setCreator('Ders Programı Editörü');
    pdf.setProducer('Ders Programı Editörü');
    await pdf.attach(json, VERI_DOSYA_ADI, {
      mimeType: 'application/json',
      description: 'Ders programı verisi (düzenleyici için)',
    });
    return pdf.save();
  }

  return {
    siniflar: await tek('Sınıflar Ders Programı', tumSinifSayfalari(program)),
    ogretmenler: await tek('Öğretmenler Ders Programı', tumOgretmenSayfalari(program)),
  };
}

export function base64Coz(s) {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function base64Kodla(bayt) {
  let s = '';
  for (let i = 0; i < bayt.length; i += 0x8000) s += String.fromCharCode(...bayt.subarray(i, i + 0x8000));
  return btoa(s);
}

export function dosyaAdlari(program) {
  const a = program.okul.dosyaAdi || 'okul';
  const v = program.meta.versiyon;
  return { siniflar: `${a}_siniflar_v${v}.pdf`, ogretmenler: `${a}_ogretmenler_v${v}.pdf` };
}

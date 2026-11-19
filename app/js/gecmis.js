// Geri al / yinele geçmişi ve tarayıcıda otomatik taslak.

export class Gecmis {
  constructor(sinir = 200) {
    this.sinir = sinir;
    this.geri = [];
    this.ileri = [];
  }
  temizle() { this.geri = []; this.ileri = []; }
  /** Değişiklikten ÖNCEKİ durumu kaydeder. */
  kaydet(durum) {
    this.geri.push(structuredClone(durum));
    if (this.geri.length > this.sinir) this.geri.shift();
    this.ileri = [];
  }
  geriAl(simdiki) {
    if (!this.geri.length) return null;
    this.ileri.push(structuredClone(simdiki));
    return this.geri.pop();
  }
  yinele(simdiki) {
    if (!this.ileri.length) return null;
    this.geri.push(structuredClone(simdiki));
    return this.ileri.pop();
  }
  get geriVar() { return this.geri.length > 0; }
  get ileriVar() { return this.ileri.length > 0; }
}

const TASLAK_ANAHTARI = 'ders-programi-taslak';

export function taslakKaydet(veri) {
  try {
    localStorage.setItem(TASLAK_ANAHTARI, JSON.stringify({ ...veri, zaman: Date.now() }));
    return true;
  } catch {
    return false; // depolama kapalı veya dolu: sessizce geç
  }
}

export function taslakOku() {
  try {
    const t = JSON.parse(localStorage.getItem(TASLAK_ANAHTARI) ?? 'null');
    return t?.program?.format === 'ders-programi' ? t : null;
  } catch {
    return null;
  }
}

export function taslakSil() {
  try { localStorage.removeItem(TASLAK_ANAHTARI); } catch { /* yok say */ }
}

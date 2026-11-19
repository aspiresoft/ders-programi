// Renkler: tek ortak palet. Dersler ve sabit bölümler bu paletten renk alır.
// Kullanıcı Ayarlar'dan bir renk seçmemişse ders adındaki anahtar kelimeye göre otomatik atanır.

import { trUpper } from './model.js';

export const PALET = {
  mor:       { ad: 'Mor',          kenar: '#805ad5', zemin: '#faf5ff', yazi: '#553c9a' },
  turuncu:   { ad: 'Turuncu',      kenar: '#dd6b20', zemin: '#fffaf0', yazi: '#9c4221' },
  camgobegi: { ad: 'Deniz yeşili', kenar: '#319795', zemin: '#e6fffa', yazi: '#234e52' },
  mavi:      { ad: 'Mavi',         kenar: '#3182ce', zemin: '#ebf8ff', yazi: '#2a4365' },
  sari:      { ad: 'Sarı',         kenar: '#d69e2e', zemin: '#fefcbf', yazi: '#975a16' },
  yesil:     { ad: 'Yeşil',        kenar: '#38a169', zemin: '#f0fff4', yazi: '#22543d' },
  kirmizi:   { ad: 'Kırmızı',      kenar: '#e53e3e', zemin: '#fff5f5', yazi: '#9b2c2c' },
  turkuaz:   { ad: 'Turkuaz',      kenar: '#00b5d8', zemin: '#e6fbff', yazi: '#086f83' },
  kursun:    { ad: 'Kurşuni',      kenar: '#4a5568', zemin: '#f7fafc', yazi: '#2d3748' },
  pembe:     { ad: 'Pembe',        kenar: '#d53f8c', zemin: '#fff5f7', yazi: '#97266d' },
  gri:       { ad: 'Gri',          kenar: '#718096', zemin: '#edf2f7', yazi: '#4a5568' },
  acikgri:   { ad: 'Açık gri',     kenar: '#a0aec0', zemin: '#f7fafc', yazi: '#4a5568' },
};

// Sıra önemlidir; ilk eşleşen kullanılır.
export const RENK_TABLOSU = [
  { kelimeler: ['ZÜMRE', 'TOPLANTI', 'ŞÖK', 'LGS', 'DENEME', 'KAZANIM', 'CUMA', 'KULÜP', 'ETÜT', 'NÖBET'], renk: 'gri' },
  { kelimeler: ['REHBERLİK'], renk: 'pembe' },
  { kelimeler: ['TÜRKÇE', 'ERKEN OKUR', 'OKUMA', 'DİL,', 'DİL ', 'HİKAYE', 'EDEBİYAT'], renk: 'mor' },
  { kelimeler: ['MATEMATİK'], renk: 'turuncu' },
  { kelimeler: ['FEN', 'DOĞA', 'BİLİM'], renk: 'camgobegi' },
  { kelimeler: ['SOSYAL', 'HAYAT', 'İNKILAP', 'İNKILÂP', 'T.C', 'TRAFİK', 'İNSAN HAKLARI', 'TARİH', 'COĞRAFYA'], renk: 'mavi' },
  { kelimeler: ['İNGİLİZCE', 'SPEAKİNG', 'SPEAKING', 'MAİN COURSE', 'MAIN COURSE', 'NATİVE', 'NATIVE', 'ALMANCA', 'ENGLİSH'], renk: 'sari' },
  { kelimeler: ['BEDEN', 'OYUN', 'HAREKET', 'SPOR'], renk: 'yesil' },
  { kelimeler: ['BİLİŞİM', 'ROBOTİK', 'KODLAMA', 'ZİHİN', 'ZEKA', 'TÜZDER'], renk: 'turkuaz' },
  { kelimeler: ['GÖRSEL', 'SANAT', 'TASARIM', 'MÜZİK', 'ATÖLYE', 'DRAMA', 'İFADE'], renk: 'kirmizi' },
  { kelimeler: ['DEĞERLER', 'DİN', 'AHLAK', 'SİYER', 'KURAN'], renk: 'kursun' },
];

/** Ders adına göre otomatik renk anahtarı */
export function otomatikDersRengi(ad) {
  const s = trUpper(ad) + ' ';
  for (const k of RENK_TABLOSU) if (k.kelimeler.some((w) => s.includes(w))) return k.renk;
  return 'acikgri';
}

/** Dersin rengi: Ayarlar'da seçilmişse o, yoksa otomatik */
export function dersRengi(ad, program) {
  const secim = program?.dersListesi?.find((x) => x.ad === ad)?.renk;
  return PALET[secim] ?? PALET[otomatikDersRengi(ad)];
}

const SABIT_TABLOSU = [
  { kelimeler: ['KAHVALTI'], renk: 'sari' },
  { kelimeler: ['ÖĞLE', 'YEMEK'], renk: 'camgobegi' },
  { kelimeler: ['İKİNDİ'], renk: 'turuncu' },
  { kelimeler: ['ETÜT'], renk: 'mor' },
];

export function otomatikSabitRengi(ad) {
  const s = trUpper(ad);
  for (const k of SABIT_TABLOSU) if (k.kelimeler.some((w) => s.includes(w))) return k.renk;
  return 'gri';
}

/** Sabit bölümün (mola) rengi: satırda seçilmişse o, yoksa ada göre */
export function sabitRengi(ad, secim) {
  return PALET[secim] ?? PALET[otomatikSabitRengi(ad)];
}

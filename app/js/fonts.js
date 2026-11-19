// Yazı tipleri (hepsi SIL Open Font License; app/fonts/<aile>/OFL.txt)
// Not: fontkit'in alt kümeleme (subset) özelliği bazı harfleri bozduğu için yazı tipleri PDF'e tam gömülür.
// "yari" = yarı kalın, "kalin" = kalın, "siyah" = en kalın (başlıklar ve ders adları)

export const YAZI_TIPLERI = {
  inter: { ad: 'Inter', dosyalar: { yari: 'fonts/inter/600.ttf', kalin: 'fonts/inter/700.ttf', siyah: 'fonts/inter/900.ttf' } },
  outfit: { ad: 'Outfit', dosyalar: { yari: 'fonts/outfit/600.ttf', kalin: 'fonts/outfit/700.ttf', siyah: 'fonts/outfit/900.ttf' } },
  nunito: { ad: 'Nunito', dosyalar: { yari: 'fonts/nunito/600.ttf', kalin: 'fonts/nunito/700.ttf', siyah: 'fonts/nunito/900.ttf' } },
  roboto: { ad: 'Roboto', dosyalar: { yari: 'fonts/roboto/600.ttf', kalin: 'fonts/roboto/700.ttf', siyah: 'fonts/roboto/900.ttf' } },
  'google-sans': { ad: 'Google Sans', dosyalar: { yari: 'fonts/google-sans/600.ttf', kalin: 'fonts/google-sans/700.ttf', siyah: 'fonts/google-sans/700.ttf' } },
};

export const VARSAYILAN_YAZI = 'inter';

export const yaziTipiAnahtari = (program) => (YAZI_TIPLERI[program?.gorunum?.yazi] ? program.gorunum.yazi : VARSAYILAN_YAZI);
export const yaziTipi = (program) => YAZI_TIPLERI[yaziTipiAnahtari(program)];

/**
 * Programın yazı tipinin dosyalarını okur. Aynı dosya bir kez okunur (aynı nesne döner).
 * @param oku  async (yol) => Uint8Array
 */
export async function fontBaytlari(program, oku) {
  const onbellek = new Map();
  const sonuc = {};
  for (const [k, yol] of Object.entries(yaziTipi(program).dosyalar)) {
    if (!onbellek.has(yol)) onbellek.set(yol, await oku(yol));
    sonuc[k] = onbellek.get(yol);
  }
  return sonuc;
}

/** Ekrandaki CSS'te kullanılacak aile adı */
export const cssAilesi = (anahtar) => `DP-${anahtar}`;

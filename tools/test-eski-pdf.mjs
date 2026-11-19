// Eski PDF okuma testi:
//   node tools/test-eski-pdf.mjs <pdfjs-legacy-build/pdf.mjs> <siniflar.pdf> <ogretmenler.pdf> [cikis-klasoru]
// (pdf.js'in Node sürümü test için ayrıca verilir; uygulama tarayıcıda app/vendor içindekini kullanır.)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const kok = join(dirname(fileURLToPath(import.meta.url)), '..', 'app');
const imp = (p) => import(pathToFileURL(join(kok, p)).href);
const [pdfjsYolu, sinifPdf, ogrPdf, cikis] = process.argv.slice(2);
const pdfjs = await import(pathToFileURL(pdfjsYolu).href);
const { pdfAc, sayfalariOku } = await imp('js/pdfjs-sayfalar.js');
const { eskiPdfdenProgram } = await imp('js/eski-pdf.js');
const { uyarilariBul } = await imp('js/uyarilar.js');
const { haftalikDersSaati, trUpper } = await imp('js/model.js');

const oku = async (f) => sayfalariOku(await pdfAc(pdfjs, new Uint8Array(readFileSync(f))));
const t0 = Date.now();
const { program, versiyon, uyarilar } = eskiPdfdenProgram(await oku(sinifPdf), await oku(ogrPdf), basename(sinifPdf));
console.log(`okul="${program.okul.baslik}" dosya=${program.okul.dosyaAdi} v${versiyon} gün=${program.gunler.join(',')} ders sayısı=${program.dersSayisi} (${Date.now() - t0} ms)`);
console.log(`${program.siniflar.length} sınıf, ${program.ogretmenler.length} öğretmen, ${program.dersler.length} ders, ${program.dersler.filter((d) => !d.siniflar.length).length} toplantı`);
for (const p of program.profiller) console.log(` profil ${p.id} ${p.kisa || '-'} ${p.ad}: ${p.satirlar.map((r) => (r.tur === 'ders' ? `${r.no}(${r.bas})` : `[${r.ad} ${r.bas}-${r.bit}]`)).join(' ')}`);
console.log(' sınıflar:', program.siniflar.map((s) => `${s.ad}→${s.profil}${s.rehber ? '' : '(rehber yok)'}`).join(', '));
uyarilar.forEach((u) => console.log(' UYARI:', u));
const u = uyarilariBul(program);
console.log(`çakışma uyarısı: ${u.liste.length}`);
u.liste.slice(0, 8).forEach((x) => console.log('  -', x.mesaj));
console.log('örnek haftalık saatler:', program.ogretmenler.slice(0, 6).map((o) => `${o.ad}=${haftalikDersSaati(program, o.ad)}`).join(', '));
if (cikis) {
  mkdirSync(cikis, { recursive: true });
  writeFileSync(join(cikis, `${program.okul.dosyaAdi}_eski.json`), JSON.stringify(program, null, 1));
  // PDF olarak da üret
  const req = createRequire(import.meta.url);
  const lib = req(join(kok, 'vendor/pdf-lib.min.js'));
  const fontkit = req(join(kok, 'vendor/fontkit.umd.min.js'));
  const { pdfleriUret, dosyaAdlari } = await imp('js/pdf-writer.js');
  const { fontBaytlari } = await imp('js/fonts.js');
  const f = await fontBaytlari(program, async (v) => readFileSync(join(kok, v)));
  program.meta.versiyon = versiyon + 1; program.meta.tarih = '19.11.2026';
  const r = await pdfleriUret(lib, fontkit, f, program);
  const ad = dosyaAdlari(program);
  writeFileSync(join(cikis, ad.siniflar), r.siniflar);
  writeFileSync(join(cikis, ad.ogretmenler), r.ogretmenler);
  console.log('PDF:', ad.siniflar, ad.ogretmenler);
}

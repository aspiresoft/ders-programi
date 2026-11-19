// Komut satırından FET → PDF üretimi (test ve toplu kullanım için).
// Kullanım:
//   node tools/fetten-pdf.mjs <dosya.fet> <okul-klasoru> [cikis-klasoru] [--activities <activities.xml>]
// okul-klasoru içinde okul.json ve (varsa) logo.png bulunur.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const kok = join(dirname(fileURLToPath(import.meta.url)), '..', 'app');
const imp = (p) => import(pathToFileURL(join(kok, p)).href);

const req = createRequire(import.meta.url);
const lib = req(join(kok, 'vendor/pdf-lib.min.js'));
const fontkit = req(join(kok, 'vendor/fontkit.umd.min.js'));
const { fetOku } = await imp('js/fet-import.js');
const { programOlustur, okulAyariOku } = await imp('js/okul.js');
const { pdfleriUret, base64Kodla, dosyaAdlari } = await imp('js/pdf-writer.js');
const { gomuluVeriyiOku } = await imp('js/pdf-data.js');
const { bugun } = await imp('js/model.js');
const { fontBaytlari } = await imp('js/fonts.js');

const arg = process.argv.slice(2);
const aIdx = arg.indexOf('--activities');
const activities = aIdx >= 0 ? readFileSync(arg.splice(aIdx, 2)[1], 'utf8') : undefined;
const [fetYolu, okulKlasoru, cikis = '.'] = arg;
if (!fetYolu || !okulKlasoru) {
  console.error('Kullanım: node tools/fetten-pdf.mjs <dosya.fet> <okul-klasoru> [cikis-klasoru]');
  process.exit(1);
}

const ayar = okulAyariOku(readFileSync(join(okulKlasoru, 'okul.json'), 'utf8'));
const logoYolu = join(okulKlasoru, 'logo.png');
const logo = existsSync(logoYolu) ? { tip: 'png', veri: base64Kodla(readFileSync(logoYolu)) } : null;

const { ham, uyarilar } = fetOku(readFileSync(fetYolu, 'utf8'), activities);
uyarilar.forEach((u) => console.warn('UYARI:', u));
const program = programOlustur(ayar, ham, logo, 'fet');
program.meta.tarih = bugun();

const fontlar = await fontBaytlari(program, async (f) => readFileSync(join(kok, f)));
const t0 = Date.now();
const pdfler = await pdfleriUret(lib, fontkit, fontlar, program);
const adlar = dosyaAdlari(program);
mkdirSync(cikis, { recursive: true });
writeFileSync(join(cikis, adlar.siniflar), pdfler.siniflar);
writeFileSync(join(cikis, adlar.ogretmenler), pdfler.ogretmenler);
console.log(`${program.siniflar.length} sınıf, ${program.ogretmenler.length} öğretmen, ${program.dersler.length} ders → ${cikis} (${Date.now() - t0} ms)`);

// Geri okuma kontrolü
const geri = await gomuluVeriyiOku(lib, pdfler.ogretmenler);
console.log('Gömülü veri okundu:', geri ? `${geri.dersler.length} ders` : 'YOK');

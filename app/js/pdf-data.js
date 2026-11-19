// PDF'e gömülü program verisini okur.

import { FORMAT } from './model.js';

export const VERI_DOSYA_ADI = 'ders-programi.json';

/**
 * PDF içinde gömülü ders programı verisini bulur.
 * @returns {Promise<object|null>} program veya (eski PDF ise) null
 */
export async function gomuluVeriyiOku(lib, bayt) {
  const pdf = await lib.PDFDocument.load(bayt, { updateMetadata: false, ignoreEncryption: true });
  const { PDFName, PDFDict, PDFArray } = lib;
  const names = pdf.catalog.lookupMaybe(PDFName.of('Names'), PDFDict);
  const ef = names?.lookupMaybe(PDFName.of('EmbeddedFiles'), PDFDict);
  if (!ef) return null;

  const dosyalar = [];
  const gez = (dugum) => {
    const arr = dugum.lookupMaybe(PDFName.of('Names'), PDFArray);
    if (arr) for (let i = 0; i + 1 < arr.size(); i += 2) dosyalar.push([arr.lookup(i), arr.lookup(i + 1)]);
    const kids = dugum.lookupMaybe(PDFName.of('Kids'), PDFArray);
    if (kids) for (let i = 0; i < kids.size(); i++) gez(kids.lookup(i, PDFDict));
  };
  gez(ef);

  for (const [ad, spec] of dosyalar) {
    if (ad?.decodeText?.() !== VERI_DOSYA_ADI) continue;
    const efd = spec.lookup(PDFName.of('EF'), PDFDict);
    const akis = efd.lookup(PDFName.of('F'));
    const veri = lib.decodePDFRawStream(akis).decode();
    const program = JSON.parse(new TextDecoder().decode(veri));
    if (program?.format === FORMAT) return program;
  }
  return null;
}

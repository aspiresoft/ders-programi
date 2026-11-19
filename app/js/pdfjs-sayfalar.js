// pdf.js ile PDF sayfalarındaki metin öğelerini eski-pdf.js'in beklediği biçime çevirir.

export async function pdfAc(pdfjs, bayt) {
  // pdf.js baytları işçiye aktarırken orijinali boşaltır; kopya veriyoruz
  return pdfjs.getDocument({ data: bayt.slice(), verbosity: 0, isEvalSupported: false }).promise;
}

export async function sayfalariOku(doc) {
  const sayfalar = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const vp = page.getViewport({ scale: 1 });
    const tc = await page.getTextContent();
    const items = tc.items.filter((it) => it.str?.trim()).map((it) => {
      const [a, b, , , e, f] = it.transform;
      return { str: it.str, x: e, y: vp.height - f, w: it.width, size: Math.hypot(a, b), rot: Math.abs(b) > 0.01 };
    });
    sayfalar.push({ width: vp.width, height: vp.height, items });
    page.cleanup();
  }
  return sayfalar;
}

/**
 * İlk sayfadaki logoyu PNG (base64) olarak çıkarır. Yalnızca tarayıcıda (canvas gerekir).
 * @returns {Promise<{ tip: 'png', veri: string } | null>}
 */
export async function logoCikar(pdfjs, doc) {
  try {
    const page = await doc.getPage(1);
    const ops = await page.getOperatorList();
    let enBuyuk = null;
    for (let i = 0; i < ops.fnArray.length; i++) {
      if (ops.fnArray[i] !== pdfjs.OPS.paintImageXObject) continue;
      const ad = ops.argsArray[i][0];
      const resim = await new Promise((tamam) => {
        if (page.objs.has(ad)) tamam(page.objs.get(ad));
        else page.objs.get(ad, tamam);
      });
      if (resim && (!enBuyuk || resim.width * resim.height > enBuyuk.width * enBuyuk.height)) enBuyuk = resim;
    }
    if (!enBuyuk) return null;
    const tuval = new OffscreenCanvas(enBuyuk.width, enBuyuk.height);
    const ctx = tuval.getContext('2d');
    if (enBuyuk.bitmap) ctx.drawImage(enBuyuk.bitmap, 0, 0);
    else {
      const veri = new ImageData(enBuyuk.width, enBuyuk.height);
      const kaynak = enBuyuk.data;
      const piksel = enBuyuk.width * enBuyuk.height;
      if (kaynak.length === piksel * 4) veri.data.set(kaynak);
      else if (kaynak.length === piksel * 3) {
        for (let p = 0; p < piksel; p++) {
          veri.data[p * 4] = kaynak[p * 3]; veri.data[p * 4 + 1] = kaynak[p * 3 + 1];
          veri.data[p * 4 + 2] = kaynak[p * 3 + 2]; veri.data[p * 4 + 3] = 255;
        }
      } else return null;
      ctx.putImageData(veri, 0, 0);
    }
    const blob = await tuval.convertToBlob({ type: 'image/png' });
    const bayt = new Uint8Array(await blob.arrayBuffer());
    let s = '';
    for (let i = 0; i < bayt.length; i += 0x8000) s += String.fromCharCode(...bayt.subarray(i, i + 0x8000));
    return { tip: 'png', veri: btoa(s) };
  } catch (e) {
    console.warn('Logo çıkarılamadı', e);
    return null;
  }
}

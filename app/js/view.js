// Sayfa düzenini ekranda bir tablo olarak gösterir (PDF ile aynı görünüm).
// Hücreler sürükle-bırak ve çift tıklama için data-* bilgisi taşır.

export const el = (etiket, ozellik = {}, ...cocuk) => {
  const e = document.createElement(etiket);
  for (const [k, v] of Object.entries(ozellik)) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'style') Object.assign(e.style, v);
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of cocuk.flat()) if (c != null && c !== '') e.append(c);
  return e;
};

/**
 * @param sayfa  layout.js çıktısı (editor: true ile)
 * @param secenek { kapat, sola, saga, uyariDersler: Set<number> }  sola/saga null ise düğme pasif
 */
export function programKarti(sayfa, { kapat, sola, saga, uyariDersler = new Set() } = {}) {
  const baslikId = `p-${sayfa.tur}-${encodeURIComponent(sayfa.anahtarAd)}`;
  const kart = el('article', { class: 'program', 'aria-labelledby': baslikId, 'data-tur': sayfa.tur, 'data-ad': sayfa.anahtarAd });

  kart.append(el('div', { class: 'program-ust' },
    el('div', {},
      el('span', { class: 'program-tur' }, sayfa.tur === 'sinif' ? 'Sınıf' : 'Öğretmen'),
      el('h2', { class: 'program-ad', id: baslikId }, sayfa.ad)),
    el('div', {}, ...sayfa.rozetler.map((r) => el('span', { class: 'rozet' }, `${r.etiket}: `, el('b', {}, r.deger)))),
    el('div', { class: 'kart-butonlar' },
      el('button', { type: 'button', class: 'kapat', 'aria-label': `${sayfa.ad} programını sola taşı`, title: 'Sola taşı', disabled: !sola, onclick: sola }, '◀'),
      el('button', { type: 'button', class: 'kapat', 'aria-label': `${sayfa.ad} programını sağa taşı`, title: 'Sağa taşı', disabled: !saga, onclick: saga }, '▶'),
      el('button', { type: 'button', class: 'kapat', 'aria-label': `${sayfa.ad} programını kapat`, title: 'Kapat', onclick: kapat }, '×')),
  ));

  const tablo = el('table', { class: 'cizelge' });
  const basSatir = el('tr', {}, el('th', { class: 'gun-bas', scope: 'col' }, 'GÜN'));
  for (const s of sayfa.sutunlar) {
    basSatir.append(s.tur === 'sabit'
      // Dar sütun: başlıkta yalnızca saatler; adı sütunun içinde
      ? el('th', { class: 'sabit-bas', scope: 'col', 'aria-label': `${s.ad} ${s.saat}`, style: { background: s.renk.zemin } },
        el('span', { class: 'sb-saat' }, s.bas), el('span', { class: 'sb-saat' }, s.bit), s.sure ? el('small', {}, `(${s.sure})`) : null)
      : el('th', { scope: 'col' }, s.baslik, el('small', {}, s.saat), s.sure ? el('small', { class: 'sure' }, `(${s.sure})`) : null));
  }
  tablo.append(el('thead', {}, basSatir));

  const govde = el('tbody');
  sayfa.satirlar.forEach((satir, r) => {
    const tr = el('tr', { 'data-gun': satir.gunIndex }, el('th', { scope: 'row' }, satir.kisa, el('small', {}, satir.gun)));
    const hucreSutun = new Map(satir.hucreler.map((h) => [h.sutun, h]));
    for (let i = 0; i < sayfa.sutunlar.length; i++) {
      const s = sayfa.sutunlar[i];
      if (s.tur === 'sabit') {
        if (r === 0) {
          tr.append(el('td', {
            class: 'sabit', rowspan: sayfa.satirlar.length,
            // Renkli kenarlar gölgeyle çizilir; böylece gün sütununun kenarlığıyla çakışmaz
            style: { background: s.renk.zemin, color: s.renk.yazi, boxShadow: `inset 2px 0 ${s.renk.kenar}, inset -2px 0 ${s.renk.kenar}` },
          }, el('span', {}, el('b', {}, s.ad), s.saat ? el('small', {}, `${s.saat}${s.sure ? ` (${s.sure})` : ''}`) : null)));
        }
        continue;
      }
      const h = hucreSutun.get(i);
      if (!h) continue; // birleşik hücrenin devamı
      tr.append(hucreTd(h, uyariDersler));
    }
    govde.append(tr);
  });
  tablo.append(govde);
  kart.append(tablo);
  return kart;
}

function hucreTd(h, uyariDersler) {
  const ortak = { 'data-no': h.no, 'data-genislik': h.genislik, colspan: h.genislik > 1 ? h.genislik : null };
  if (!h.dersler.length) return el('td', { ...ortak, class: 'ders bos', title: 'Ders eklemek için çift tıklayın' }, '');
  const ders = h.dersler[0];
  const cakisma = h.dersler.length > 1 || h.dersler.some((d) => uyariDersler.has(d.id));
  return el('td', {
    ...ortak,
    class: `ders dolu${cakisma ? ' cakisma' : ''}`,
    'data-ders': ders.id,
    'data-bas': ders.bas,
    style: { background: h.renk.zemin, borderTopColor: h.renk.kenar },
  },
  cakisma ? el('span', { class: 'cakisma-isareti', 'aria-label': 'Çakışma var' }, '⚠') : null,
  el('div', { class: 'd-ust' }, h.ust),
  h.alt ? el('div', { class: 'd-alt' }, h.alt) : null,
  h.saat ? el('div', { class: 'd-saat' }, h.saat) : null);
}

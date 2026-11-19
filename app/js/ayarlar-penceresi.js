// Ayarlar penceresi: Okul · Saatler · Sınıflar · Öğretmenler · Dersler
// Değişiklikler programın bir çalışma kopyasında yapılır; "Uygula" ile tek seferde (geri alınabilir) aktarılır.

import { el } from './view.js';
import { trUpper } from './model.js';
import { PALET, otomatikDersRengi, otomatikSabitRengi } from './colors.js';
import { YAZI_TIPLERI, yaziTipiAnahtari, cssAilesi } from './fonts.js';
import {
  profilSirala, profilSorunlari, yeniProfil, profilSil, sabitEkle, siniflaraProfilAta, profilKullananlar,
  ogretmenAdlandir, ogretmenEkleAyar, ogretmenSil, ogretmenDersSayisi,
  dersAdiEkle, dersAdlandir, dersAdiSil, dersRengiAta, dersKullanimi,
} from './ayarlar.js';
import { base64Kodla } from './pdf-writer.js';

const SEKMELER = [['okul', 'Okul'], ['saatler', 'Saatler'], ['siniflar', 'Sınıflar'], ['ogretmenler', 'Öğretmenler'], ['dersler', 'Dersler']];

/** Paletten renk seçici: küçük örnek kutu + açılır liste ("Otomatik" dahil) */
function renkSecici(secili, otomatik, degisti, etiket) {
  const ornek = el('span', { class: 'renk-ornek', 'aria-hidden': 'true' });
  const boya = (anahtar) => {
    const r = PALET[anahtar] ?? PALET[otomatik];
    ornek.style.background = r.zemin;
    ornek.style.borderTopColor = r.kenar;
  };
  const sec = el('select', {
    'aria-label': etiket,
    onchange: (e) => { boya(e.target.value || otomatik); degisti(e.target.value || null); },
  },
  el('option', { value: '', selected: !secili }, `Otomatik (${PALET[otomatik].ad})`),
  ...Object.entries(PALET).map(([k, r]) => el('option', { value: k, selected: k === secili }, r.ad)));
  boya(secili || otomatik);
  return el('div', { class: 'renk-sec' }, ornek, sec);
}

/**
 * @param program  geçerli program (değiştirilmez)
 * @param se { uygula(kopya), yaziYukle(anahtar) → Promise }
 */
export function ayarlarPenceresiAc(program, se) {
  const pencere = document.getElementById('ayarlarPenceresi');
  const k = structuredClone(program);
  const durum = { sekme: 'okul', profilId: k.profiller[0]?.id, secili: new Set(), ogrAra: '', dersAra: '' };

  const sekmeBar = el('div', { focusgroup: 'tablist nomemory', role: 'tablist', 'aria-label': 'Ayar bölümleri', class: 'sekmeler' });
  const paneller = {};
  for (const [id, ad] of SEKMELER) {
    sekmeBar.append(el('button', {
      type: 'button', role: 'tab', id: `ayarSekme-${id}`, 'aria-selected': String(id === durum.sekme),
      focusgroupstart: id === durum.sekme, onclick: () => sekmeSec(id), onfocus: () => sekmeSec(id),
    }, ad));
    paneller[id] = el('div', { role: 'tabpanel', 'aria-labelledby': `ayarSekme-${id}`, hidden: id !== durum.sekme });
  }
  const icerik = el('div', { class: 'sekme-icerik' }, ...Object.values(paneller));

  function sekmeSec(id) {
    if (durum.sekme === id) return;
    durum.sekme = id;
    for (const b of sekmeBar.children) {
      const sec = b.id === `ayarSekme-${id}`;
      b.ariaSelected = String(sec);
      b.toggleAttribute('focusgroupstart', sec);
    }
    for (const [pid, p] of Object.entries(paneller)) p.hidden = pid !== id;
    icerik.scrollTop = 0;
    ciz();
  }

  const form = el('form', { method: 'dialog', class: 'pencere ayarlar' },
    el('div', { class: 'panel-ust' },
      el('h2', { id: 'ayBaslik' }, 'Ayarlar'),
      el('button', { type: 'button', class: 'kapat', 'aria-label': 'Ayarları kapat', onclick: () => pencere.close() }, '×')),
    sekmeBar,
    icerik,
    el('div', { class: 'pencere-butonlar' },
      el('span', { class: 'not' }, 'Değişiklikler "Uygula"ya basınca programa yansır.'),
      el('span', { class: 'bosluk' }),
      el('button', { type: 'button', class: 'btn', onclick: () => pencere.close() }, 'Vazgeç'),
      el('button', { type: 'button', class: 'btn btn-ana', onclick: () => { pencere.close(); se.uygula(k); } }, 'Uygula')),
  );

  function ciz() {
    const p = paneller[durum.sekme];
    const kap = el('div', { class: 'panel-ic' });
    ({ okul: okulPaneli, saatler: saatPaneli, siniflar: sinifPaneli, ogretmenler: ogretmenPaneli, dersler: dersPaneli })[durum.sekme](kap);
    p.replaceChildren(kap);
  }

  // ---------------- Okul ----------------
  function okulPaneli(kap) {
    const girdi = (etiket, alan, ipucu) => el('label', { class: 'alan' }, el('span', {}, etiket),
      el('input', { value: k.okul[alan] ?? '', oninput: (e) => { k.okul[alan] = e.target.value; } }),
      ipucu ? el('span', { class: 'not' }, ipucu) : null);
    const logoGirdi = el('input', { type: 'file', accept: 'image/png,image/jpeg', hidden: true });
    logoGirdi.addEventListener('change', async () => {
      const f = logoGirdi.files?.[0];
      if (!f) return;
      k.okul.logo = { tip: /png$/i.test(f.type) ? 'png' : 'jpg', veri: base64Kodla(new Uint8Array(await f.arrayBuffer())) };
      ciz();
    });
    const yazi = yaziTipiAnahtari(k);
    const onizleme = el('div', { class: 'yazi-onizleme', style: { fontFamily: `${cssAilesi(yazi)}, Inter, sans-serif` } },
      'MATEMATİK · İNGİLİZCE · DEĞERLER EĞİTİMİ', el('small', {}, 'AYŞE YILMAZ · ÇAĞLA ÖZTÜRK · 09:20 - 10:00 (40dk)'));
    const yaziSec = el('select', {
      'aria-label': 'Yazı tipi',
      onchange: async (e) => {
        k.gorunum = { ...k.gorunum, yazi: e.target.value };
        await se.yaziYukle(e.target.value);
        onizleme.style.fontFamily = `${cssAilesi(e.target.value)}, Inter, sans-serif`;
      },
    }, ...Object.entries(YAZI_TIPLERI).map(([key, y]) => el('option', { value: key, selected: key === yazi }, y.ad)));
    se.yaziYukle(yazi);

    const haric = (k.ayarlar.haftalikSaatHaric ?? []).join(', ');
    kap.append(
      girdi('Okul adı', 'ad', 'Ekranda görünen ad.'),
      girdi('Sayfa başlığı', 'baslik', 'PDF sayfalarının üstünde yazar, ör. MANİSA İSABET OKULLARI'),
      girdi('Dosya adı', 'dosyaAdi', 'Kaydedilen PDF adlarının başı, ör. manisa → manisa_siniflar_v9.pdf'),
      el('div', { class: 'alan' }, el('span', {}, 'Logo'),
        el('div', { class: 'logo-alani' },
          k.okul.logo ? el('img', { src: `data:image/${k.okul.logo.tip === 'jpg' ? 'jpeg' : 'png'};base64,${k.okul.logo.veri}`, alt: 'Okul logosu' }) : el('span', { class: 'not' }, 'Logo yok'),
          el('button', { type: 'button', class: 'btn', onclick: () => logoGirdi.click() }, 'Logo seç…'),
          k.okul.logo ? el('button', { type: 'button', class: 'btn btn-sil', onclick: () => { k.okul.logo = null; ciz(); } }, 'Kaldır') : null,
          logoGirdi)),
      el('div', { class: 'alan' }, el('span', {}, 'Yazı tipi (ekran ve PDF)'), yaziSec, onizleme),
      el('details', { class: 'gelismis' },
        el('summary', {}, 'Gelişmiş'),
        el('label', { class: 'alan' }, el('span', {}, 'Haftalık ders saatine sayılmayan dersler'),
          el('input', {
            value: haric,
            oninput: (e) => { k.ayarlar.haftalikSaatHaric = e.target.value.split(',').map((x) => x.trim()).filter(Boolean); },
          }),
          el('span', { class: 'not' }, 'Ders adında bu kelimelerden biri geçen dersler sayılmaz (virgülle ayırın). Sınıfı olmayan dersler (toplantılar) zaten sayılmaz.'))),
    );
  }

  // ---------------- Saatler ----------------
  function saatPaneli(kap) {
    if (!k.profiller.some((p) => p.id === durum.profilId)) durum.profilId = k.profiller[0].id;
    const prof = k.profiller.find((p) => p.id === durum.profilId);
    const kullanan = profilKullananlar(k, prof.id);

    const liste = el('div', { class: 'profil-listesi' },
      ...k.profiller.map((p) => el('button', {
        type: 'button', 'aria-pressed': String(p.id === prof.id),
        onclick: () => { durum.profilId = p.id; ciz(); },
      }, p.ad || p.id, el('small', {}, `${profilKullananlar(k, p.id).length} sınıf`))),
      el('button', { type: 'button', class: 'btn btn-kucuk', onclick: () => { durum.profilId = yeniProfil(k, prof).id; ciz(); } }, '+ Yeni saat düzeni'),
      el('p', { class: 'not' }, 'Yeni düzen, seçili düzenin kopyası olarak başlar.'));

    const satirlar = el('tbody');
    for (const r of prof.satirlar) {
      const saatGirdi = (alan) => el('input', {
        type: 'time', value: r[alan] || '', 'aria-label': `${r.tur === 'ders' ? `${r.no}. ders` : r.ad} ${alan === 'bas' ? 'başlangıç' : 'bitiş'}`,
        onchange: (e) => { r[alan] = e.target.value; sorunlariGoster(); },
      });
      satirlar.append(el('tr', { class: r.tur === 'sabit' ? 'sabit-satir' : null },
        el('td', {}, r.tur === 'ders'
          ? el('b', {}, `${r.no}. Ders`)
          : el('input', { value: r.ad, 'aria-label': 'Bölüm adı', oninput: (e) => { r.ad = e.target.value; } })),
        el('td', {}, saatGirdi('bas')),
        el('td', {}, saatGirdi('bit')),
        el('td', {}, r.tur === 'sabit' ? renkSecici(r.renk, otomatikSabitRengi(r.ad), (v) => { r.renk = v; }, `${r.ad} rengi`) : null),
        el('td', {}, r.tur === 'sabit'
          ? el('button', { type: 'button', class: 'kapat', 'aria-label': `${r.ad} bölümünü sil`, title: 'Sil', onclick: () => { prof.satirlar = prof.satirlar.filter((x) => x !== r); ciz(); } }, '×')
          : null)));
    }
    const sorunKutusu = el('ul', { class: 'sorunlar', role: 'status' });
    function sorunlariGoster() {
      sorunKutusu.replaceChildren(...profilSorunlari(prof).map((s) => el('li', {}, '⚠ ', s)));
    }
    sorunlariGoster();

    kap.append(el('div', { class: 'saat-duzeni' }, liste,
      el('div', { class: 'profil-duzen' },
        el('div', { class: 'satir2' },
          el('label', { class: 'alan' }, el('span', {}, 'Adı'),
            el('input', { value: prof.ad, oninput: (e) => { prof.ad = e.target.value; } })),
          el('label', { class: 'alan kisa' }, el('span', {}, 'Kısa etiket'),
            el('input', { value: prof.kisa, maxlength: 3, oninput: (e) => { prof.kisa = e.target.value; } }))),
        el('p', { class: 'not' }, 'Kısa etiket, farklı saat düzenli sınıflara giren öğretmenlerin sayfasında "ÖĞLE (İ)" gibi görünür.'),
        el('p', { class: 'not' }, kullanan.length ? `Kullanan sınıflar: ${kullanan.map(trUpper).join(', ')}` : 'Bu düzeni kullanan sınıf yok.'),
        el('table', { class: 'saat-tablosu' },
          el('thead', {}, el('tr', {}, el('th', {}, 'Bölüm'), el('th', {}, 'Başlangıç'), el('th', {}, 'Bitiş'), el('th', {}, 'Renk'), el('th', {}, ''))),
          satirlar),
        sorunKutusu,
        el('div', { class: 'satir' },
          el('button', { type: 'button', class: 'btn', onclick: () => { sabitEkle(prof); ciz(); } }, '+ Sabit bölüm ekle (kahvaltı, etüt…)'),
          el('button', { type: 'button', class: 'btn', onclick: () => { profilSirala(prof); ciz(); } }, 'Saate göre sırala'),
          el('span', { class: 'bosluk' }),
          el('button', {
            type: 'button', class: 'btn btn-sil', disabled: kullanan.length > 0 || k.profiller.length <= 1,
            title: kullanan.length ? 'Önce bu düzeni kullanan sınıfları başka düzene geçirin.' : null,
            onclick: () => { if (profilSil(k, prof.id)) ciz(); },
          }, 'Düzeni sil')),
        el('p', { class: 'not' }, 'Sabit bölümler, Uygula\'ya basınca saatlerine göre derslerin arasına kendiliğinden yerleşir.'))));
  }

  // ---------------- Sınıflar ----------------
  function sinifPaneli(kap) {
    const profilSec = (deger, degisti, etiket) => el('select', { 'aria-label': etiket, onchange: (e) => degisti(e.target.value) },
      ...k.profiller.map((p) => el('option', { value: p.id, selected: p.id === deger }, p.ad || p.id)));
    const rehberSec = (s) => el('select', { 'aria-label': `${s.ad} rehber öğretmeni`, onchange: (e) => { s.rehber = e.target.value; } },
      el('option', { value: '', selected: !s.rehber }, '— Yok —'),
      // Listede olmayan eski bir ad varsa kaybolmasın
      s.rehber && !k.ogretmenler.some((o) => o.ad === s.rehber) ? el('option', { value: s.rehber, selected: true }, `${trUpper(s.rehber)} (listede yok)`) : null,
      ...k.ogretmenler.map((o) => el('option', { value: o.ad, selected: o.ad === s.rehber }, trUpper(o.ad))));

    let topluProfil = k.profiller[0].id;
    const topluSay = el('span', { class: 'not' }, `${durum.secili.size} sınıf seçili`);
    const tumu = el('input', {
      type: 'checkbox', 'aria-label': 'Tüm sınıfları seç', checked: durum.secili.size === k.siniflar.length,
      onchange: (e) => { durum.secili = new Set(e.target.checked ? k.siniflar.map((s) => s.ad) : []); ciz(); },
    });
    const govde = el('tbody', {}, ...k.siniflar.map((s) => el('tr', {},
      el('td', {}, el('input', {
        type: 'checkbox', 'aria-label': `${s.ad} seç`, checked: durum.secili.has(s.ad),
        onchange: (e) => { if (e.target.checked) durum.secili.add(s.ad); else durum.secili.delete(s.ad); topluSay.textContent = `${durum.secili.size} sınıf seçili`; },
      })),
      el('th', { scope: 'row' }, trUpper(s.ad)),
      el('td', {}, profilSec(s.profil, (v) => { s.profil = v; }, `${s.ad} saat düzeni`)),
      el('td', {}, rehberSec(s)))));

    kap.append(
      el('div', { class: 'toplu' },
        el('span', {}, 'Seçili sınıflara saat düzeni uygula:'),
        profilSec(topluProfil, (v) => { topluProfil = v; }, 'Uygulanacak saat düzeni'),
        el('button', { type: 'button', class: 'btn', onclick: () => { siniflaraProfilAta(k, [...durum.secili], topluProfil); ciz(); } }, 'Uygula'),
        topluSay),
      el('table', { class: 'sinif-tablosu liste-tablo' },
        el('thead', {}, el('tr', {}, el('th', {}, tumu), el('th', {}, 'Sınıf'), el('th', {}, 'Saat düzeni'), el('th', {}, 'Sınıf rehber öğretmeni'))),
        govde),
      el('p', { class: 'not' }, 'Listede olmayan bir rehber öğretmeni önce "Öğretmenler" sekmesinden ekleyin.'));
  }

  // ---------------- Öğretmenler ----------------
  function ogretmenPaneli(kap) {
    const hata = el('p', { class: 'hata-yazi', role: 'alert' });
    const ara = el('input', {
      type: 'search', placeholder: 'Ara…', value: durum.ogrAra, 'aria-label': 'Öğretmen ara',
      oninput: (e) => { durum.ogrAra = e.target.value; filtrele(); },
    });
    const govde = el('tbody');
    for (const o of k.ogretmenler) {
      const sayi = ogretmenDersSayisi(k, o.ad);
      const girdi = el('input', {
        value: o.ad, 'aria-label': `${o.ad} adı`,
        onchange: (e) => {
          const h = ogretmenAdlandir(k, o.ad, e.target.value);
          if (h) { hata.textContent = h; e.target.value = o.ad; return; }
          hata.textContent = '';
          ciz();
        },
      });
      govde.append(el('tr', { 'data-ara': trUpper(o.ad) },
        el('td', {}, girdi),
        el('td', { class: 'sayi' }, `${sayi} ders`),
        el('td', {}, el('button', {
          type: 'button', class: 'btn btn-sil btn-kucuk',
          onclick: () => {
            const mesaj = sayi
              ? `${trUpper(o.ad)} silinsin mi?\n${sayi} dersten adı çıkarılacak. Yalnızca ona ait toplantılar silinecek.`
              : `${trUpper(o.ad)} silinsin mi?`;
            if (!confirm(mesaj)) return;
            ogretmenSil(k, o.ad);
            ciz();
          },
        }, 'Sil'))));
    }
    function filtrele() {
      const q = trUpper(durum.ogrAra.trim());
      for (const tr of govde.children) tr.hidden = q && !tr.dataset.ara.includes(q);
    }
    filtrele();
    const yeni = el('input', { placeholder: 'Yeni öğretmenin adı soyadı', 'aria-label': 'Yeni öğretmen adı' });
    const ekle = () => {
      const h = ogretmenEkleAyar(k, yeni.value);
      if (h) { hata.textContent = h; return; }
      durum.ogrAra = '';
      ciz();
    };
    yeni.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); ekle(); } });
    kap.append(
      el('div', { class: 'ekle-satiri' }, yeni, el('button', { type: 'button', class: 'btn btn-ana', onclick: ekle }, '+ Öğretmen ekle')),
      hata,
      el('div', { class: 'ekle-satiri' }, ara, el('span', { class: 'not' }, `${k.ogretmenler.length} öğretmen`)),
      el('table', { class: 'liste-tablo' },
        el('thead', {}, el('tr', {}, el('th', {}, 'Adı soyadı'), el('th', {}, 'Ders'), el('th', {}, ''))),
        govde),
      el('p', { class: 'not' }, 'Adı değiştirince bütün derslerde ve rehber öğretmen bilgisinde de değişir.'));
  }

  // ---------------- Dersler ----------------
  function dersPaneli(kap) {
    const hata = el('p', { class: 'hata-yazi', role: 'alert' });
    const ara = el('input', {
      type: 'search', placeholder: 'Ara…', value: durum.dersAra, 'aria-label': 'Ders ara',
      oninput: (e) => { durum.dersAra = e.target.value; filtrele(); },
    });
    const govde = el('tbody');
    for (const d of k.dersListesi) {
      const kullanim = dersKullanimi(k, d.ad);
      govde.append(el('tr', { 'data-ara': trUpper(d.ad) },
        el('td', {}, el('input', {
          value: d.ad, 'aria-label': `${d.ad} adı`,
          onchange: (e) => {
            const h = dersAdlandir(k, d.ad, e.target.value);
            if (h) { hata.textContent = h; e.target.value = d.ad; return; }
            hata.textContent = '';
            ciz();
          },
        })),
        el('td', {}, renkSecici(d.renk, otomatikDersRengi(d.ad), (v) => dersRengiAta(k, d.ad, v), `${d.ad} rengi`)),
        el('td', { class: 'sayi' }, `${kullanim} ders`),
        el('td', {}, el('button', {
          type: 'button', class: 'btn btn-sil btn-kucuk', disabled: kullanim > 0,
          title: kullanim ? 'Programda kullanılan ders silinemez. Önce bu dersleri silin veya adlarını değiştirin.' : 'Sil',
          onclick: () => { if (dersAdiSil(k, d.ad)) ciz(); },
        }, 'Sil'))));
    }
    function filtrele() {
      const q = trUpper(durum.dersAra.trim());
      for (const tr of govde.children) tr.hidden = q && !tr.dataset.ara.includes(q);
    }
    filtrele();
    const yeni = el('input', { placeholder: 'Yeni ders adı', 'aria-label': 'Yeni ders adı' });
    const ekle = () => {
      const h = dersAdiEkle(k, yeni.value);
      if (h) { hata.textContent = h; return; }
      durum.dersAra = '';
      ciz();
    };
    yeni.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); ekle(); } });
    kap.append(
      el('div', { class: 'ekle-satiri' }, yeni, el('button', { type: 'button', class: 'btn btn-ana', onclick: ekle }, '+ Ders ekle')),
      hata,
      el('div', { class: 'ekle-satiri' }, ara, el('span', { class: 'not' }, `${k.dersListesi.length} ders`)),
      el('table', { class: 'liste-tablo' },
        el('thead', {}, el('tr', {}, el('th', {}, 'Ders adı'), el('th', {}, 'Renk'), el('th', {}, 'Kullanım'), el('th', {}, ''))),
        govde),
      el('p', { class: 'not' }, 'Adı değiştirince programdaki bütün o dersler de değişir. "Otomatik" renk ders adına göre seçilir.'));
  }

  ciz();
  pencere.replaceChildren(form);
  pencere.showModal();
}

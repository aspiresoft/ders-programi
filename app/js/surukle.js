// Ders hücrelerini fareyle sürükleyip başka bir saate bırakma.
// Pointer olayları + pointer yakalama; hedef, birden çok tablo olduğu için elementFromPoint ile bulunur.

const ESIK = 5; // px: bu kadar hareket etmeden sürükleme başlamaz (tıklama/çift tıklama bozulmasın)

/**
 * @param sahne  programların bulunduğu kaydırılabilir kap
 * @param se {
 *   dersBul(id) → ders,
 *   izinli(ders, kart) → bool        (kartın sınıfı/öğretmeni bu derste mi?)
 *   bosMu(ders, gun, bas) → bool     (ipucu: sınıf ve öğretmenler o saatte boş mu?)
 *   birak(dersId, gun, bas, baglam)
 *   dersSayisi() → number
 * }
 */
export function surukleKur(sahne, se) {
  let aktif = null;

  const hucreBilgisi = (td) => {
    const kart = td.closest('article.program');
    const tr = td.closest('tr[data-gun]');
    if (!kart || !tr || !td.dataset.no) return null;
    return { kart, gun: Number(tr.dataset.gun), no: Number(td.dataset.no), genislik: Number(td.dataset.genislik || 1) };
  };

  // İmlecin bulunduğu ders saati (birleşik hücrede yatay konuma göre)
  const saatBul = (td, x) => {
    const b = hucreBilgisi(td);
    if (!b) return null;
    const r = td.getBoundingClientRect();
    const ic = Math.min(b.genislik - 1, Math.max(0, Math.floor(((x - r.left) / r.width) * b.genislik)));
    return { ...b, no: b.no + ic };
  };

  sahne.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || aktif) return;
    const td = e.target.closest('td.dolu[data-ders]');
    if (!td) return;
    const s = saatBul(td, e.clientX);
    const ders = se.dersBul(Number(td.dataset.ders));
    if (!s || !ders) return;
    aktif = {
      ders, kaynakTd: td, x0: e.clientX, y0: e.clientY, pointerId: e.pointerId,
      tutma: s.no - ders.bas, // bloğun hangi saatinden tutuldu
      basladi: false, hedef: null, sonX: e.clientX, sonY: e.clientY, kaydirma: 0,
    };
    td.setPointerCapture(e.pointerId);
  });

  sahne.addEventListener('pointermove', (e) => {
    if (!aktif || e.pointerId !== aktif.pointerId) return;
    aktif.sonX = e.clientX; aktif.sonY = e.clientY;
    if (!aktif.basladi) {
      if (Math.hypot(e.clientX - aktif.x0, e.clientY - aktif.y0) < ESIK) return;
      baslat();
    }
    hayaletiTasi();
    hedefiGuncelle();
  });

  sahne.addEventListener('pointerup', (e) => {
    if (!aktif || e.pointerId !== aktif.pointerId) return;
    const { basladi, hedef, ders } = aktif;
    bitir();
    if (basladi && hedef) se.birak(ders.id, hedef.gun, hedef.bas, hedef.baglam);
  });
  sahne.addEventListener('pointercancel', () => aktif && bitir());
  sahne.addEventListener('lostpointercapture', () => aktif && !aktif.basladi && bitir());
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && aktif?.basladi) { e.preventDefault(); bitir(); }
  });

  function baslat() {
    aktif.basladi = true;
    document.documentElement.classList.add('surukleniyor');
    aktif.kaynakTd.classList.add('kaynak');
    const h = document.createElement('div');
    h.className = 'hayalet';
    h.setAttribute('aria-hidden', 'true');
    h.textContent = aktif.kaynakTd.querySelector('.d-ust')?.textContent ?? '';
    document.body.append(h);
    aktif.hayalet = h;
    ipuclariniGoster();
    aktif.kaydirma = requestAnimationFrame(otomatikKaydir);
  }

  function hayaletiTasi() {
    aktif.hayalet.style.translate = `${aktif.sonX + 14}px ${aktif.sonY + 10}px`;
  }

  // Dersin konabileceği boş saatleri hafifçe yeşile boya
  function ipuclariniGoster() {
    const { ders } = aktif;
    for (const kart of sahne.querySelectorAll('article.program')) {
      if (!se.izinli(ders, kart)) { kart.classList.add('izinsiz'); continue; }
      for (const td of kart.querySelectorAll('td.ders[data-no]')) {
        const b = hucreBilgisi(td);
        if (!b) continue;
        for (let k = 0; k < b.genislik; k++) {
          if (se.bosMu(ders, b.gun, b.no + k - aktif.tutma)) { td.classList.add('uygun'); break; }
        }
      }
    }
  }

  function hedefiGuncelle() {
    for (const td of sahne.querySelectorAll('td.hedef')) td.classList.remove('hedef', 'hedef-dolu');
    aktif.hedef = null;
    const alt = document.elementFromPoint(aktif.sonX, aktif.sonY)?.closest('td.ders[data-no]');
    if (!alt) return;
    const s = saatBul(alt, aktif.sonX);
    if (!s || !se.izinli(aktif.ders, s.kart)) return;
    const N = se.dersSayisi();
    const bas = Math.max(1, Math.min(s.no - aktif.tutma, N - aktif.ders.sure + 1));
    const bit = bas + aktif.ders.sure - 1;
    aktif.hedef = { gun: s.gun, bas, baglam: { tur: s.kart.dataset.tur, ad: s.kart.dataset.ad } };
    // Hedef aralığı işaretle
    const satir = alt.closest('tr');
    for (const td of satir.querySelectorAll('td.ders[data-no]')) {
      const no = Number(td.dataset.no), g = Number(td.dataset.genislik || 1);
      if (no <= bit && no + g - 1 >= bas) {
        td.classList.add('hedef');
        if (td.classList.contains('dolu') && Number(td.dataset.ders) !== aktif.ders.id) td.classList.add('hedef-dolu');
      }
    }
  }

  // İmleç kabın kenarına yaklaşınca kaydır
  function otomatikKaydir() {
    if (!aktif?.basladi) return;
    const r = sahne.getBoundingClientRect();
    const bolge = 60;
    let dy = 0, dx = 0;
    if (aktif.sonY < r.top + bolge) dy = -(r.top + bolge - aktif.sonY);
    else if (aktif.sonY > r.bottom - bolge) dy = aktif.sonY - (r.bottom - bolge);
    if (aktif.sonX < r.left + bolge) dx = -(r.left + bolge - aktif.sonX);
    else if (aktif.sonX > r.right - bolge) dx = aktif.sonX - (r.right - bolge);
    if (dx || dy) {
      sahne.scrollBy(Math.max(-30, Math.min(30, dx * 0.3)), Math.max(-30, Math.min(30, dy * 0.3)));
      hedefiGuncelle();
    }
    aktif.kaydirma = requestAnimationFrame(otomatikKaydir);
  }

  function bitir() {
    if (!aktif) return;
    cancelAnimationFrame(aktif.kaydirma);
    aktif.hayalet?.remove();
    document.documentElement.classList.remove('surukleniyor');
    for (const td of sahne.querySelectorAll('td.uygun, td.hedef, td.kaynak')) td.classList.remove('uygun', 'hedef', 'hedef-dolu', 'kaynak');
    for (const k of sahne.querySelectorAll('article.izinsiz')) k.classList.remove('izinsiz');
    if (aktif.kaynakTd.hasPointerCapture?.(aktif.pointerId)) aktif.kaynakTd.releasePointerCapture(aktif.pointerId);
    aktif = null;
  }
}

// Küçük, bağımlılıksız XML ayrıştırıcı (tarayıcıda ve Node'da aynı şekilde çalışır).
// FET dosyaları basit ve düzenli olduğu için tam bir XML motoruna gerek yok.

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

function decode(s) {
  if (s.indexOf('&') < 0) return s;
  return s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return String.fromCodePoint(code);
    }
    return ENTITIES[e] ?? m;
  });
}

/** XML metnini { name, attrs, children, text } ağacına çevirir. */
export function parseXml(src) {
  const root = { name: '#root', attrs: {}, children: [], text: '' };
  const stack = [root];
  let i = 0;
  const n = src.length;
  while (i < n) {
    const lt = src.indexOf('<', i);
    if (lt < 0) break;
    if (lt > i) stack[stack.length - 1].text += decode(src.slice(i, lt));
    if (src.startsWith('<!--', lt)) { i = src.indexOf('-->', lt) + 3; continue; }
    if (src.startsWith('<?', lt)) { i = src.indexOf('?>', lt) + 2; continue; }
    if (src.startsWith('<![CDATA[', lt)) {
      const end = src.indexOf(']]>', lt);
      stack[stack.length - 1].text += src.slice(lt + 9, end);
      i = end + 3; continue;
    }
    if (src.startsWith('<!', lt)) { i = src.indexOf('>', lt) + 1; continue; }
    const gt = src.indexOf('>', lt);
    let tag = src.slice(lt + 1, gt);
    if (tag[0] === '/') { stack.pop(); i = gt + 1; continue; }
    const selfClose = tag.endsWith('/');
    if (selfClose) tag = tag.slice(0, -1);
    const sp = tag.search(/\s/);
    const name = sp < 0 ? tag : tag.slice(0, sp);
    const attrs = {};
    if (sp >= 0) {
      const re = /([^\s=]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
      let m;
      while ((m = re.exec(tag.slice(sp)))) attrs[m[1]] = decode(m[3] ?? m[4]);
    }
    const el = { name, attrs, children: [], text: '' };
    stack[stack.length - 1].children.push(el);
    if (!selfClose) stack.push(el);
    i = gt + 1;
  }
  return root;
}

export const kids = (el, name) => (el ? el.children.filter((c) => c.name === name) : []);
export const kid = (el, name) => (el ? el.children.find((c) => c.name === name) : undefined);
export const txt = (el, name) => (kid(el, name)?.text ?? '').trim();

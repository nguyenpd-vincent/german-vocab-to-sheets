// Kiểm tra giao diện bằng Playwright: nạp extension (unpacked), giả lập api.faztaa.com.
// Chạy: NODE_PATH=<thư mục node_modules có playwright> node test/ui.test.js
// Popup nằm trong Shadow DOM "closed" → dùng CDP (DOM.getDocument pierce) để lấy gốc shadow rồi thao tác.
const path = require('path');
const fs = require('fs');
const os = require('os');
const { chromium } = require('playwright');
const { md5 } = require('../md5.js');

const EXT = path.resolve(__dirname, '..');
const HEADLESS = process.env.HEADED ? false : true;

// ---------- Dữ liệu giả của Faztaa ----------
const DICT = {
  anrufen: { kind: 'Verb', mean: 'to call (on the phone)' },
  rufen: { kind: 'Verb', mean: 'to shout' },
  kommen: { kind: 'Verb', mean: 'to come' },
  gehen: { kind: 'Verb', mean: 'to go' },
  Haus: { kind: 'Nomen', mean: 'house', art: 'das' },
  Blog: { kind: 'Nomen', mean: 'blog', art: 'der' },
  Beitrag: { kind: 'Nomen', mean: 'contribution; post', art: 'der' },
  Arbeit: { kind: 'Nomen', mean: 'work', art: 'die' },
  Platz: { kind: 'Nomen', mean: 'place; square', art: 'der' },
  Laden: { kind: 'Nomen', mean: 'shop', art: 'der' },
  Wert: { kind: 'Nomen', mean: 'value', art: 'der' },
  langsam: { kind: 'Adjektiv', mean: 'slow' },
  selbst: { kind: 'Adverb', mean: 'self; even' },
  'überwachen': { kind: 'Verb', mean: 'to monitor; to supervise' },
  schnell: { kind: 'Adjektiv', mean: 'fast' }
};
const entry = (w, d) => ({ word: w, pronounce: { de: '/' + w.toLowerCase() + '/' }, content: [{ kind: d.kind, means: [{ mean: d.mean }] }],
  conjugation: d.art ? { gt: { w: d.art } } : {}, snym: [], word_family: [] });
const DELAY = { langsam: 1500 }; // từ "langsam" trả lời chậm để thử tranh chấp giữa hai lần tra
const requests = [];
const gtRequests = []; // các yêu cầu tới Google Dịch (giả lập)
// File phát âm giả của Faztaa: chỉ có cho các từ này (md5 của từ, không mạo từ). Còn lại 404.
const AUDIO_WORDS = ['anrufen', 'Haus', 'Wert'];
const AUDIO_FILES = Object.fromEntries(AUDIO_WORDS.map(w => [md5(w), w]));
const audioRequests = []; // từ (hoặc md5 lạ) mà trang ẩn đã xin file
const BEEP = fs.readFileSync(path.join(__dirname, 'beep.mp3'));
function faztaa(url) {
  const u = new URL(url);
  requests.push(decodeURIComponent(u.pathname));
  let m;
  if ((m = u.pathname.match(/^\/api\/search\/en\/devi\/(.+)$/))) {
    const w = decodeURIComponent(m[1]);
    const key = Object.keys(DICT).find(k => k.toLowerCase() === w.toLowerCase());
    // Không có: trả "kết quả gần giống" (Blogger) để kiểm tra rằng nghĩa của từ khác không bị dùng nhầm.
    const result = key ? [entry(key, DICT[key])] : /^quatsch/i.test(w) ? [] : [entry('Blogger', { kind: 'Nomen', mean: 'blogger (KHÔNG ĐƯỢC DÙNG)', art: 'der' })];
    return { body: { result }, delay: DELAY[w] || 0 };
  }
  if ((m = u.pathname.match(/^\/api\/search\/list\/example\/en\/(.+)$/))) {
    const w = decodeURIComponent(m[1]);
    const page = +u.searchParams.get('page');
    if (!DICT[w] && !Object.keys(DICT).some(k => k.toLowerCase() === w.toLowerCase())) return { body: [] };
    const list = Array.from({ length: page < 3 ? 10 : 3 }, (_, i) => ({ _id: w + page + '-' + i, e: `${w} Satz ${page}.${i}`, m: { en: 'EN ' + i, vi: 'VI ' + i } }));
    return { body: list, delay: DELAY[w] || 0 };
  }
  return { status: 404, body: {} };
}

// ---------- Trang thử ----------
const PAGES = {
  '/basic.html': `<!doctype html><meta charset=utf-8><body style="font:20px serif;margin:40px">
    <p id="p1">Ich rufe dich morgen an. Er kommt aus Berlin.</p>
    <p id="p2">Der Blogbeitrag ist neu. Mein Arbeitsplatz ist hier.</p>
    <p id="p3" style="width:120px;hyphens:auto">Der Ar\u00ADbeits\u00ADplatz.</p>
    <p id="p5">Das ist ein selbstüberwachtes Lernverfahren.</p>
    <p id="p6">Das ist ein Quatschwort hier.</p>
    <p id="p4">Das gilt z. B. für Herrn Dr. Meier, der morgen langsam oder schnell anruft.</p>
    <div style="height:2000px"></div>
    <p id="bottom">Das Haus steht ganz unten.</p></body>`,
  '/shadow.html': `<!doctype html><meta charset=utf-8><body style="font:20px serif;margin:40px"><div id="h"></div>
    <script>document.getElementById('h').attachShadow({mode:'open'}).innerHTML='<p id="sp">Ich rufe dich morgen an.</p>';</script></body>`,
  '/iframe.html': `<!doctype html><meta charset=utf-8><body style="margin:40px"><p>Seite mit Rahmen</p>
    <iframe id="f" src="/inner.html" style="width:300px;height:150px;border:1px solid #888"></iframe></body>`,
  '/inner.html': `<!doctype html><meta charset=utf-8><body style="font:18px serif"><p id="ip">Ich rufe dich morgen an.</p></body>`,
  // Trang có CSP chặn mọi âm thanh/media: phát âm vẫn phải chạy (phát trong trang ẩn của extension).
  '/csp.html': `<!doctype html><meta charset=utf-8><body style="font:20px serif;margin:40px">
    <p id="c1">Ich rufe dich morgen an.</p></body>`,
  '/stopper.html': `<!doctype html><meta charset=utf-8><body style="font:20px serif;margin:40px">
    <div id="banner" style="position:fixed;bottom:0;left:0;right:0;background:#eee;padding:20px">Wir verwenden Cookies auf unserer Website.</div>
    <script>document.getElementById('banner').addEventListener('mouseup', e => e.stopPropagation());</script></body>`
};

// ---------- Hỗ trợ ----------
async function shadowRoot(page) {
  const cdp = await page.context().newCDPSession(page);
  const { root } = await cdp.send('DOM.getDocument', { depth: -1, pierce: true });
  let found = null;
  const walk = n => {
    if (found) return;
    if (n.nodeName === 'DEUTSCH-LENS' && n.shadowRoots?.length) { found = n.shadowRoots[0]; return; }
    for (const c of [...(n.children || []), ...(n.shadowRoots || [])]) walk(c); // chỉ khung chính, không vào iframe
  };
  walk(root);
  if (!found) throw Error('Không tìm thấy <deutsch-lens>');
  const { object } = await cdp.send('DOM.resolveNode', { backendNodeId: found.backendNodeId });
  return { cdp, objectId: object.objectId };
}
// Chạy hàm fn(shadowRoot, ...args) trong trang, trả về giá trị JSON.
async function inPopup(page, fn, ...args) {
  const { cdp, objectId } = await shadowRoot(page);
  const r = await cdp.send('Runtime.callFunctionOn', { objectId, functionDeclaration: `function (...a) { return (${fn.toString()})(this, ...a); }`, arguments: args.map(value => ({ value })), returnByValue: true, awaitPromise: true });
  await cdp.detach();
  if (r.exceptionDetails) throw Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
}
const popupState = page => inPopup(page, root => {
  const s = root.querySelector('section'), t = root.getElementById('trigger');
  const r = s.getBoundingClientRect();
  return { open: !s.hidden, trigger: !t.hidden, title: root.getElementById('title').textContent, text: root.querySelector('main').innerText,
    pinned: root.getElementById('pin').getAttribute('aria-pressed') === 'true', back: !root.getElementById('back').hidden,
    rect: { top: r.top, bottom: r.bottom, left: r.left, right: r.right }, vh: innerHeight, vw: innerWidth };
});
async function waitPopup(page, pred, ms = 6000) {
  const end = Date.now() + ms;
  let st;
  while (Date.now() < end) {
    st = await popupState(page).catch(() => null);
    if (st && pred(st)) return st;
    await page.waitForTimeout(100);
  }
  throw Error('Hết giờ chờ popup. Trạng thái cuối: ' + JSON.stringify(st && { ...st, text: st.text.slice(0, 400) }));
}
// Bôi đen một từ (theo vị trí ký tự) trong phần tử, rồi thả chuột tại đó (có thể giữ Alt).
async function selectWord(frame, selector, word, { alt = false, nth = 0, shadowHost = null } = {}) {
  const box = await frame.evaluate(({ selector, word, nth, shadowHost }) => {
    const rootNode = shadowHost ? document.querySelector(shadowHost).shadowRoot : document;
    const el = rootNode.querySelector(selector);
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let n, count = 0;
    while ((n = walker.nextNode())) {
      let i = -1;
      while ((i = n.data.indexOf(word, i + 1)) >= 0) {
        if (count++ !== nth) continue;
        const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + word.length);
        const s = getSelection(); s.removeAllRanges(); s.addRange(r);
        const b = r.getBoundingClientRect();
        return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
      }
    }
    throw Error('không thấy ' + word);
  }, { selector, word, nth, shadowHost });
  const page = frame.page ? frame.page() : frame;
  let ox = 0, oy = 0;
  if (frame.parentFrame && frame.parentFrame()) {
    const fe = await frame.frameElement(); const b = await fe.boundingBox(); ox = b.x; oy = b.y;
  }
  await page.mouse.move(box.x + ox, box.y + oy);
  if (alt) await page.keyboard.down('Alt');
  // Gửi mouseup vào đúng phần tử để mô phỏng việc thả chuột sau khi bôi đen (không làm mất vùng chọn).
  await frame.evaluate(({ x, y, alt, shadowHost, selector }) => {
    const rootNode = shadowHost ? document.querySelector(shadowHost).shadowRoot : document;
    const el = rootNode.querySelector(selector);
    el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, composed: true, clientX: x, clientY: y, button: 0, altKey: alt, detail: 1 }));
  }, { ...box, alt, shadowHost, selector });
  if (alt) await page.keyboard.up('Alt');
}
async function clickInPopup(page, finder, arg) {
  const pt = await inPopup(page, (root, src, arg) => {
    const el = new Function('root', 'arg', src)(root, arg);
    if (!el) throw Error('Không thấy phần tử trong popup');
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, finder, arg);
  await page.mouse.click(pt.x, pt.y);
}
const byText = `return [...root.querySelectorAll('button,a')].find(b => b.textContent.trim().startsWith(arg))`;

// ---------- Chạy ----------
(async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'dl-ui-'));
  const ctx = await chromium.launchPersistentContext(userData, {
    channel: 'chromium', headless: HEADLESS, viewport: { width: 1100, height: 800 },
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, '--autoplay-policy=no-user-gesture-required']
  });
  const consoleErrors = [];
  await ctx.route('http://test.local/**', r => {
    const p = new URL(r.request().url()).pathname;
    const headers = p === '/csp.html' ? { 'content-security-policy': "default-src 'self'; media-src 'none'; connect-src 'none'" } : {};
    r.fulfill(PAGES[p] ? { status: 200, contentType: 'text/html; charset=utf-8', headers, body: PAGES[p] } : { status: 404, body: '' });
  });
  await ctx.route('https://api.faztaa.com/**', async r => {
    const { status = 200, body, delay = 0 } = faztaa(r.request().url());
    if (delay) await new Promise(res => setTimeout(res, delay));
    await r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) }).catch(() => {});
  });
  await ctx.route('https://data.faztaa.com/**', r => {
    const m = new URL(r.request().url()).pathname.match(/^\/audios\/1103\/([0-9a-f]{32})\.mp3$/);
    const word = m && AUDIO_FILES[m[1]];
    audioRequests.push(word || (m ? m[1] : r.request().url()));
    r.fulfill(word ? { status: 200, contentType: 'audio/mpeg', body: BEEP } : { status: 404, contentType: 'text/html', body: 'Not found' });
  });
  await ctx.route('https://translate.googleapis.com/**', r => {
    const u = new URL(r.request().url());
    const q = u.searchParams.get('q'), tl = u.searchParams.get('tl');
    gtRequests.push(tl + ':' + q);
    const trans = { en: { selbstüberwachtes: 'self-monitored', Quatschwort: 'nonsense word' }, vi: { selbstüberwachtes: 'tự giám sát', Quatschwort: 'từ vô nghĩa' } }[tl]?.[q] || q;
    r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({ sentences: [{ trans, orig: q }], src: 'de' }) });
  });
  let [sw] = ctx.serviceWorkers();
  if (!sw) sw = await ctx.waitForEvent('serviceworker');
  sw.on('console', m => { if (m.type() === 'error') consoleErrors.push('SW: ' + m.text()); });
  const extId = new URL(sw.url()).host;

  const results = [];
  const t = async (name, fn) => {
    const page = await ctx.newPage();
    page.on('console', m => { if (m.type() === 'error' && /Deutsch Lens/.test(m.text())) consoleErrors.push(name + ': ' + m.text()); });
    page.on('pageerror', e => consoleErrors.push(name + ' pageerror: ' + e.message));
    try { await fn(page); results.push(['✓', name]); }
    catch (e) { results.push(['✗', name, e.message]); }
    finally { await page.close(); }
  };
  const setStore = v => sw.evaluate(v => chrome.storage.local.set(v), v);
  const open = async (page, p) => { await page.goto('http://test.local' + p); await page.waitForTimeout(300); };

  await setStore({ token: '', scope: 'all', lookupMode: 'button', closeOnOutside: false });

  await t('Chưa có token → thông báo + nút Mở Cài đặt', async page => {
    await open(page, '/basic.html');
    await selectWord(page, '#p1', 'rufe', { alt: true });
    const st = await waitPopup(page, s => s.open && /token/i.test(s.text));
    if (!/Mở Cài đặt/.test(st.text)) throw Error(st.text);
    const pagesBefore = ctx.pages().length;
    await clickInPopup(page, byText, '⚙ Mở Cài đặt');
    await page.waitForTimeout(800);
    const opt = ctx.pages().find(p => p.url().includes('options.html'));
    if (!opt) throw Error('không mở được trang Cài đặt (' + pagesBefore + ' tab)');
    await opt.close();
  });

  await setStore({ token: 'TEST-TOKEN' });

  await t('Nút "Tra Faztaa" → rufe … an → anrufen', async page => {
    await open(page, '/basic.html');
    await selectWord(page, '#p1', 'rufe');
    await waitPopup(page, s => s.trigger && !s.open);
    await clickInPopup(page, `return root.getElementById('trigger')`);
    const st = await waitPopup(page, s => s.open && /to call/.test(s.text));
    if (!/Động từ tách: rufe … an → anrufen/.test(st.text)) throw Error(st.text);
    if (!/Ví dụ · anrufen/.test(st.text)) throw Error('thiếu ví dụ: ' + st.text);
  });

  await t('Chọn "an" → anrufen; "kommt aus Berlin" → kommen', async page => {
    await open(page, '/basic.html');
    await selectWord(page, '#p1', 'an', { alt: true, nth: 0 });
    await waitPopup(page, s => /to call/.test(s.text));
    await selectWord(page, '#p1', 'kommt', { alt: true });
    const st = await waitPopup(page, s => /to come/.test(s.text));
    if (/auskommen/.test(st.text.split('Tra theo')[0])) throw Error(st.text);
  });

  await t('Từ ghép Blogbeitrag → Blog + Beitrag, không dùng nghĩa "gần giống"', async page => {
    await open(page, '/basic.html');
    await selectWord(page, '#p2', 'Blogbeitrag', { alt: true });
    const st = await waitPopup(page, s => /Từ ghép:/.test(s.text));
    if (!/Blog \+ Beitrag/.test(st.text) || !/contribution/.test(st.text)) throw Error(st.text);
    if (/KHÔNG ĐƯỢC DÙNG/.test(st.text)) throw Error('dùng nhầm nghĩa của từ khác: ' + st.text);
    // Bấm vào phần "Blog" → tra riêng, rồi ← quay lại
    await clickInPopup(page, `return [...root.querySelectorAll('.part .chip')].find(b => b.textContent === arg)`, 'Blog');
    await waitPopup(page, s => /^Blog/.test(s.title) && /blog/.test(s.text) && s.back);
    await clickInPopup(page, `return root.getElementById('back')`);
    await waitPopup(page, s => /Từ ghép:/.test(s.text));
  });

  await t('Phân từ ghép selbstüberwachtes → selbst + überwachen', async page => {
    await open(page, '/basic.html');
    await selectWord(page, '#p5', 'selbstüberwachtes', { alt: true });
    const st = await waitPopup(page, s => /Từ ghép:/.test(s.text));
    if (!/selbst \+ überwachen/.test(st.text) || !/to monitor/.test(st.text) || !/self; even/.test(st.text)) throw Error(st.text);
    if (/Chưa tìm thấy mục từ/.test(st.text)) throw Error(st.text);
  });

  await t('Arbeitsplatz → Arbeit +s Platz', async page => {
    await open(page, '/basic.html');
    await selectWord(page, '#p2', 'Arbeitsplatz', { alt: true });
    const st = await waitPopup(page, s => /Từ ghép:/.test(s.text));
    if (!/Arbeit \+ Platz/.test(st.text) || !/\+s/.test(st.text)) throw Error(st.text);
  });

  await t('Gạch nối mềm bị bỏ: Ar­beits­platz → Arbeitsplatz', async page => {
    await open(page, '/basic.html');
    await selectWord(page, '#p3', 'Ar\u00ADbeits\u00ADplatz', { alt: true });
    const st = await waitPopup(page, s => s.open && /Arbeit/.test(s.text));
    if (/\u00AD/.test(st.title)) throw Error('còn gạch nối mềm: ' + JSON.stringify(st.title));
  });

  await t('Shadow DOM: chọn "rufe" → vẫn nhận ra anrufen (có câu)', async page => {
    await open(page, '/shadow.html');
    await selectWord(page, '#sp', 'rufe', { alt: true, shadowHost: '#h' });
    const st = await waitPopup(page, s => s.open && !/Đang/.test(s.text));
    if (!/anrufen/.test(st.text)) throw Error(st.text);
  });

  await t('iframe nhỏ → popup hiện ở khung chính', async page => {
    await open(page, '/iframe.html');
    const frame = page.frames().find(f => f.url().endsWith('/inner.html'));
    await frame.waitForLoadState();
    await page.waitForTimeout(300);
    await selectWord(frame, '#ip', 'rufe', { alt: true });
    const st = await waitPopup(page, s => s.open && /to call/.test(s.text));
    if (st.rect.right - st.rect.left < 300) throw Error('popup quá hẹp');
  });

  await t('Banner chặn mouseup (stopPropagation) vẫn tra được', async page => {
    await open(page, '/stopper.html');
    await setStore({ lookupMode: 'auto' });
    try {
      await page.waitForTimeout(100);
      await selectWord(page, '#banner', 'Cookies');
      await waitPopup(page, s => s.open);
    } finally { await setStore({ lookupMode: 'button' }); }
  });

  await t('Chế độ "bôi đen là tra ngay": bấm nút trong popup không tra lại', async page => {
    await setStore({ lookupMode: 'auto' });
    try {
      await open(page, '/basic.html');
      await selectWord(page, '#p1', 'rufe');
      await waitPopup(page, s => /anrufen Satz 1\.9/.test(s.text));
      await clickInPopup(page, byText, 'Xem thêm ví dụ');
      await waitPopup(page, s => /anrufen Satz 2\.9/.test(s.text));
      await page.waitForTimeout(500);
      const st = await popupState(page);
      if (st.back || st.trigger || !/Satz 2\.9/.test(st.text)) throw Error('đã tra lại / hiện nút: ' + JSON.stringify({ back: st.back, trigger: st.trigger }));
    } finally { await setStore({ lookupMode: 'button' }); }
  });

  await t('Bấm nút trong popup không làm hiện lại nút "Tra Faztaa"', async page => {
    await open(page, '/basic.html');
    await selectWord(page, '#p1', 'rufe', { alt: true });
    await waitPopup(page, s => /anrufen Satz 1\.9/.test(s.text));
    await clickInPopup(page, `return root.getElementById('pin')`);
    await page.waitForTimeout(400);
    const st = await popupState(page);
    if (st.trigger) throw Error('nút Tra Faztaa hiện lại');
  });

  await t('Click tiêu đề không ghim; kéo thì ghim', async page => {
    await open(page, '/basic.html');
    await selectWord(page, '#p1', 'rufe', { alt: true });
    let st = await waitPopup(page, s => /to call/.test(s.text));
    const hx = st.rect.left + 150, hy = st.rect.top + 15;
    await page.mouse.click(hx, hy);
    st = await popupState(page);
    if (st.pinned) throw Error('click đã ghim popup');
    await page.mouse.move(hx, hy); await page.mouse.down(); await page.mouse.move(hx + 80, hy + 60, { steps: 5 }); await page.mouse.up();
    st = await popupState(page);
    if (!st.pinned) throw Error('kéo chưa ghim');
  });

  await t('Từ ở đáy màn hình: popup nằm trọn trong khung nhìn', async page => {
    await page.setViewportSize({ width: 1100, height: 500 });
    await open(page, '/basic.html');
    await page.evaluate(() => { const b = document.getElementById('bottom'); window.scrollTo(0, b.offsetTop - innerHeight + 30); });
    await selectWord(page, '#bottom', 'Haus', { alt: true });
    const st = await waitPopup(page, s => /house/.test(s.text));
    if (st.rect.top < 0 || st.rect.bottom > st.vh + 1) throw Error('ra ngoài: ' + JSON.stringify(st.rect) + ' vh=' + st.vh);
  });

  await t('Đổi kích thước: kéo cạnh phải (ngang), cạnh dưới (dọc), nhớ cho lần sau', async page => {
    await setStore({ popupSize: null });
    await open(page, '/basic.html');
    await selectWord(page, '#p1', 'rufe', { alt: true });
    let st = await waitPopup(page, s => /to call/.test(s.text));
    const w0 = st.rect.right - st.rect.left;
    // cạnh phải: kéo sang phải 150px
    let y = (st.rect.top + st.rect.bottom) / 2;
    await page.mouse.move(st.rect.right - 2, y); await page.mouse.down(); await page.mouse.move(st.rect.right + 148, y, { steps: 6 }); await page.mouse.up();
    st = await popupState(page);
    const w1 = st.rect.right - st.rect.left;
    if (Math.abs(w1 - (w0 + 150)) > 4) throw Error('rộng ' + w0 + ' → ' + w1);
    // cạnh dưới: kéo lên 200px (thu nhỏ chiều cao)
    const x = (st.rect.left + st.rect.right) / 2, h0 = st.rect.bottom - st.rect.top;
    await page.mouse.move(x, st.rect.bottom - 2); await page.mouse.down(); await page.mouse.move(x, st.rect.bottom - 202, { steps: 6 }); await page.mouse.up();
    st = await popupState(page);
    const h1 = st.rect.bottom - st.rect.top;
    if (Math.abs(h1 - (h0 - 200)) > 4) throw Error('cao ' + h0 + ' → ' + h1);
    // kéo góc trái-trên: cả hai chiều
    const r = st.rect;
    await page.mouse.move(r.left + 6, r.top + 6); await page.mouse.down(); await page.mouse.move(r.left - 44, r.top - 34, { steps: 6 }); await page.mouse.up();
    st = await popupState(page);
    if (Math.abs((st.rect.right - st.rect.left) - (w1 + 50)) > 4 || Math.abs((st.rect.bottom - st.rect.top) - (h1 + 40)) > 4) throw Error('góc: ' + JSON.stringify(st.rect));
    const saved = { w: Math.round(st.rect.right - st.rect.left), h: Math.round(st.rect.bottom - st.rect.top) };
    await page.waitForTimeout(300);
    // lần tra mới (trang mới) dùng lại cỡ đã lưu
    await open(page, '/basic.html');
    await selectWord(page, '#p1', 'kommt', { alt: true });
    st = await waitPopup(page, s => /to come/.test(s.text));
    if (Math.abs(st.rect.right - st.rect.left - saved.w) > 2 || Math.abs(st.rect.bottom - st.rect.top - saved.h) > 2) throw Error('không nhớ cỡ: ' + JSON.stringify(st.rect) + ' ' + JSON.stringify(saved));
    await setStore({ popupSize: null });
  });

  await t('Popup căn giữa màn hình theo chiều ngang, không dính đáy, không che từ', async page => {
    await setStore({ popupSize: null });
    await page.setViewportSize({ width: 1100, height: 800 });
    const wordRect = () => page.evaluate(() => { const r = getSelection().getRangeAt(0).getBoundingClientRect(); return { top: r.top, bottom: r.bottom }; });
    const check = async (label, st, w) => {
      const cx = (st.rect.left + st.rect.right) / 2;
      if (Math.abs(cx - st.vw / 2) > 2) throw Error(label + ': không căn giữa ngang ' + JSON.stringify(st.rect) + ' vw=' + st.vw);
      if (st.rect.top < 0 || st.rect.bottom > st.vh + 1) throw Error(label + ': ra ngoài ' + JSON.stringify(st.rect));
      if (st.rect.top < w.bottom && st.rect.bottom > w.top) throw Error(label + ': che từ ' + JSON.stringify({ popup: st.rect, word: w }));
      if (st.vh - st.rect.bottom < 8) throw Error(label + ': dính đáy ' + JSON.stringify(st.rect));
    };
    // Từ ở giữa: popup lệch lên/xuống để không che, vẫn căn giữa ngang.
    await open(page, '/basic.html');
    await page.evaluate(() => { const p = document.getElementById('p1'); window.scrollTo(0, p.offsetTop - innerHeight / 2); });
    await selectWord(page, '#p1', 'rufe', { alt: true });
    let st = await waitPopup(page, s => /to call/.test(s.text));
    await page.waitForTimeout(150);
    await check('giữa', await popupState(page), await wordRect());
    // Từ sát đáy: popup ở phía trên.
    await page.keyboard.press('Escape');
    await page.evaluate(() => { const b = document.getElementById('bottom'); window.scrollTo(0, b.offsetTop - innerHeight + 40); });
    await selectWord(page, '#bottom', 'Haus', { alt: true });
    await waitPopup(page, s => /house/.test(s.text));
    await page.waitForTimeout(150);
    st = await popupState(page);
    const w = await wordRect();
    await check('đáy', st, w);
    if (st.rect.bottom > w.top) throw Error('đáy: popup phải nằm trên từ');
    // Từ sát đỉnh: popup nằm giữa màn hình (không che vì từ ở trên cao).
    await page.keyboard.press('Escape');
    await page.evaluate(() => window.scrollTo(0, 0));
    await selectWord(page, '#p1', 'rufe', { alt: true });
    await waitPopup(page, s => /to call/.test(s.text));
    await page.waitForTimeout(150);
    await check('đỉnh', await popupState(page), await wordRect());
    const style = await inPopup(page, root => root.querySelector('section').style.bottom);
    if (style !== 'auto') throw Error('bottom=' + style);
  });

  await t('Alt+click ghép thêm "an"; ← quay lại khôi phục đúng', async page => {
    await open(page, '/basic.html');
    await selectWord(page, '#p1', 'Ich', { alt: true });
    await waitPopup(page, s => s.open && !/Đang/.test(s.text));
    // Alt+click "rufe"
    const pt = await page.evaluate(() => {
      const n = document.querySelector('#p1').firstChild; const i = n.data.indexOf('rufe');
      const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + 4); const b = r.getBoundingClientRect();
      getSelection().removeAllRanges(); return { x: b.left + 5, y: b.top + b.height / 2 };
    });
    await page.keyboard.down('Alt'); await page.mouse.click(pt.x, pt.y); await page.keyboard.up('Alt');
    let st = await waitPopup(page, s => /Đã ghép thêm/.test(s.text) && !/Đang/.test(s.text));
    if (!/Ich rufe/.test(st.title)) throw Error(st.title);
    await clickInPopup(page, `return root.getElementById('back')`);
    st = await waitPopup(page, s => !/Đã ghép thêm/.test(s.text));
    if (!/^Ich/.test(st.title) || /rufe/.test(st.title)) throw Error(st.title);
  });

  await t('Tranh chấp: lần tra chậm không đè lần tra mới', async page => {
    await open(page, '/basic.html');
    await selectWord(page, '#p4', 'langsam', { alt: true });
    await page.waitForTimeout(150);
    await selectWord(page, '#p4', 'schnell', { alt: true });
    await waitPopup(page, s => /fast/.test(s.text));
    await page.waitForTimeout(2000);
    const st = await popupState(page);
    if (!/fast/.test(st.text) || /slow/.test(st.text)) throw Error('bị đè: ' + st.text.slice(0, 200));
  });

  await t('Xem thêm ví dụ', async page => {
    await open(page, '/basic.html');
    await selectWord(page, '#p1', 'rufe', { alt: true });
    await waitPopup(page, s => /anrufen Satz 1\.9/.test(s.text));
    await clickInPopup(page, byText, 'Xem thêm ví dụ');
    await waitPopup(page, s => /anrufen Satz 2\.9/.test(s.text));
  });

  await t('Esc đóng popup', async page => {
    await open(page, '/basic.html');
    await selectWord(page, '#p1', 'rufe', { alt: true });
    await waitPopup(page, s => s.open);
    await page.keyboard.press('Escape');
    await waitPopup(page, s => !s.open);
  });

  await t('Phạm vi "một website": trang khác không tra; Cài đặt → Kiểm tra vẫn đúng', async page => {
    await setStore({ scope: 'site', scopeUrl: 'https://example.org/' });
    await open(page, '/basic.html');
    await selectWord(page, '#p1', 'rufe', { alt: true });
    await page.waitForTimeout(800);
    const st = await popupState(page);
    if (st.open) throw Error('popup vẫn mở ngoài phạm vi');
    const opt = await ctx.newPage();
    await opt.goto(`chrome-extension://${extId}/options.html`);
    await opt.click('#test');
    await opt.waitForFunction(() => !/Đang kiểm tra/.test(document.getElementById('status').textContent));
    const txt = await opt.textContent('#status');
    await opt.close();
    await setStore({ scope: 'all', scopeUrl: '' });
    if (!/Kết nối thành công: der Wert/.test(txt)) throw Error(txt);
  });

  await t('Google Dịch: tắt mặc định → không có yêu cầu nào', async () => {
    if (gtRequests.length) throw Error(gtRequests.join(', '));
  });

  await t('Google Dịch bật: Faztaa không có → hiện dịch máy EN + VN, chỉ gửi đúng từ', async page => {
    await setStore({ googleFallback: true });
    try {
      await open(page, '/basic.html');
      await selectWord(page, '#p5', 'selbstüberwachtes', { alt: true });
      const st = await waitPopup(page, s => /google dịch/i.test(s.text));
      if (!/self-monitored/.test(st.text) || !/tự giám sát/.test(st.text)) throw Error(st.text);
      if (!/selbst \+ überwachen/.test(st.text)) throw Error('mất phần tách từ ghép: ' + st.text);
      if (/Selbstüberwachtes/.test(st.text)) throw Error('viết hoa nhầm tính từ ghép');
      const bad = gtRequests.filter(x => !/^(en|vi):selbstüberwachtes$/.test(x));
      if (bad.length) throw Error('gửi sai: ' + bad.join(', '));
      // Faztaa có đúng từ → không gọi Google
      const before = gtRequests.length;
      await selectWord(page, '#p1', 'rufe', { alt: true });
      const st2 = await waitPopup(page, s => /to call/.test(s.text));
      if (gtRequests.length !== before || /google dịch/i.test(st2.text)) throw Error('gọi Google dù Faztaa có từ');
    } finally { await setStore({ googleFallback: false }); }
  });

  await t('Google Dịch: Faztaa không có mục nào → vẫn có nút lưu', async page => {
    await setStore({ googleFallback: true });
    try {
      await open(page, '/basic.html');
      await selectWord(page, '#p6', 'Quatschwort', { alt: true });
      const st = await waitPopup(page, s => /google dịch/i.test(s.text));
      if (!/nonsense word/.test(st.text) || !/Faztaa chưa có mục từ này/.test(st.text) || !/Thêm vào từ vựng/.test(st.text)) throw Error(st.text);
    } finally { await setStore({ googleFallback: false }); }
  });

  // ---------- Phát âm ----------
  // Thay chrome.tts trong service worker bằng bản giả: ghi lại chữ được đọc và giọng; autoEnd=false để giả lập đang đọc dở.
  const fakeTts = (voices, autoEnd = true) => sw.evaluate(({ voices, autoEnd }) => {
    globalThis.__tts = { calls: [], stops: 0, voices, autoEnd, pending: null };
    const finish = type => { const f = __tts.pending; __tts.pending = null; if (f) f({ type }); };
    Object.defineProperty(chrome, 'tts', { configurable: true, value: {
      getVoices: async () => __tts.voices,
      speak: (text, opts, cb) => { __tts.calls.push({ text, voice: opts.voiceName, lang: opts.lang }); __tts.pending = opts.onEvent; if (__tts.autoEnd) setTimeout(() => finish('end'), 50); cb && cb(); },
      stop: () => { __tts.stops++; finish('interrupted'); }
    } });
  }, { voices, autoEnd });
  const ttsState = () => sw.evaluate(() => globalThis.__tts);
  // Playwright không chặn được yêu cầu mạng của trang ẩn (offscreen document) thật. Vì vậy trong test, mở chính
  // offscreen.html trong một tab thường (yêu cầu mạng của tab thì chặn được) và báo service worker rằng trang ẩn đã có.
  // Mã phát (offscreen.js, md5, chuỗi dự phòng) vẫn là mã thật; chỉ khác loại trang chứa.
  const audioTab = await ctx.newPage();
  await audioTab.goto(`chrome-extension://${extId}/offscreen.html`);
  await sw.evaluate(() => { globalThis.hasOffscreen = async () => true; });
  const LOCAL_DE = { voiceName: 'Anna', lang: 'de-DE', remote: false };
  const REMOTE_DE = { voiceName: 'Google Deutsch', lang: 'de-DE', remote: true };
  const until = async (fn, what, ms = 5000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) { const v = await fn(); if (v) return v; await new Promise(r => setTimeout(r, 100)); }
    throw Error('Hết giờ chờ: ' + what);
  };
  const speakState = page => inPopup(page, root => ({
    playing: [...root.querySelectorAll('.speak.playing')].length,
    msg: [...root.querySelectorAll('.speak-msg')].map(p => p.textContent).join(' | ')
  }));
  const h2Speak = `return root.querySelector('h2 .speak')`;

  await t('Phát âm: mục từ Faztaa → phát file ghi âm của Faztaa (md5 đúng từ, không mạo từ)', async page => {
    await fakeTts([LOCAL_DE]);
    await open(page, '/basic.html');
    await selectWord(page, '#p1', 'rufe', { alt: true });
    await waitPopup(page, s => /to call/.test(s.text));
    audioRequests.length = 0;
    await clickInPopup(page, h2Speak);
    await until(() => audioRequests.includes('anrufen'), 'yêu cầu file anrufen');
    await until(async () => !(await speakState(page)).playing, 'phát xong');
    const st = await speakState(page), tts = await ttsState();
    if (st.msg || tts.calls.length) throw Error('không nên dùng giọng máy: ' + JSON.stringify({ st, tts }));
    // Danh từ có mạo từ: tiêu đề "das Haus" nhưng file theo "Haus"; nút trong bảng (Từ vựng) cũng phát được.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await selectWord(page, '#bottom', 'Haus', { alt: true });
    await waitPopup(page, s => /house/.test(s.text));
    audioRequests.length = 0;
    await clickInPopup(page, `return root.querySelector('td .speak')`);
    await until(() => audioRequests.includes('Haus'), 'yêu cầu file Haus');
    if (audioRequests.some(w => w !== 'Haus')) throw Error('xin sai file: ' + audioRequests.join(', '));
  });

  await t('Phát âm: Faztaa không có file (từ ghép tự tách) → giọng tiếng Đức của máy', async page => {
    await fakeTts([{ voiceName: 'Samantha', lang: 'en-US', remote: false }, REMOTE_DE, LOCAL_DE]);
    await open(page, '/basic.html');
    await selectWord(page, '#p5', 'selbstüberwachtes', { alt: true });
    await waitPopup(page, s => /selbst \+ überwachen/.test(s.text));
    audioRequests.length = 0;
    await clickInPopup(page, h2Speak);
    const tts = await until(async () => { const x = await ttsState(); return x.calls.length && x; }, 'giọng máy');
    if (audioRequests[0] !== md5('selbstüberwachtes')) throw Error('không thử file Faztaa trước: ' + audioRequests.join(', '));
    if (tts.calls[0].text !== 'selbstüberwachtes' || tts.calls[0].voice !== 'Anna') throw Error(JSON.stringify(tts.calls));
  });

  await t('Phát âm câu ví dụ: đọc bằng giọng máy, không xin file Faztaa', async page => {
    await fakeTts([LOCAL_DE]);
    await open(page, '/basic.html');
    await selectWord(page, '#p1', 'rufe', { alt: true });
    await waitPopup(page, s => /anrufen Satz 1\.0/.test(s.text));
    audioRequests.length = 0;
    await clickInPopup(page, `return root.querySelector('article .speak')`);
    const tts = await until(async () => { const x = await ttsState(); return x.calls.length && x; }, 'đọc câu');
    if (tts.calls[0].text !== 'anrufen Satz 1.0' || audioRequests.length) throw Error(JSON.stringify({ calls: tts.calls, audioRequests }));
  });

  await t('Phát âm: máy chỉ có giọng online → báo cài giọng; bật Google Dịch thì dùng giọng online', async page => {
    await fakeTts([REMOTE_DE, { voiceName: 'Samantha', lang: 'en-US', remote: false }]);
    await open(page, '/basic.html');
    await selectWord(page, '#p5', 'selbstüberwachtes', { alt: true });
    await waitPopup(page, s => /selbst \+ überwachen/.test(s.text));
    await clickInPopup(page, h2Speak);
    const st = await until(async () => { const x = await speakState(page); return x.msg && x; }, 'thông báo');
    if (!/chưa có giọng đọc tiếng Đức/.test(st.msg) || (await ttsState()).calls.length) throw Error(JSON.stringify(st));
    await setStore({ googleFallback: true });
    try {
      await selectWord(page, '#p5', 'selbstüberwachtes', { alt: true });
      await waitPopup(page, s => /google dịch/i.test(s.text));
      await clickInPopup(page, h2Speak);
      const tts = await until(async () => { const x = await ttsState(); return x.calls.length && x; }, 'giọng online');
      if (tts.calls[0].voice !== 'Google Deutsch') throw Error(JSON.stringify(tts.calls));
    } finally { await setStore({ googleFallback: false }); }
  });

  await t('Phát âm: bấm lần nữa để dừng; Esc / tra từ mới cũng dừng', async page => {
    await fakeTts([LOCAL_DE], false); // giọng máy "đọc mãi" cho tới khi bị dừng
    await open(page, '/basic.html');
    await selectWord(page, '#p1', 'rufe', { alt: true });
    await waitPopup(page, s => /anrufen Satz 1\.0/.test(s.text));
    const ex = `return root.querySelector('article .speak')`;
    await clickInPopup(page, ex);
    await until(async () => (await speakState(page)).playing === 1, 'đang phát');
    await clickInPopup(page, ex);
    await until(async () => (await speakState(page)).playing === 0, 'dừng khi bấm lại');
    if (!(await ttsState()).stops) throw Error('không gọi tts.stop');
    // Đang đọc thì bấm nút khác: chỉ một nút sáng
    await clickInPopup(page, ex);
    await clickInPopup(page, `return root.querySelectorAll('article .speak')[1]`);
    await page.waitForTimeout(300);
    if ((await speakState(page)).playing !== 1) throw Error('hai nút cùng phát');
    const stops = (await ttsState()).stops;
    await page.keyboard.press('Escape');
    await until(async () => (await ttsState()).stops > stops, 'Esc dừng phát');
  });

  await t('Phát âm trên trang có CSP chặn media vẫn chạy (phát trong trang ẩn)', async page => {
    await fakeTts([LOCAL_DE]);
    await open(page, '/csp.html');
    await selectWord(page, '#c1', 'rufe', { alt: true });
    await waitPopup(page, s => /to call/.test(s.text));
    audioRequests.length = 0;
    await clickInPopup(page, h2Speak);
    await until(() => audioRequests.includes('anrufen'), 'file anrufen');
    await until(async () => !(await speakState(page)).playing, 'phát xong');
    const st = await speakState(page), tts = await ttsState();
    if (st.msg || tts.calls.length) throw Error('file Faztaa không phát được: ' + JSON.stringify({ st, calls: tts.calls }));
  });

  await audioTab.close();

  await t('Faztaa chỉ nhận từ/ứng viên, không nhận câu', async () => {
    const bad = requests.filter(p => /\s/.test(p.replace(/^\/api\/search\/(en\/devi|list\/example\/en)\//, '')) && /morgen|Berlin/.test(p));
    if (bad.length) throw Error(bad.join(', '));
  });

  await ctx.close();
  fs.rmSync(userData, { recursive: true, force: true });
  for (const r of results) console.log(...r);
  if (consoleErrors.length) console.log('Lỗi console:\n' + consoleErrors.join('\n'));
  const fail = results.filter(r => r[0] === '✗').length + (consoleErrors.length ? 1 : 0);
  console.log(fail ? fail + ' lỗi' : 'Tất cả đạt (' + results.length + ')');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

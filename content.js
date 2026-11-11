(() => {
  'use strict';
  if (window.__deutschLens) return;
  window.__deutschLens = true;

  const IS_TOP = window === window.top;
  // Lỗi giao diện ghi ra console trang với tiền tố [Deutsch Lens] để dễ tìm.
  const log = (...a) => console.error('[Deutsch Lens]', ...a);

  // ---------- Khung giao diện (Shadow DOM để không bị CSS của trang ảnh hưởng) ----------
  // Dùng thẻ tự đặt tên thay vì <div>: CSS kiểu "body > div { display:none !important }" của trang không chạm tới được.
  const host = document.createElement('deutsch-lens');
  host.style.cssText = 'all:initial;position:fixed;z-index:2147483647;top:0;left:0;width:0;height:0';
  const attachHost = () => { if (!host.isConnected) (document.documentElement || document).append(host); };
  attachHost();
  const root = host.attachShadow({ mode: 'closed' });
  root.innerHTML = `<style>
    *{box-sizing:border-box}
    section{position:fixed;font:14px/1.5 system-ui,-apple-system,sans-serif;color:#173b33;background:#fff;width:min(500px,calc(100vw - 16px));
      display:flex;flex-direction:column;border:1px solid #cfe0d8;border-radius:10px;box-shadow:0 14px 50px #12343a40;overflow:hidden;text-align:left}
    header{display:flex;gap:6px;align-items:center;padding:8px 10px;background:#163e37;color:#fff;cursor:move;user-select:none;flex:none;touch-action:none}
    header strong{flex:1;font-size:13px;opacity:.9;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    header button{background:transparent;border:1px solid #ffffff40;color:#fff;padding:3px 8px;border-radius:7px;cursor:pointer;font:inherit;font-size:13px}
    header button[aria-pressed=true]{background:#f3c64d;color:#163e37;border-color:#f3c64d}
    header button[hidden]{display:none}
    main{padding:12px 14px 16px;overflow:auto;flex:1;min-height:0}
    h2{margin:0 0 6px;font-size:20px}
    h3{margin:16px 0 6px;font-size:14px}
    button{font:inherit;cursor:pointer}
    .btn{padding:6px 11px;border:1px solid #bfd4c9;border-radius:8px;background:#f1f8f4;color:#184d3a}
    .btn:disabled{opacity:.6;cursor:default}
    .btn[hidden]{display:none}
    .chips{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0;align-items:center}
    .chip{padding:3px 10px;border:1px solid #bfd4c9;border-radius:999px;background:#fff;color:#184d3a;font-size:13px}
    .chip.active{background:#185845;color:#fff;border-color:#185845}
    .chip .x{margin-left:6px;opacity:.7}
    .box{background:#f4f9f6;border:1px solid #dce9e2;border-radius:10px;padding:8px 10px;margin:8px 0}
    .box b{color:#11493a}
    .box.mt{background:#fff8e6;border-color:#f0d9a0}
    .box.mt .src{font-size:11px;color:#8a5a00;text-transform:uppercase;letter-spacing:.03em}
    .speak{border:0;background:transparent;padding:0 4px;margin-left:4px;font-size:16px;line-height:1;vertical-align:middle;border-radius:6px;color:#185845}
    .speak:hover{background:#e6f1eb}
    .speak.playing{background:#f3c64d}
    .speak:disabled{opacity:.5;cursor:default}
    .part{display:flex;gap:8px;align-items:baseline;margin:4px 0}
    .part .chip{flex:none}
    .ok{color:#1d7a4f;font-weight:600}
    .muted{color:#687b72;font-size:12px}
    .warn{color:#8a5a00;font-size:12px}
    td,th{padding:7px 8px;border:1px solid #dce7df;text-align:left;vertical-align:top;white-space:pre-wrap;overflow-wrap:anywhere}
    table{border-collapse:collapse;width:100%;margin-top:6px}
    th{width:130px;background:#f2f7f3;font-weight:600}
    article{padding:8px 0;border-bottom:1px solid #e3ece6}
    select{max-width:100%;padding:6px;margin:4px 0}
    a{color:#185845}
    p{margin:6px 0;white-space:pre-wrap}
    #trigger{position:fixed;padding:5px 10px;border:1px solid #185845;border-radius:8px;background:#185845;color:#fff;font:13px system-ui,sans-serif;box-shadow:0 4px 18px #12343a40}
    #trigger[hidden],section[hidden]{display:none}
    .grip{position:absolute;z-index:3;touch-action:none}
    .grip[data-dir=n]{top:0;left:10px;right:10px;height:6px;cursor:ns-resize}
    .grip[data-dir=s]{bottom:0;left:10px;right:10px;height:6px;cursor:ns-resize}
    .grip[data-dir=e]{right:0;top:10px;bottom:10px;width:6px;cursor:ew-resize}
    .grip[data-dir=w]{left:0;top:10px;bottom:10px;width:6px;cursor:ew-resize}
    .grip[data-dir=ne]{top:0;right:0;width:16px;height:16px;cursor:nesw-resize}
    .grip[data-dir=nw]{top:0;left:0;width:16px;height:16px;cursor:nwse-resize}
    .grip[data-dir=sw]{bottom:0;left:0;width:16px;height:16px;cursor:nesw-resize}
    .grip[data-dir=se]{bottom:0;right:0;width:16px;height:16px;cursor:nwse-resize;
      background:linear-gradient(135deg,transparent 50%,#9db8ab 50%,#9db8ab 60%,transparent 60%,transparent 75%,#9db8ab 75%,#9db8ab 85%,transparent 85%)}
  </style>
  <button id="trigger" hidden>Tra Faztaa</button>
  <section hidden role="dialog" aria-label="Deutsch Lens">
    <header>
      <button id="back" title="Quay lại từ trước" hidden>←</button>
      <strong id="title">Deutsch Lens</strong>
      <button id="pin" title="Ghim: popup đứng yên, không tự đóng" aria-pressed="false">📌</button>
      <button id="settings" title="Cài đặt">⚙</button>
      <button id="close" title="Đóng (Esc)">✕</button>
    </header>
    <main></main>
    <div class="grip" data-dir="n" title="Kéo để đổi chiều cao · double-click: cỡ tự động"></div>
    <div class="grip" data-dir="s" title="Kéo để đổi chiều cao · double-click: cỡ tự động"></div>
    <div class="grip" data-dir="e" title="Kéo để đổi chiều rộng · double-click: cỡ tự động"></div>
    <div class="grip" data-dir="w" title="Kéo để đổi chiều rộng · double-click: cỡ tự động"></div>
    <div class="grip" data-dir="ne"></div><div class="grip" data-dir="nw"></div><div class="grip" data-dir="sw"></div>
    <div class="grip" data-dir="se" title="Kéo để đổi kích thước · double-click: cỡ tự động"></div>
  </section>`;

  const $ = id => root.getElementById(id);
  const panel = root.querySelector('section'), main = root.querySelector('main'), header = root.querySelector('header');
  const trigger = $('trigger'), backBtn = $('back'), pinBtn = $('pin');

  let prefs = { lookupMode: 'button', closeOnOutside: false };
  let pinned = false, seq = 0, selSeq = 0, saving = false;
  let pendingSel = null;   // vùng chọn đang chờ bấm nút "Tra Faztaa"
  let current = null;      // phản hồi đang hiển thị; kèm baseSel + extras của lần tra đó
  const history = [];

  // Gạch nối mềm / ký tự rộng 0 mà nhiều trang chèn vào giữa từ (CSS hyphens:auto, CMS…)
  const INVISIBLE = /[­​-‍⁠﻿]/g;
  const stripInvisible = t => String(t || '').replace(INVISIBLE, '');
  const el = (tag, text, cls) => { const e = document.createElement(tag); if (text != null) e.textContent = text; if (cls) e.className = cls; return e; };
  const str = v => typeof v === 'string' ? v : v == null ? '' : String(v);
  const alive = () => { try { return !!chrome.runtime?.id; } catch { return false; } };

  async function send(msg) {
    // Sau khi extension được cập nhật/tải lại, script cũ trên trang mất kết nối (chrome.runtime.id = undefined).
    if (!alive()) throw Error('Extension vừa được cập nhật. Hãy tải lại trang này.');
    try {
      const r = await chrome.runtime.sendMessage(msg);
      if (r == null) throw Error('Không nhận được phản hồi từ extension.');
      return r;
    } catch (e) {
      if (/context invalidated|receiving end does not exist/i.test(e.message)) throw Error('Extension vừa được cập nhật. Hãy tải lại trang này.');
      throw e;
    }
  }

  // ---------- Mở / đóng / vị trí ----------
  function close() { stopSpeaking(); panel.hidden = true; trigger.hidden = true; seq++; history.length = 0; current = null; }
  function setPinned(v) { pinned = v; if (v) manual = true; pinBtn.setAttribute('aria-pressed', String(v)); }
  $('close').onclick = close;
  pinBtn.onclick = () => setPinned(!pinned);
  $('settings').onclick = () => send({ type: 'settings' }).catch(log);
  backBtn.onclick = () => { if (!history.length) return; current = history.pop(); seq++; safeRender(current); };
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (!panel.hidden) close(); else trigger.hidden = true;
  });

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(v, hi));
  const validSize = z => z && Number.isFinite(z.w) && Number.isFinite(z.h) ? { w: Math.max(280, z.w), h: Math.max(160, z.h) } : null;
  function setPrefs(p) {
    prefs = p;
    if ('popupSize' in p) userSize = validSize(p.popupSize);
  }

  // Kích thước người dùng đã kéo ({w, h}); null = tự động (rộng 500px, cao theo nội dung).
  // Lưu qua service worker (content script không đọc storage) để lần sau mở lại đúng cỡ.
  const MIN_W = 280, MIN_H = 160;
  let userSize = null;
  function applySize() {
    const s = panel.style;
    if (userSize) {
      s.width = Math.min(userSize.w, innerWidth - 16) + 'px';
      s.height = Math.min(userSize.h, innerHeight - 16) + 'px';
      s.maxHeight = 'none';
    } else {
      s.width = Math.min(500, innerWidth - 16) + 'px';
      s.height = '';
    }
  }

  // Vị trí popup: luôn CĂN GIỮA theo chiều ngang màn hình; theo chiều dọc cũng đặt giữa màn hình,
  // trừ khi như vậy sẽ che mất từ đang tra — khi đó đặt ngay dưới (hoặc ngay trên) từ.
  // Popup cao theo nội dung nên vị trí được tính lại mỗi khi nội dung đổi chiều cao (ResizeObserver),
  // cho tới khi người dùng tự kéo/đổi cỡ (manual) hoặc ghim popup.
  // Trước đây popup neo ngay dưới từ và kéo dài tới đáy màn hình nên trông như bị dính đáy.
  let anchor = null, manual = false;
  const AUTO_MAX_H = 560; // chiều cao tối đa khi tự động (px)
  function place(rect) {
    anchor = rect || null;
    manual = false;
    reposition();
  }
  function reposition() {
    applySize();
    const s = panel.style, vw = innerWidth, vh = innerHeight;
    const W = userSize ? Math.min(userSize.w, vw - 16) : Math.min(500, vw - 16);
    const maxH = userSize ? Math.min(userSize.h, vh - 16) : Math.min(AUTO_MAX_H, vh - 16);
    if (!userSize) s.maxHeight = maxH + 'px';
    s.bottom = 'auto';
    s.left = Math.max(8, Math.round((vw - W) / 2)) + 'px';
    // Chiều cao thật lúc này (nội dung có thể đang tải); popup đang ẩn thì ước lượng.
    const h = Math.min(maxH, panel.hidden ? 260 : panel.getBoundingClientRect().height || 260);
    let top = (vh - h) / 2;
    const r = anchor;
    const covers = r && top < r.bottom + 6 && top + h > r.top - 6;
    if (covers) {
      const below = vh - r.bottom - 16, above = r.top - 16;
      if (h <= below) top = r.bottom + 8;
      else if (h <= above) top = r.top - 8 - h;
      else if (below >= above) { top = r.bottom + 8; if (!userSize) s.maxHeight = Math.max(MIN_H, below) + 'px'; }
      else { const hh = Math.max(MIN_H, above); top = r.top - 8 - hh; if (!userSize) s.maxHeight = hh + 'px'; }
    }
    s.top = Math.round(clamp(top, 8, Math.max(8, vh - Math.min(h, vh - 16) - 8))) + 'px';
  }
  // Nội dung tải xong làm popup cao lên → căn lại cho cân (không đụng tới khi người dùng đã tự đặt vị trí).
  new ResizeObserver(() => {
    if (!panel.hidden && !manual) reposition();
  }).observe(panel);
  // Cửa sổ đổi kích thước: kéo popup trở lại trong khung nhìn.
  addEventListener('resize', () => {
    if (panel.hidden) return;
    if (!manual) { anchor = null; reposition(); return; } // vị trí từ cũ không còn đúng sau khi đổi cỡ cửa sổ
    applySize();
    const r = panel.getBoundingClientRect();
    if (r.right > innerWidth || r.bottom > innerHeight || r.left < 0 || r.top < 0) {
      const top = clamp(r.top, 8, Math.max(8, innerHeight - (userSize ? r.height : 228) - 8));
      panel.style.left = clamp(r.left, 8, Math.max(8, innerWidth - r.width - 8)) + 'px';
      panel.style.top = top + 'px'; panel.style.bottom = 'auto';
      if (!userSize) panel.style.maxHeight = (innerHeight - top - 8) + 'px';
    }
  });

  // Kéo cạnh / góc để đổi kích thước (ngang, dọc, hoặc cả hai). Double-click vào cạnh: trở về cỡ tự động.
  for (const grip of root.querySelectorAll('.grip')) {
    const dir = grip.dataset.dir;
    grip.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      e.preventDefault();
      const r0 = panel.getBoundingClientRect(), x0 = e.clientX, y0 = e.clientY;
      grip.setPointerCapture(e.pointerId);
      const move = ev => {
        const dx = ev.clientX - x0, dy = ev.clientY - y0;
        let { left, top, width, height } = r0;
        if (dir.includes('e')) width = clamp(r0.width + dx, MIN_W, innerWidth - r0.left);
        if (dir.includes('s')) height = clamp(r0.height + dy, MIN_H, innerHeight - r0.top);
        if (dir.includes('w')) { width = clamp(r0.width - dx, MIN_W, r0.right); left = r0.right - width; }
        if (dir.includes('n')) { height = clamp(r0.height - dy, MIN_H, r0.bottom); top = r0.bottom - height; }
        const s = panel.style;
        Object.assign(s, { left: left + 'px', top: top + 'px', bottom: 'auto', width: width + 'px', height: height + 'px', maxHeight: 'none' });
        userSize = { w: Math.round(width), h: Math.round(height) };
        manual = true;
      };
      const up = () => {
        grip.removeEventListener('pointermove', move);
        grip.removeEventListener('pointerup', up);
        grip.removeEventListener('pointercancel', up);
        if (userSize) send({ type: 'saveSize', size: userSize }).catch(() => {});
      };
      grip.addEventListener('pointermove', move);
      grip.addEventListener('pointerup', up);
      grip.addEventListener('pointercancel', up);
    });
    grip.addEventListener('dblclick', () => {
      userSize = null;
      send({ type: 'saveSize', size: null }).catch(() => {});
      const r = panel.getBoundingClientRect();
      applySize();
      panel.style.maxHeight = Math.max(MIN_H, innerHeight - r.top - 8) + 'px';
    });
  }

  // Kéo tiêu đề để di chuyển popup; chỉ tự ghim khi thật sự kéo (trước đây một cú click vào tiêu đề cũng ghim).
  header.addEventListener('pointerdown', e => {
    if (e.button !== 0 || e.target.closest('button')) return;
    const r = panel.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top, x0 = e.clientX, y0 = e.clientY;
    let moved = false;
    header.setPointerCapture(e.pointerId);
    const move = ev => {
      if (!moved && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 4) return;
      moved = true;
      manual = true;
      const top = clamp(ev.clientY - dy, 0, innerHeight - 40);
      panel.style.left = clamp(ev.clientX - dx, 0, innerWidth - 60) + 'px';
      panel.style.top = top + 'px';
      panel.style.bottom = 'auto';
      // Cỡ do người dùng kéo được giữ nguyên khi di chuyển; cỡ tự động thì chỉ giới hạn để không tràn màn hình.
      if (!userSize) panel.style.maxHeight = Math.max(120, innerHeight - top - 8) + 'px';
    };
    const up = () => {
      header.removeEventListener('pointermove', move);
      header.removeEventListener('pointerup', up);
      header.removeEventListener('pointercancel', up);
      if (moved) setPinned(true);
    };
    header.addEventListener('pointermove', move);
    header.addEventListener('pointerup', up);
    header.addEventListener('pointercancel', up);
  });

  // Click ra ngoài: chỉ đóng khi bật trong Cài đặt và chưa ghim.
  document.addEventListener('mousedown', e => {
    if (panel.hidden || pinned || !prefs.closeOnOutside || e.altKey) return;
    if (e.composedPath().includes(host)) return;
    close();
  }, true);
  // Cuộn trang: nút "Tra Faztaa" không còn nằm cạnh từ nữa → ẩn đi.
  addEventListener('scroll', () => { trigger.hidden = true; }, { capture: true, passive: true });

  // ---------- Ngữ cảnh: lấy đoạn văn quanh vùng chọn (chỉ dùng trong extension, không gửi cho Faztaa) ----------
  // Khối gần nhất không phải inline. Đi xuyên qua Shadow DOM: nếu tới gốc shadow thì dùng chính gốc đó
  // (trước đây trả về document.body → Range lỗi → mất câu khi chọn chữ trong Shadow DOM).
  function blockOf(node) {
    let n = node.nodeType === 1 ? node : node.parentNode;
    while (n && n !== document.body && n !== document.documentElement) {
      if (n instanceof ShadowRoot) return n;
      if (n.nodeType === 1 && !getComputedStyle(n).display.startsWith('inline')) return n;
      n = n.parentNode;
    }
    return n || document.body;
  }
  // Trả về đoạn văn (tối đa ±1000 ký tự) và vị trí từ được chọn trong đoạn đó; background sẽ tách đúng câu.
  function getContext(range) {
    try {
      const block = blockOf(range.startContainer);
      const pre = document.createRange();
      pre.selectNodeContents(block);
      pre.setEnd(range.startContainer, range.startOffset);
      // NFC giống chuỗi đã chọn: trang viết "a + dấu ¨" rời (macOS) sẽ không làm lệch vị trí.
      const offset = stripInvisible(pre.toString()).normalize('NFC').length;
      const text = stripInvisible(block.textContent).normalize('NFC').replace(/\s/g, ' ');
      const from = Math.max(0, offset - 1000);
      return { context: text.slice(from, offset + 1000), contextOffset: offset - from };
    } catch (e) { log('getContext', e); return { context: '', contextOffset: -1 }; }
  }
  function wordAtPoint(x, y) {
    const r = document.caretRangeFromPoint?.(x, y);
    if (!r || r.startContainer.nodeType !== 3) return '';
    const t = r.startContainer.data, i = r.startOffset;
    const isL = c => /[\p{L}\p{M}'’­-]/u.test(c || '');
    let a = i, b = i;
    while (a > 0 && isL(t[a - 1])) a--;
    while (b < t.length && isL(t[b])) b++;
    return stripInvisible(t.slice(a, b)).normalize('NFC').replace(/^['’-]+|['’-]+$/g, '');
  }
  // Vùng chọn thật, kể cả khi nằm trong Shadow DOM mở (getComposedRanges, Chrome 137+).
  function selectedRange(sel, path) {
    const range = sel.getRangeAt(0);
    const roots = [];
    for (const n of path || []) if (n instanceof ShadowRoot) roots.push(n);
    if (!roots.length || typeof sel.getComposedRanges !== 'function') return range;
    try {
      let sr;
      try { [sr] = sel.getComposedRanges({ shadowRoots: roots }); } catch { [sr] = sel.getComposedRanges(...roots); }
      if (!sr || sr.collapsed) return range;
      const r = document.createRange();
      r.setStart(sr.startContainer, sr.startOffset);
      r.setEnd(sr.endContainer, sr.endOffset);
      return r;
    } catch { return range; }
  }
  // Vị trí hiện tại của vùng chọn (tính lại lúc mở popup: trang có thể đã cuộn từ lúc bôi đen).
  function rectOf(sel) {
    try {
      if (sel.range && sel.range.startContainer.isConnected) {
        const r = sel.range.getBoundingClientRect();
        if (r.width || r.height) return { left: r.left, top: r.top, bottom: r.bottom };
      }
    } catch { /* bỏ qua */ }
    return sel.rect || null;
  }

  // ---------- Tra cứu ----------
  // sel: { text, context, contextOffset, range?, rect? }; extras: các từ ghép thêm bằng Alt+click.
  async function startLookup(sel, { extras = [], keepPosition = false } = {}) {
    attachHost();
    stopSpeaking();
    const id = ++seq;
    const query = [sel.text, ...extras].join(' ');
    if (current) { history.push(current); if (history.length > 20) history.shift(); }
    current = null;
    if (!keepPosition && !(pinned && !panel.hidden)) place(rectOf(sel));
    panel.hidden = false; trigger.hidden = true;
    $('title').textContent = query;
    backBtn.hidden = !history.length;
    main.replaceChildren(el('p', 'Đang phân tích và tra “' + query + '”…', 'muted'));
    try {
      const msg = { type: 'analyze', word: query };
      // Đã ghép thêm từ: vị trí trong câu không còn đúng với cả cụm, chỉ gửi câu để phân tích.
      if (extras.length) Object.assign(msg, { context: sel.context || '', contextOffset: -1 });
      else Object.assign(msg, { context: sel.context || '', contextOffset: Number.isInteger(sel.contextOffset) ? sel.contextOffset : -1 });
      const r = await send(msg);
      if (id !== seq) return;
      if (r.disabled) { close(); return; }
      if (r.error) throw Object.assign(Error(r.error), { needsSettings: r.needsSettings });
      current = normalize({ ...r, baseSel: sel, extras }, query);
      safeRender(current);
    } catch (e) {
      if (id === seq) showError(e);
    }
  }

  function showError(e) {
    const out = [el('p', (e && e.message) || String(e))];
    if (e && e.needsSettings) { const b = el('button', '⚙ Mở Cài đặt', 'btn'); b.onclick = () => send({ type: 'settings' }).catch(log); out.push(b); }
    else out.push(el('p', 'Thử lại, hoặc kiểm tra token trong Cài đặt (⚙).', 'muted'));
    backBtn.hidden = !history.length;
    main.replaceChildren(...out);
  }
  // Đảm bảo phản hồi luôn đủ trường, để giao diện không bao giờ đọc phải undefined.
  const normEntry = e => {
    const o = e && typeof e === 'object' ? e : {};
    return { synthetic: !!o.synthetic, word: str(o.word), headword: str(o.headword), ipa: str(o.ipa), meaning: str(o.meaning), pos: str(o.pos),
      forms: str(o.forms), synonyms: str(o.synonyms), family: str(o.family) };
  };
  const normExample = x => ({ id: str(x?.id), de: str(x?.de), en: str(x?.en), vi: str(x?.vi) });
  function normalize(r, query) {
    const q = str(r.query || query);
    const candidates = (Array.isArray(r.candidates) ? r.candidates : [])
      .filter(c => c && typeof c.word === 'string' && c.word)
      .map(c => ({ word: c.word, kind: str(c.kind), label: str(c.label || c.word), found: !!c.found }));
    if (!candidates.length) candidates.push({ word: q, kind: 'surface', label: q, found: false });
    const chosen = Number.isInteger(r.chosen) && r.chosen >= 0 && r.chosen < candidates.length ? r.chosen : 0;
    const compound = r.compound && Array.isArray(r.compound.parts) && r.compound.parts.length
      ? { word: str(r.compound.word), article: str(r.compound.article),
          parts: r.compound.parts.map(p => ({ lemma: str(p?.lemma || p?.text), fuge: str(p?.fuge), meaning: str(p?.meaning) })) }
      : null;
    const separable = r.separable && r.separable.lemma ? { lemma: str(r.separable.lemma), display: str(r.separable.display), weak: !!r.separable.weak } : null;
    return {
      query: q, candidates, chosen, compound, separable, note: str(r.note), exact: !!r.exact,
      entries: (Array.isArray(r.entries) ? r.entries : []).map(normEntry),
      examples: (Array.isArray(r.examples) ? r.examples : []).filter(x => x && x.de).map(normExample),
      hasMore: !!r.hasMore, exampleWord: str(r.exampleWord),
      errors: (Array.isArray(r.errors) ? r.errors : []).map(str),
      prep: (Array.isArray(r.prep) ? r.prep : []).filter(x => x && x.prep),
      sentence: str(r.sentence),
      machine: r.machine && (r.machine.en || r.machine.vi) ? { word: str(r.machine.word), en: str(r.machine.en), vi: str(r.machine.vi),
        dict: (Array.isArray(r.machine.dict) ? r.machine.dict : []).filter(d => d && Array.isArray(d.terms)).map(d => ({ pos: str(d.pos), terms: d.terms.map(str) })) } : null,
      baseSel: r.baseSel || null, extras: Array.isArray(r.extras) ? r.extras : []
    };
  }
  function safeRender(r) {
    try { render(r); }
    catch (e) { log(e); showError(Error('Lỗi hiển thị: ' + e.message)); }
  }

  async function chooseCandidate(i) {
    const base = current;
    if (!base || i === base.chosen) return;
    const c = base.candidates[i];
    const id = ++seq;
    main.prepend(el('p', 'Đang tra “' + c.word + '”…', 'muted'));
    try {
      const r = await send({ type: 'lookup', word: c.word, page: 1, sentence: base.sentence });
      if (id !== seq) return;
      if (r.disabled) { close(); return; }
      if (r.error) throw Object.assign(Error(r.error), { needsSettings: r.needsSettings });
      const candidates = base.candidates.map((x, j) => j === i ? { ...x, found: !!r.exact } : x);
      const entries = Array.isArray(r.entries) ? r.entries : [];
      history.push(base); if (history.length > 20) history.shift();
      current = normalize({ ...base, candidates, chosen: i, compound: null, entries, exact: r.exact, examples: r.examples,
        hasMore: r.hasMore, exampleWord: c.word, prep: r.prep, errors: r.errors,
        note: r.exact ? '' : entries.length ? 'Faztaa không có đúng từ này; đang hiện kết quả gần nhất.' : '' }, base.query);
      safeRender(current);
    } catch (e) {
      if (id !== seq) return;
      // Vẽ lại lần tra đang hiện (để các nút của nó hoạt động lại với seq mới) rồi báo lỗi ở đầu.
      // Trước đây seq đã tăng nên nút "Xem thêm ví dụ"/"Thêm vào từ vựng" của bảng cũ bị vô hiệu ngầm.
      safeRender(base);
      main.prepend(el('p', e.message, 'warn'));
    }
  }

  function lookupWord(word) {
    // Tra riêng một từ (vd một phần của từ ghép), không kèm ngữ cảnh câu.
    startLookup({ text: word, context: '', contextOffset: -1, rect: null }, { keepPosition: true });
  }

  // ---------- Hiển thị ----------
  // ---------- Phát âm ----------
  // Nút 🔊: bấm để nghe, bấm lần nữa (khi đang phát) để dừng. Chỉ một âm thanh phát tại một thời điểm.
  // Service worker thử file ghi âm của Faztaa trước (cần headword), không có thì dùng giọng đọc tiếng Đức của máy.
  let speaking = null; // { btn } của nút đang phát
  function stopSpeaking() {
    if (!speaking) return;
    speaking.btn.classList.remove('playing');
    speaking = null;
    send({ type: 'stopAudio' }).catch(() => {});
  }
  function speakButton(target, what) {
    const b = el('button', '🔊', 'speak');
    b.type = 'button';
    b.title = 'Nghe phát âm ' + what;
    b.setAttribute('aria-label', b.title);
    b.onclick = async e => {
      e.preventDefault(); e.stopPropagation();
      if (speaking?.btn === b) { stopSpeaking(); return; }
      if (speaking) speaking.btn.classList.remove('playing'); // lệnh mới sẽ tự dừng âm cũ
      const me = speaking = { btn: b };
      b.classList.add('playing');
      const t = typeof target === 'function' ? target() : target;
      let error = '';
      try {
        const r = await send({ type: 'speak', text: t.text, headword: t.headword || '' });
        if (r?.error) error = r.error;
        else if (r?.disabled) error = 'Trang này không được bật tra từ.';
      } catch (err) { error = err.message; }
      if (speaking === me) speaking = null;
      b.classList.remove('playing');
      // Báo lỗi ngay dưới khối chứa nút; lần bấm sau xóa báo cũ.
      const block = b.closest('h2, td, article, .box') || b.parentElement;
      block.nextElementSibling?.classList.contains('speak-msg') && block.nextElementSibling.remove();
      if (error && b.isConnected) { const p = el('p', error, 'warn speak-msg'); block.after(p); }
    };
    return b;
  }

  function rows(entry) {
    const table = el('table');
    const fields = [['Từ vựng', entry.word], ['Phiên âm', entry.ipa], ['English meaning', entry.meaning], ['Wortart', entry.pos],
      ['Dạng từ / biến cách', entry.forms], ['Từ đồng nghĩa / gần nghĩa', entry.synonyms], ['Wortfamilie / từ liên quan', entry.family]];
    for (const [k, v] of fields) {
      if (entry.synthetic && !v) continue;
      const td = el('td', v || 'Chưa có dữ liệu từ Faztaa');
      if (k === 'Từ vựng' && entry.word) td.append(speakButton({ text: entry.word, headword: entry.headword }, '“' + entry.word + '”'));
      const tr = el('tr'); tr.append(el('th', k), td); table.append(tr);
    }
    return table;
  }

  function render(r) {
    const id = seq;
    backBtn.hidden = !history.length;
    const cand = r.candidates[r.chosen] || { word: r.query };
    const title = str((r.compound ? ((r.compound.article ? r.compound.article + ' ' : '') + r.compound.word)
      : (r.exact && r.entries[0]?.word) || cand.word) || r.query);
    const same = title.toLowerCase().endsWith(r.query.toLowerCase()) || cand.word === r.query;
    $('title').textContent = r.query + (same ? '' : ' → ' + cand.word);
    // Từ ở tiêu đề: mục từ Faztaa khớp → dùng đúng từ của Faztaa (có file ghi âm); còn lại (từ ghép tự tách,
    // chỉ có Google Dịch, không tìm thấy) → vẫn thử file Faztaa theo từ không mạo từ rồi tới giọng đọc của máy.
    const titleEntry = r.exact && r.entries[0] && !r.entries[0].synthetic && r.entries[0].word === title ? r.entries[0] : null;
    const h2 = el('h2', title);
    h2.append(speakButton({ text: title, headword: titleEntry?.headword || title.replace(/^(der|die|das)\s+/i, '') }, '“' + title + '”'));
    const out = [h2];

    // Phân tích: động từ tách + các ứng viên từ gốc
    if (r.separable) {
      const p = el('p');
      p.append(r.separable.weak ? 'Có thể là động từ tách: ' : 'Động từ tách: ', el('b', r.separable.display), ' → ', el('b', r.separable.lemma));
      out.push(p);
    }
    if (r.candidates.length > 1) {
      const chips = el('div', null, 'chips');
      chips.append(el('span', 'Tra theo:', 'muted'));
      r.candidates.forEach((c, i) => {
        const b = el('button', c.word + (c.found ? ' ✓' : ''), 'chip' + (i === r.chosen ? ' active' : ''));
        b.title = c.label + (c.found ? ' — có trên Faztaa' : '');
        b.onclick = () => chooseCandidate(i);
        chips.append(b);
      });
      out.push(chips);
    }
    if (r.extras.length && r.baseSel) {
      const chips = el('div', null, 'chips');
      chips.append(el('span', 'Đã ghép thêm:', 'muted'));
      r.extras.forEach((w, i) => {
        const b = el('button', w, 'chip'); b.append(el('span', '×', 'x')); b.title = 'Bỏ từ này';
        b.onclick = () => startLookup(r.baseSel, { extras: r.extras.filter((_, j) => j !== i), keepPosition: true });
        chips.append(b);
      });
      out.push(chips);
    }
    if (r.note) out.push(el('p', r.note, 'warn'));

    // Dịch máy Google (chỉ có khi người dùng bật và Faztaa không có đúng mục từ) — ghi rõ nguồn.
    if (r.machine) {
      const box = el('div', null, 'box mt');
      box.append(el('div', 'Dịch máy · Google Dịch — không phải mục từ của Faztaa', 'src'));
      if (r.machine.en) { const p = el('p'); p.append('EN: ', el('b', r.machine.en)); box.append(p); }
      if (r.machine.vi) { const p = el('p'); p.append('VN: ', el('b', r.machine.vi)); box.append(p); }
      for (const d of r.machine.dict) box.append(el('div', (d.pos ? d.pos + ': ' : '') + d.terms.join(', '), 'muted'));
      out.push(box);
    }

    // Từ ghép
    if (r.compound) {
      const box = el('div', null, 'box');
      const h = el('p'); h.append('Từ ghép: ', el('b', r.compound.parts.map(p => p.lemma).join(' + ')));
      box.append(h);
      for (const p of r.compound.parts) {
        const row = el('div', null, 'part');
        const b = el('button', p.lemma, 'chip'); b.title = 'Tra riêng “' + p.lemma + '”'; b.onclick = () => lookupWord(p.lemma);
        row.append(b);
        if (p.fuge && p.fuge !== '-e') row.append(el('span', '+' + p.fuge, 'muted'));
        row.append(el('span', p.meaning || 'chưa có trên Faztaa', p.meaning ? '' : 'muted'));
        box.append(row);
      }
      // Danh từ ghép: phần cuối quyết định giống; tính từ/phân từ ghép (selbst + überwachen): quyết định từ loại.
      const head = r.compound.parts[r.compound.parts.length - 1].lemma;
      const decides = head && head[0] !== head[0].toLowerCase() ? 'giống và nghĩa chính' : 'từ loại và nghĩa chính';
      box.append(el('p', 'Faztaa không có nguyên từ này. Nghĩa ghép từ các phần; phần cuối quyết định ' + decides + '.', 'muted'));
      out.push(box);
    }

    // Động từ + giới từ
    if (r.prep.length) {
      const box = el('div', null, 'box');
      box.append(el('div', 'Hay đi với giới từ:', 'muted'));
      for (const x of r.prep) {
        const line = el('div');
        line.append((x.reflexive ? 'sich ' : '') + str(x.verb) + ' ', el('b', str(x.prep)), ' + ' + str(x.case));
        if (x.inSentence) line.append(' ', el('span', '✓ có trong câu', 'ok'));
        box.append(line);
      }
      out.push(box);
    }

    // Mục từ Faztaa
    // Faztaa không có mục nào nhưng có dịch máy → vẫn cho lưu vào Sheets, ghi rõ nguồn.
    const machineEntry = r.machine ? { word: r.query, ipa: '', synonyms: '',
      meaning: '[Google Dịch] ' + [r.machine.en, r.machine.vi ? 'VN: ' + r.machine.vi : ''].filter(Boolean).join('\n') } : null;
    let currentEntry = r.entries[0] || machineEntry;
    const holder = el('div');
    // Lưu vào Google Sheets (khai báo trước để ô chọn mục từ có thể đặt lại nút lưu)
    let saveButton = null;
    const msg = el('p', '', 'muted');
    const resetSave = () => { if (saveButton) { saveButton.disabled = false; saveButton.textContent = '＋ Thêm vào từ vựng'; msg.textContent = ''; } };
    if (r.entries.length) {
      if (r.entries.length > 1) {
        const select = el('select');
        r.entries.forEach((v, i) => {
          const label = v.synthetic ? v.word + ' — ghép từ nghĩa từng phần' : v.word + ' — ' + v.meaning.replace(/\n/g, '; ').slice(0, 90);
          const o = el('option', label); o.value = String(i); select.append(o);
        });
        select.onchange = () => { currentEntry = r.entries[Number(select.value)] || r.entries[0]; holder.replaceChildren(rows(currentEntry)); resetSave(); };
        out.push(select);
      }
      holder.append(rows(currentEntry));
      out.push(holder);
    } else {
      out.push(el('p', (r.machine ? 'Faztaa chưa có mục từ này.' : 'Chưa tìm thấy mục từ có nghĩa tiếng Anh.') + (r.candidates.length > 1 ? ' Thử bấm một dạng khác ở “Tra theo”.' : '')));
    }

    if (currentEntry) {
      saveButton = el('button', '＋ Thêm vào từ vựng', 'btn');
      saveButton.onclick = async () => {
        if (saving) return;
        const entry = currentEntry;
        saving = true; saveButton.disabled = true; saveButton.textContent = 'Đang lưu…'; msg.textContent = '';
        try {
          const ex = r.examples.slice(0, 3).map(e => [e.de, e.en ? 'EN: ' + e.en : '', e.vi ? 'VN: ' + e.vi : ''].filter(Boolean).join('\n')).join('\n\n');
          const result = await send({ type: 'saveWord', row: [entry.word, entry.ipa, entry.meaning, entry.synonyms, ex] });
          if (result.error) throw Error(result.error);
          if (id === seq && entry === currentEntry) {
            saveButton.textContent = result.duplicate ? 'Đã có trong từ vựng' : '✓ Đã thêm';
            msg.textContent = 'Tab ' + result.tabName + ' · dòng ' + result.rowNumber;
          }
        } catch (e) {
          if (id === seq) { msg.textContent = e.message; saveButton.disabled = false; saveButton.textContent = 'Thử lưu lại'; }
        } finally { saving = false; }
      };
      out.push(saveButton, msg);
    }

    const faztaaWord = r.compound ? r.compound.word : cand.word;
    const link = el('a', 'Mở “' + faztaaWord + '” trên Faztaa ↗');
    link.href = 'https://faztaa.com/search/word/' + encodeURIComponent(faztaaWord) + '?hl=en';
    link.target = '_blank'; link.rel = 'noopener noreferrer';
    out.push(el('div'), link);

    // Ví dụ
    const exampleWord = r.exampleWord || cand.word;
    out.push(el('h3', 'Ví dụ · ' + exampleWord));
    const box = el('div');
    const seen = new Set();
    const addExamples = list => {
      for (const ex of list) {
        const key = ex.id || ex.de; if (seen.has(key)) continue; seen.add(key);
        const a = el('article'); a.append(el('b', ex.de), speakButton({ text: ex.de }, 'câu ví dụ'), el('div', 'EN: ' + (ex.en || 'Chưa có bản dịch')), el('div', 'VN: ' + (ex.vi || 'Chưa có bản dịch')));
        box.append(a);
      }
    };
    addExamples(r.examples);
    if (!r.examples.length) box.append(el('p', 'Không có ví dụ.', 'muted'));
    out.push(box);
    for (const err of r.errors) out.push(el('p', err, 'warn'));
    const moreBtn = el('button', 'Xem thêm ví dụ', 'btn');
    moreBtn.hidden = !r.hasMore;
    let page = Math.max(1, r.examplePage || 1);
    moreBtn.onclick = async () => {
      moreBtn.disabled = true; moreBtn.textContent = 'Đang tải…';
      try {
        const rr = await send({ type: 'lookup', word: exampleWord, page: page + 1 });
        if (id !== seq) return;
        if (rr.disabled) { close(); return; }
        if (rr.error || rr.errors?.length) throw Error(rr.error || rr.errors.join(' · '));
        const more = (Array.isArray(rr.examples) ? rr.examples : []).filter(x => x && x.de).map(normExample);
        addExamples(more);
        // Ghi lại vào đối tượng đang hiện, để nút ← quay lại vẫn thấy các ví dụ đã tải.
        r.examples = [...r.examples, ...more]; page++; r.examplePage = page; r.hasMore = !!rr.hasMore;
        moreBtn.hidden = !rr.hasMore;
      } catch (e) { if (id === seq) box.append(el('p', e.message, 'warn')); }
      finally { moreBtn.disabled = false; moreBtn.textContent = 'Xem thêm ví dụ'; }
    };
    out.push(moreBtn);
    out.push(el('p', 'Mẹo: giữ Alt (⌥) và click một từ khác trong câu để ghép vào lần tra (vd tiểu từ “an”, “vor”).', 'muted'));
    main.replaceChildren(...out);
    main.scrollTop = 0;
  }

  // ---------- Bắt vùng chọn ----------
  // iframe nhỏ (khung chat, banner cookie…) không đủ chỗ cho popup → chuyển lên khung chính của tab.
  const frameTooSmall = () => !IS_TOP && (innerWidth < 420 || innerHeight < 320);
  async function openLookup(sel) {
    if (frameTooSmall()) {
      try {
        const r = await send({ type: 'relay', sel: { text: sel.text, context: sel.context, contextOffset: sel.contextOffset } });
        if (r.ok) { trigger.hidden = true; return; }
      } catch (e) { log('relay', e); }
    }
    startLookup(sel);
  }

  // path: e.composedPath() lấy NGAY trong lúc sự kiện đang phát. Sau đó (trong setTimeout) composedPath() trả về [],
  // nên trước đây click vào nút trong popup bị coi là click ngoài trang → hiện lại nút "Tra Faztaa",
  // và ở chế độ "bôi đen là tra ngay" thì tra lại vùng chọn cũ, làm mất bảng đang xem.
  async function onSelect(e, path) {
    path = path || [];
    if (path.includes(host)) return;
    const target = path[0] && path[0].nodeType === 1 ? path[0] : e.target;
    if (target?.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"])')) return;
    const s = window.getSelection();
    if (!s || !s.rangeCount) { trigger.hidden = true; return; }
    const range = selectedRange(s, path);
    const raw = range.collapsed ? s.toString() : range.toString();
    const value = stripInvisible(raw).normalize('NFC').trim().replace(/\s+/g, ' ')
      .replace(/^[“”„"'‘’‚.,;:!?()[\]{}«»‹›–—]+|[“”„"'‘’‚.,;:!?()[\]{}«»‹›–—]+$/g, '');
    if (!value || value.length > 120 || !/\p{L}/u.test(value)) { trigger.hidden = true; return; }
    // Chỉ xử lý lần chọn mới nhất: phản hồi "scope" của lần chọn cũ có thể về sau.
    const my = ++selSeq;
    const check = await send({ type: 'scope' }).catch(() => ({ allowed: false }));
    if (my !== selSeq || !check.allowed) return;
    if (check.prefs) setPrefs(check.prefs);
    const ctx = getContext(range);
    const r = range.getBoundingClientRect();
    // Vùng chọn không có kích thước (vd trong Shadow DOM trên trình duyệt cũ) → dùng vị trí con trỏ chuột.
    const rect = (r.width || r.height) ? { left: r.left, top: r.top, bottom: r.bottom }
      : Number.isFinite(e.clientX) ? { left: e.clientX, top: e.clientY, bottom: e.clientY } : null;
    pendingSel = { text: value, ...ctx, range: range.cloneRange(), rect };
    const immediate = e.altKey || prefs.lookupMode === 'auto' || (prefs.lookupMode === 'dblclick' && e.detail >= 2);
    if (immediate) { openLookup(pendingSel); return; }
    attachHost();
    trigger.hidden = false;
    trigger.style.left = clamp(rect ? rect.left : innerWidth - 140, 8, innerWidth - 120) + 'px';
    trigger.style.top = clamp(rect ? rect.bottom + 6 : 16, 8, innerHeight - 40) + 'px';
  }
  trigger.onclick = () => { if (pendingSel) openLookup(pendingSel); };
  // Bắt ở pha capture trên window: banner cookie/trang chat hay chặn mouseup (stopPropagation) ở pha nổi bọt.
  addEventListener('mouseup', e => {
    if (e.button !== 0) return;
    const path = e.composedPath();
    if (path.includes(host)) return;
    setTimeout(() => onSelect(e, path).catch(log), 20);
  }, true);
  addEventListener('keyup', e => { if (e.key === 'Shift') onSelect(e, e.composedPath()).catch(log); }, true);

  // Alt + click vào một từ khi popup đang mở → ghép từ đó vào lần tra (vd "rufe" + "an" → anrufen)
  document.addEventListener('click', e => {
    if (!e.altKey || panel.hidden || !current?.baseSel || e.composedPath().includes(host)) return;
    if (window.getSelection()?.toString().trim()) return;
    const w = wordAtPoint(e.clientX, e.clientY);
    const base = current.baseSel, extras = current.extras || [];
    if (!w || extras.length >= 3 || w.toLowerCase() === str(base.text).toLowerCase() || extras.includes(w)) return;
    e.preventDefault(); e.stopPropagation();
    startLookup(base, { extras: [...extras, w], keepPosition: true });
  }, true);

  // Tải sẵn cài đặt (kể cả cỡ popup đã lưu) cho khung chính.
  if (IS_TOP) send({ type: 'scope' }).then(c => { if (c.prefs) setPrefs(c.prefs); }).catch(() => {});

  // Khung chính nhận vùng chọn từ iframe nhỏ (qua service worker).
  if (IS_TOP) {
    chrome.runtime.onMessage.addListener((m, sender, reply) => {
      if (sender.id !== chrome.runtime.id || m?.type !== 'dl-show' || !m.sel || typeof m.sel.text !== 'string') return;
      startLookup({ text: m.sel.text, context: str(m.sel.context), contextOffset: Number.isInteger(m.sel.contextOffset) ? m.sel.contextOffset : -1, rect: null });
      reply({ ok: true });
    });
  }

  // Trang SPA đổi đường dẫn: chỉ đóng nếu trang mới không nằm trong phạm vi cho phép.
  let last = location.href;
  const timer = setInterval(async () => {
    if (!alive()) { clearInterval(timer); return; }
    if (last === location.href) return;
    last = location.href;
    if (panel.hidden && trigger.hidden) return;
    const check = await send({ type: 'scope' }).catch(() => ({ allowed: false }));
    if (!check.allowed) close();
  }, 500);
})();

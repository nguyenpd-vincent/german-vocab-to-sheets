// Deutsch Lens — service worker.
// Mọi lần gọi Faztaa đều ở đây (token không bao giờ tới content script).
importScripts('adapter.js', 'german.js');

const German = createGerman({ text: path => fetch(chrome.runtime.getURL(path)).then(r => r.ok ? r.text() : '') });
const API = 'https://api.faztaa.com/';
const wordPath = key => `api/search/en/devi/${key}?page=1&limit=20`;
const examplePath = (key, page) => `api/search/list/example/en/${key}?page=${page}&limit=10`;
const cache = new Map(), pending = new Map(), TTL = 15 * 60 * 1000, CACHE_MAX = 300;
const MAX_TRIES = 4; // số ứng viên tối đa gửi tới Faztaa cho một lần tra

// Token chỉ đọc được từ trang của extension và service worker, không từ content script.
// Gọi mỗi lần service worker khởi động (không chỉ lúc cài): nếu lần gọi trước thất bại thì vẫn được đặt lại.
async function lockStorage() {
  try { await chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' }); }
  catch (e) { console.warn('[Deutsch Lens] setAccessLevel:', e.message); }
}
lockStorage();

chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());
chrome.runtime.onInstalled.addListener(async () => {
  await lockStorage();
  // Dọn khóa của bản cũ có dùng AI (đã bỏ).
  await chrome.storage.local.remove(['aiUrl', 'aiKey', 'model']).catch(() => {});
});

// Trang của chính extension (Cài đặt). Trang Cài đặt mở trong tab nên sender.tab có giá trị —
// trước đây vì thế nó bị kiểm tra phạm vi như trang web và nút "Kiểm tra Faztaa" báo thành công giả.
const isExtensionPage = sender => sender.id === chrome.runtime.id && String(sender.url || '').startsWith(chrome.runtime.getURL(''));

// URL dùng để xét phạm vi: với iframe thì xét trang chính chứa nó (người dùng đang ở trang đó).
const pageUrl = sender => (sender.frameId && sender.tab?.url) ? sender.tab.url : (sender.url || sender.tab?.url || '');

function allowed(s, url) {
  if (!s.scope || s.scope === 'all') return true;
  try {
    const a = new URL(url), b = new URL(s.scopeUrl);
    if (s.scope === 'site') return a.origin === b.origin;
    return a.origin === b.origin && a.pathname.replace(/\/$/, '') === b.pathname.replace(/\/$/, '');
  } catch { return false; }
}

// ---------- Gọi Faztaa (cache + gộp các yêu cầu giống nhau đang chạy) ----------
class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }

function httpMessage(status) {
  if (status === 401 || status === 403) return 'Faztaa từ chối truy cập (HTTP ' + status + '). Kiểm tra token.';
  if (status === 429) return 'Tra cứu quá nhanh. Hãy thử lại sau.';
  return 'Faztaa HTTP ' + status;
}

async function getJSON(path, token) {
  const key = token + '|' + path;
  const c = cache.get(key);
  if (c && Date.now() - c.time < TTL) {
    // Đưa lên cuối để cache hoạt động kiểu LRU.
    cache.delete(key); cache.set(key, c);
    return c.value;
  }
  if (c) cache.delete(key);
  if (pending.has(key)) return pending.get(key);
  const promise = (async () => {
    let r;
    try {
      r = await fetch(API + path, { headers: { accept: 'application/json', authorization: token }, credentials: 'omit', signal: AbortSignal.timeout(20000) });
    } catch (e) {
      throw Error(e.name === 'TimeoutError' ? 'Faztaa không phản hồi sau 20 giây.' : 'Không kết nối được Faztaa (kiểm tra mạng).');
    }
    if (!r.ok) throw new HttpError(r.status, httpMessage(r.status));
    let v;
    try { v = await r.json(); } catch { throw Error('Faztaa trả về dữ liệu không đọc được.'); }
    while (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
    cache.set(key, { time: Date.now(), value: v });
    return v;
  })();
  pending.set(key, promise);
  try { return await promise; } finally { pending.delete(key); }
}

// Lỗi "chết" (token sai, bị chặn tần suất, mất mạng): dừng thử các ứng viên khác.
const isFatal = e => !(e instanceof HttpError) || [401, 403, 429].includes(e.status) || e.status >= 500;

const bare = w => String(w || '').replace(/^(der|die|das|sich)\s+/i, '').trim();

// Tra mục từ. exact = Faztaa có đúng từ này (không chỉ kết quả gần giống).
async function dictLookup(word, token) {
  let raw;
  try { raw = await getJSON(wordPath(encodeURIComponent(word)), token); }
  catch (e) { if (e.status === 404) return { exact: false, entries: [] }; throw e; }
  if (!raw || !Array.isArray(raw.result)) throw Error('Tra từ: định dạng phản hồi đã thay đổi.');
  const target = bare(word);
  const valid = raw.result.filter(x => x && typeof x.word === 'string' && Array.isArray(x.content));
  // 2 = trùng cả hoa/thường (Laden = danh từ), 1 = chỉ trùng khi bỏ qua hoa/thường (laden = động từ), 0 = gần giống.
  const rank = x => bare(x.word) === target ? 2 : bare(x.word).toLowerCase() === target.toLowerCase() ? 1 : 0;
  const ranked = valid.map((x, i) => ({ x, i, r: rank(x) })).sort((a, b) => b.r - a.r || a.i - b.i);
  const entries = [];
  let exactCount = 0;
  for (const { x, r } of ranked) {
    try { entries.push(normalizeEntry(x)); if (r) exactCount++; } catch (e) { console.warn('[Deutsch Lens] bỏ mục lỗi', e); }
  }
  return { exact: exactCount > 0, exactCount, entries };
}

async function exampleLookup(word, page, token) {
  let v;
  try { v = await getJSON(examplePath(encodeURIComponent(word), page), token); }
  catch (e) { if (e.status === 404) return { hasMore: false, examples: [] }; throw e; }
  if (!Array.isArray(v)) throw Error('Ví dụ: định dạng phản hồi đã thay đổi.');
  return {
    hasMore: v.length === 10 && page < 100,
    examples: v.filter(x => x && typeof x.e === 'string').map(x => ({ id: x._id || x.id || '', de: clean(x.e), en: clean(x.m?.en), vi: clean(x.m?.vi) }))
  };
}

const firstMeaning = e => (e?.meaning || '').split('\n').slice(0, 2).join('; ');

// Câu chứa từ: nội dung trang chỉ dùng trong extension, không bao giờ gửi cho Faztaa.
function sentenceOf(m) {
  if (typeof m.context === 'string' && Number.isInteger(m.contextOffset)) return German.sentenceAt(m.context.slice(0, 2000), m.contextOffset);
  const sentence = typeof m.sentence === 'string' ? m.sentence.slice(0, 600) : '';
  return { sentence, offset: Number.isInteger(m.offset) ? m.offset : -1 };
}

// Tra một từ cụ thể (dùng cho chip, "Xem thêm ví dụ", nút Kiểm tra trong Cài đặt).
async function lookup(word, page, s, sentence) {
  if (!s.token) return { error: 'Chưa có token Faztaa. Mở Cài đặt để nhập token.', needsSettings: true };
  const [dict, ex] = await Promise.allSettled([
    page === 1 ? dictLookup(word, s.token) : Promise.resolve(null),
    exampleLookup(word, page, s.token)
  ]);
  const errors = [];
  let entries = [], exact = false;
  if (dict.status === 'fulfilled' && dict.value) ({ entries, exact } = dict.value);
  else if (dict.status === 'rejected') errors.push('Tra từ: ' + dict.reason.message);
  let examples = [], hasMore = false;
  if (ex.status === 'fulfilled') ({ examples, hasMore } = ex.value); else errors.push('Ví dụ: ' + ex.reason.message);
  return { word, entries, exact, examples, hasMore, errors, prep: German.prepFor(word, typeof sentence === 'string' ? sentence : '') };
}

// Phân tích vùng chọn → thử từng ứng viên với Faztaa → nếu không có thì tách từ ghép.
async function analyzeLookup(m, s) {
  if (!s.token) return { error: 'Chưa có token Faztaa. Bấm “Mở Cài đặt” để nhập token (cài extension mới thì phải nhập lại).', needsSettings: true };
  const { sentence, offset } = sentenceOf(m);
  const errors = [];
  let a;
  try { a = await German.analyze({ text: m.word, sentence, offset }); }
  catch (e) { a = { candidates: [], separable: null }; errors.push('Phân tích tiếng Đức lỗi (' + e.message + '); đang tra nguyên dạng.'); }
  const candidates = (a.candidates || []).filter(c => c && typeof c.word === 'string' && c.word).slice(0, 6);
  if (!candidates.length) candidates.push({ word: m.word, kind: 'surface', label: m.word });
  let chosen = -1, dict = null, fuzzy = null, fatal = false;
  for (let i = 0; i < Math.min(MAX_TRIES, candidates.length); i++) {
    try {
      const r = await dictLookup(candidates[i].word, s.token);
      candidates[i].found = r.exact;
      if (r.exact) { chosen = i; dict = r; break; }
      if (!fuzzy && r.entries.length) fuzzy = { i, r };
    } catch (e) {
      errors.push('Tra từ “' + candidates[i].word + '”: ' + e.message);
      // Trước đây mọi lỗi đều dừng vòng lặp và tắt luôn bước tách từ ghép; nay chỉ dừng với lỗi token/mạng.
      if (isFatal(e)) { fatal = true; break; }
    }
  }

  let compound = null, note = '';
  if (chosen < 0 && !fatal) {
    const base = (candidates.find(c => c.kind === 'lemma') || candidates.find(c => c.kind === 'surface') || {}).word || m.word;
    const split = await German.splitCompound(base).catch(() => null);
    if (split) {
      const allParts = await Promise.all(split.parts.map(async p => {
        try {
          const r = await dictLookup(p.lemma, s.token);
          // Chỉ dùng nghĩa khi Faztaa có ĐÚNG phần đó; trước đây lấy entries[0] kể cả khi đó là một từ khác (kết quả gần giống).
          const exactEntries = r.entries.slice(0, r.exactCount || 0);
          return { ...p, found: r.exact, entry: exactEntries[0] || null, entries: exactEntries };
        } catch { return { ...p, found: false, entry: null, entries: [] }; }
      }));
      // Không phần nào có trên Faztaa → bỏ qua, không dựng mục "ghép" toàn "chưa có trên Faztaa".
      const parts = allParts.some(p => p.found) ? allParts : null;
      if (parts) {
        const head = parts[parts.length - 1];
        const article = (String(head.entry?.word || '').match(/^(der|die|das)\s/) || [])[1] || '';
        compound = { word: split.word, article, parts: parts.map(({ entries, ...p }) => ({ ...p, meaning: firstMeaning(p.entry) })) };
        // Mục "ghép" do extension tự lắp từ nghĩa của từng phần — ghi rõ để không nhầm với mục từ thật của Faztaa.
        const synthetic = {
          synthetic: true,
          word: (article ? article + ' ' : '') + split.word,
          ipa: '',
          meaning: parts.map(p => p.lemma + ': ' + (firstMeaning(p.entry) || 'chưa có trên Faztaa')).join('\n'),
          pos: head.entry?.pos || '',
          forms: '', synonyms: '',
          family: 'Ghép từ: ' + parts.map(p => p.lemma).join(' + ')
        };
        dict = { exact: false, entries: [synthetic, ...head.entries] };
        if (!candidates.some(c => c.word === split.word)) candidates.push({ word: split.word, kind: 'surface', label: split.word });
        chosen = candidates.findIndex(c => c.word === split.word);
      }
    }
  }
  if (chosen < 0 && fuzzy) { chosen = fuzzy.i; dict = fuzzy.r; note = 'Faztaa không có đúng từ này; đang hiện kết quả gần nhất.'; }
  if (chosen < 0) chosen = 0;
  const word = candidates[chosen]?.word || m.word;

  let examples = [], hasMore = false, exampleWord = word;
  if (!fatal) {
    try {
      ({ examples, hasMore } = await exampleLookup(word, 1, s.token));
      if (!examples.length && compound) {
        exampleWord = compound.parts[compound.parts.length - 1].lemma;
        ({ examples, hasMore } = await exampleLookup(exampleWord, 1, s.token));
      }
    } catch (e) { errors.push('Ví dụ: ' + e.message); }
  }

  // Dịch máy Google: chỉ khi người dùng bật trong Cài đặt VÀ Faztaa không có đúng mục từ.
  // Chỉ gửi đúng từ/cụm đã chọn (như faztaa.com làm ở mục "Auto translate"), không gửi câu.
  let machine = null;
  if (s.googleFallback && !dict?.exact) {
    try { machine = await googleTranslate(m.word); }
    catch (e) { errors.push('Google Dịch: ' + e.message); }
  }

  return {
    query: m.word, sentence, candidates, chosen, separable: a.separable || null, compound, note,
    entries: dict?.entries || [], exact: !!dict?.exact, examples, hasMore, exampleWord, errors,
    prep: German.prepFor(word, sentence), machine
  };
}

// ---------- Google Dịch (dự phòng, TẮT mặc định) ----------
// Endpoint không chính thức mà faztaa.com dùng cho "Auto translate": có thể bị giới hạn hoặc thay đổi bất kỳ lúc nào.
// Trả về { word, en, vi, dict:[{pos, terms}] } — chỉ lấy các trường cần: sentences[].trans, dict[].pos, dict[].terms.
const GT = 'https://translate.googleapis.com/translate_a/single';
async function gtFetch(word, tl) {
  const key = 'gt|' + tl + '|' + word;
  const c = cache.get(key);
  if (c && Date.now() - c.time < TTL) return c.value;
  const params = new URLSearchParams({ client: 'gtx', sl: 'de', tl, dj: '1', q: word });
  params.append('dt', 't');
  if (tl === 'en') params.append('dt', 'bd'); // nghĩa theo từ loại (chỉ có với từ có trong từ điển của Google)
  let r;
  try { r = await fetch(GT + '?' + params, { credentials: 'omit', signal: AbortSignal.timeout(10000) }); }
  catch (e) { throw Error(e.name === 'TimeoutError' ? 'không phản hồi.' : 'không kết nối được.'); }
  if (!r.ok) throw Error(r.status === 429 ? 'bị giới hạn tần suất, thử lại sau.' : 'HTTP ' + r.status);
  let v;
  try { v = await r.json(); } catch { throw Error('dữ liệu không đọc được.'); }
  const text = (Array.isArray(v?.sentences) ? v.sentences : []).map(x => typeof x?.trans === 'string' ? x.trans : '').join('').trim();
  const dict = (Array.isArray(v?.dict) ? v.dict : [])
    .map(d => ({ pos: typeof d?.pos === 'string' ? d.pos : '', terms: (Array.isArray(d?.terms) ? d.terms : []).filter(t => typeof t === 'string').slice(0, 8) }))
    .filter(d => d.terms.length);
  const value = { text, dict };
  while (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
  cache.set(key, { time: Date.now(), value });
  return value;
}
async function googleTranslate(word) {
  const [en, vi] = await Promise.allSettled([gtFetch(word, 'en'), gtFetch(word, 'vi')]);
  if (en.status === 'rejected' && vi.status === 'rejected') throw en.reason;
  const E = en.status === 'fulfilled' ? en.value : { text: '', dict: [] };
  const V = vi.status === 'fulfilled' ? vi.value : { text: '' };
  // Google trả lại nguyên từ khi không dịch được → coi như không có kết quả.
  const same = t => !t || t.toLowerCase() === word.toLowerCase();
  if (same(E.text) && same(V.text) && !E.dict.length) return null;
  return { source: 'Google Dịch', word, en: same(E.text) ? '' : E.text, vi: same(V.text) ? '' : V.text, dict: E.dict };
}

const clampNum = (v, lo, hi) => Math.max(lo, Math.min(v, hi));
const PREF_DEFAULTS = { lookupMode: 'button', closeOnOutside: false };

chrome.runtime.onMessage.addListener((m, sender, reply) => {
  (async () => {
    if (!m || typeof m.type !== 'string') return { error: 'Yêu cầu không hợp lệ.' };
    const s = await chrome.storage.local.get(['token', 'scope', 'scopeUrl', 'lookupMode', 'closeOnOutside', 'popupSize', 'googleFallback']);
    const ext = isExtensionPage(sender);
    const ok = ext || allowed(s, pageUrl(sender));
    if (m.type === 'settings') { await chrome.runtime.openOptionsPage(); return { ok: true }; }
    if (m.type === 'scope') return {
      allowed: ok,
      prefs: { lookupMode: s.lookupMode || PREF_DEFAULTS.lookupMode, closeOnOutside: s.closeOnOutside ?? PREF_DEFAULTS.closeOnOutside, popupSize: s.popupSize || null }
    };
    // Cỡ popup người dùng kéo (null = trở về tự động). Chỉ nhận số hợp lý.
    if (m.type === 'saveSize') {
      const z = m.size;
      if (z === null) { await chrome.storage.local.remove('popupSize'); return { ok: true }; }
      if (!z || !Number.isFinite(z.w) || !Number.isFinite(z.h)) return { error: 'Kích thước không hợp lệ.' };
      await chrome.storage.local.set({ popupSize: { w: Math.round(clampNum(z.w, 280, 4000)), h: Math.round(clampNum(z.h, 160, 4000)) } });
      return { ok: true };
    }
    // Chỉ trang Cài đặt được kiểm tra Sheets / xóa cache.
    if (m.type === 'sheetsTest') { if (!ext) throw Error('Không được phép.'); return sheetRequest('test'); }
    if (m.type === 'clear') { if (!ext) throw Error('Không được phép.'); cache.clear(); return { ok: true }; }
    if (m.type === 'saveWord') {
      if (!sender.tab || !ok) throw Error('Trang này không được bật tra từ.');
      return sheetRequest('append', m.row);
    }
    // iframe nhỏ chuyển vùng chọn lên khung chính của tab để hiện popup đủ chỗ.
    if (m.type === 'relay') {
      if (!sender.tab || !sender.frameId || !ok) return { ok: false };
      await chrome.tabs.sendMessage(sender.tab.id, { type: 'dl-show', sel: m.sel }, { frameId: 0 });
      return { ok: true };
    }
    if (m.type !== 'lookup' && m.type !== 'analyze') return { error: 'Yêu cầu không hợp lệ.' };
    if (!ok) return { disabled: true };
    if (typeof m.word !== 'string' || !m.word.trim() || m.word.length > 120) return { error: 'Chọn từ/cụm từ tối đa 120 ký tự.' };
    if (m.type === 'analyze') return analyzeLookup({ ...m, word: m.word.trim() }, s);
    if (!Number.isInteger(m.page) || m.page < 1 || m.page > 100) return { error: 'Trang không hợp lệ.' };
    return lookup(m.word.trim(), m.page, s, m.sentence);
  })().then(reply, e => reply({ error: e?.message || String(e) }));
  return true;
});

// ---------- Google Sheets (qua Apps Script Web App) ----------
const SHEETS_ORIGINS = ['https://script.google.com/*', 'https://script.googleusercontent.com/*'];

async function sheetRequest(action, row) {
  const s = await chrome.storage.local.get(['sheetsEndpoint', 'sheetsSecret', 'sheetsUrl']);
  if (!s.sheetsEndpoint || !s.sheetsSecret || !s.sheetsUrl) throw Error('Chưa kết nối Sheets. Mở ⚙, điền cấu hình rồi Lưu.');

  let u, target;
  try { u = new URL(s.sheetsEndpoint); target = new URL(s.sheetsUrl); } catch { throw Error('URL trong cấu hình Sheets không hợp lệ.'); }
  if (u.origin !== 'https://script.google.com' || !/^\/macros\/s\/[^/]+\/exec$/.test(u.pathname) || u.search) throw Error('Web App URL không hợp lệ.');

  const match = target.pathname.match(/^\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  const gid = new URLSearchParams(target.hash.slice(1)).get('gid') || target.searchParams.get('gid');
  if (target.origin !== 'https://docs.google.com' || !match || gid === null || !/^\d+$/.test(gid)) throw Error('Link sheet cần có ID file và gid của tab đích.');

  if (action === 'append' && (!Array.isArray(row) || row.length !== 5 || row.some(v => typeof v !== 'string' || v.length > 12000) || !row[0].trim())) {
    throw Error('Dòng từ vựng không hợp lệ.');
  }
  if (!await chrome.permissions.contains({ origins: SHEETS_ORIGINS })) throw Error('Lưu cấu hình để cấp quyền Google Sheets.');

  let data;
  try {
    const r = await fetch(u.href, {
      method: 'POST', credentials: 'omit', redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, secret: s.sheetsSecret, spreadsheetId: match[1], sheetId: Number(gid), row }),
      signal: AbortSignal.timeout(25000)
    });
    if (!r.ok) throw Error('HTTP ' + r.status);
    data = await r.json();
  } catch {
    throw Error('Chưa xác nhận được kết quả từ Sheets. Kiểm tra tab rồi thử lại; từ trùng sẽ không được thêm lần nữa.');
  }
  if (!data || !data.ok) throw Error(typeof data?.error === 'string' ? data.error : 'Không lưu được vào Sheets.');
  return { ok: true, duplicate: !!data.duplicate, tabName: String(data.tabName || ''), rowNumber: data.rowNumber };
}

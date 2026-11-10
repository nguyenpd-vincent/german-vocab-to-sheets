// Trang Cài đặt Deutsch Lens.
const keys = ['token', 'scope', 'scopeUrl', 'sheetsEndpoint', 'sheetsSecret', 'sheetsUrl', 'lookupMode'];
const defaults = { scope: 'all', lookupMode: 'button' };
const SHEETS_ORIGINS = ['https://script.google.com/*', 'https://script.googleusercontent.com/*'];
const $ = id => document.getElementById(id);
const status = $('status');

const GT_ORIGINS = ['https://translate.googleapis.com/*'];
chrome.storage.local.get([...keys, 'closeOnOutside', 'googleFallback']).then(s => {
  $('googleFallback').checked = !!s.googleFallback;
  keys.forEach(k => { $(k).value = s[k] || defaults[k] || ''; });
  $('closeOnOutside').checked = !!s.closeOnOutside;
});

const parseUrl = (v, msg) => { try { return new URL(v); } catch { throw Error(msg); } };

document.querySelector('form').onsubmit = async e => {
  e.preventDefault();
  try {
    const s = Object.fromEntries(keys.map(k => [k, $(k).value.trim()]));
    // Người dùng hay dán cả "authorization: xxx" hoặc "Bearer xxx" — chỉ giữ giá trị token.
    s.token = s.token.replace(/^authorization\s*:\s*/i, '').trim();
    if (s.scope !== 'all') {
      const u = parseUrl(s.scopeUrl, 'Nhập URL website hoặc cuộc chat (bắt đầu bằng https://).');
      if (!['https:', 'http:'].includes(u.protocol)) throw Error('URL không hợp lệ.');
    }
    s.googleFallback = $('googleFallback').checked;
    if (s.sheetsEndpoint) {
      const u = parseUrl(s.sheetsEndpoint, 'Web App URL không hợp lệ.');
      if (u.origin !== 'https://script.google.com' || !/^\/macros\/s\/[^/]+\/exec$/.test(u.pathname) || u.search) throw Error('Dùng đúng Web App URL /exec.');
    }
    // Xin quyền trong MỘT lần gọi, ngay trong cú bấm (chỉ được xin khi người dùng vừa thao tác; gọi hai lần thì lần sau có thể bị từ chối).
    const origins = [...(s.sheetsEndpoint ? SHEETS_ORIGINS : []), ...(s.googleFallback ? GT_ORIGINS : [])];
    if (origins.length) {
      const granted = await chrome.permissions.request({ origins }).catch(() => false);
      // Google Dịch vẫn chạy khi bị từ chối (Google cho phép gọi chéo nguồn); Sheets thì bắt buộc phải có quyền.
      if (!granted && s.sheetsEndpoint && !await chrome.permissions.contains({ origins: SHEETS_ORIGINS })) throw Error('Chưa cấp quyền kết nối Sheets.');
    }
    if (s.sheetsUrl && !/^https:\/\/docs\.google\.com\/spreadsheets\/d\/[a-zA-Z0-9_-]+\//.test(s.sheetsUrl)) throw Error('Link Google Sheets không hợp lệ.');
    s.closeOnOutside = $('closeOnOutside').checked;
    await chrome.storage.local.set(s);
    $('token').value = s.token;
    await chrome.storage.local.remove(['aiUrl', 'aiKey', 'model']);
    await chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' }).catch(() => {});
    status.textContent = 'Đã lưu.';
  } catch (err) { status.textContent = err.message; }
};

$('test').onclick = async () => {
  status.textContent = 'Đang kiểm tra…';
  try {
    const r = await chrome.runtime.sendMessage({ type: 'lookup', word: 'Wert', page: 1 });
    // Trước đây chỉ xét r.errors → phản hồi {error} hoặc {disabled} vẫn báo "thành công".
    if (!r) throw Error('Không nhận được phản hồi.');
    if (r.error) throw Error(r.error);
    if (r.errors?.length) throw Error(r.errors.join(' · '));
    if (!r.entries?.length) throw Error('Kết nối được nhưng Faztaa không trả về mục từ nào cho “Wert”.');
    status.textContent = 'Kết nối thành công: ' + r.entries[0].word + ' — ' + r.entries[0].meaning.split('\n')[0];
  } catch (err) { status.textContent = err.message; }
};

$('clear').onclick = async () => {
  try {
    const r = await chrome.runtime.sendMessage({ type: 'clear' });
    status.textContent = r?.ok ? 'Đã xóa bộ nhớ đệm.' : (r?.error || 'Không xóa được.');
  } catch (err) { status.textContent = err.message; }
};

$('testSheets').onclick = async () => {
  status.textContent = 'Đang kiểm tra (không ghi dữ liệu)…';
  try {
    const r = await chrome.runtime.sendMessage({ type: 'sheetsTest' });
    if (r.error) throw Error(r.error);
    status.textContent = 'Đã kết nối tab: ' + r.tabName + '. Chỉ lưu từ khi bạn bấm Thêm vào từ vựng.';
  } catch (err) { status.textContent = err.message + ' — hãy Lưu cấu hình trước.'; }
};

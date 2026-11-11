// Trang ẩn phát âm thanh. Chỉ nhận lệnh từ service worker (target: 'offscreen').
// Lệnh 'play' trả lời khi phát xong ({ok:true}), khi bị dừng ({stopped:true}) hoặc khi lỗi ({ok:false, error}).
// Không có file (404) → lỗi → service worker chuyển sang giọng đọc của máy.

let audio = null;
let finish = null; // hàm trả lời cho lệnh 'play' đang chạy

const ALLOWED = /^https:\/\/data\.faztaa\.com\/audios\/\d+\/[0-9a-f]{32}\.mp3$/;
const MAX_MS = 20000; // một từ không dài hơn 20 giây

function stop() {
  if (audio) { audio.pause(); audio.removeAttribute('src'); audio.load(); audio = null; }
  if (finish) { const f = finish; finish = null; f({ stopped: true }); }
}

chrome.runtime.onMessage.addListener((m, sender, reply) => {
  // Bỏ qua tin nhắn không dành cho trang này (vd tin của content script gửi service worker).
  if (!m || m.target !== 'offscreen' || sender.id !== chrome.runtime.id) return false;
  if (m.type === 'stop') { stop(); reply({ ok: true }); return false; }
  if (m.type !== 'play' || !ALLOWED.test(m.url || '')) { reply({ ok: false, error: 'Lệnh không hợp lệ.' }); return false; }

  stop(); // lệnh mới thay lệnh cũ
  const a = audio = new Audio();
  let timer = 0;
  const done = result => {
    if (finish !== done) return;
    finish = null; clearTimeout(timer);
    if (audio === a) audio = null;
    reply(result);
  };
  finish = done;
  timer = setTimeout(() => { a.pause(); done({ ok: false, error: 'Hết giờ phát.' }); }, MAX_MS);
  a.onended = () => done({ ok: true });
  a.onerror = () => done({ ok: false, error: 'Không có file phát âm.' });
  a.src = m.url;
  a.play().catch(e => done({ ok: false, error: e?.message || 'Không phát được.' }));
  return true; // trả lời bất đồng bộ
});

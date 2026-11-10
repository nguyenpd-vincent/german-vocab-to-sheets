// Chuyển dữ liệu thô của Faztaa về dạng gọn cho popup. Dùng trong service worker (importScripts) và Node (test).

// Bỏ thẻ HTML và ký hiệu định dạng trong chuỗi của Faztaa.
const clean = v => typeof v === 'string'
  ? v.replace(/<[^>]*>/g, '').replace(/##/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim()
  : '';

// Lấy mọi chuỗi trong một giá trị có thể là chuỗi hoặc mảng lồng nhau.
function strings(v) {
  if (typeof v === 'string') return [clean(v)].filter(Boolean);
  if (Array.isArray(v)) return v.flatMap(strings);
  return [];
}
const arr = v => Array.isArray(v) ? v : [];

// Một mục từ thô → { word, ipa, meaning, pos, forms, synonyms, family }. Trường thiếu → chuỗi rỗng, không ném lỗi.
function normalizeEntry(x) {
  x = x && typeof x === 'object' ? x : {};
  const content = arr(x.content).filter(c => c && typeof c === 'object');
  const kinds = [...new Set(content.filter(c => !c.field).map(c => clean(c.kind)).filter(Boolean))];
  const defs = content
    .filter(c => !c.field || c.field === 'deen')
    .flatMap(c => arr(c.means).map(m => [clean(c.kind), clean(m?.mean)].filter(Boolean).join(': ')))
    .filter(Boolean);
  const synonyms = arr(x.snym).flatMap(g => arr(g?.content).flatMap(v => strings(v?.syno)));
  const family = arr(x.word_family).flatMap(g => strings(g?.content).map(w => (g.field === 'related' ? 'Từ liên quan: ' : '') + w));
  const conjugation = x.conjugation && typeof x.conjugation === 'object' ? x.conjugation : {};
  const forms = Object.entries(conjugation)
    .filter(([k]) => k !== 'gt')
    .flatMap(([k, v]) => {
      const w = typeof v === 'string' ? v : v?.w;
      return typeof w === 'string' && clean(w) ? [k + ': ' + clean(w)] : [];
    });
  return {
    word: [clean(conjugation.gt?.w), clean(x.word)].filter(Boolean).join(' '),
    ipa: clean(x.pronounce?.de),
    meaning: [...new Set(defs)].join('\n'),
    pos: kinds.join(' / '),
    forms: forms.join('\n'),
    synonyms: [...new Set(synonyms)].join(', '),
    family: [...new Set(family)].join('\n')
  };
}

if (typeof module !== 'undefined') module.exports = { clean, normalizeEntry };

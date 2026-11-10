// Kiểm tra bộ phân tích tiếng Đức trong Node: node test/german.test.js
const fs = require('fs'), path = require('path');
const { createGerman } = require('../german.js');
const G = createGerman({ text: p => fs.promises.readFile(path.join(__dirname, '..', p), 'utf8') });

const cases = [];
const t = (name, fn) => cases.push({ name, fn });
const eq = (a, b, msg) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw Error((msg || '') + ' mong đợi ' + JSON.stringify(b) + ', nhận ' + JSON.stringify(a)); };
async function first(text, sentence, word) {
  const offset = sentence ? sentence.indexOf(word || text) : -1;
  const r = await G.analyze({ text, sentence: sentence || '', offset });
  return r;
}
module.exports = { G, t, eq, first, cases };

if (require.main === module) {
  require('./german.cases.js');
  (async () => {
    let fail = 0;
    for (const c of cases) {
      try { await c.fn(); console.log('✓', c.name); }
      catch (e) { fail++; console.log('✗', c.name, '—', e.message); }
    }
    console.log(fail ? fail + ' lỗi' : 'Tất cả đạt (' + cases.length + ')');
    process.exit(fail ? 1 : 0);
  })();
}

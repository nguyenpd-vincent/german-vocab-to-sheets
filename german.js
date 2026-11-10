// Deutsch Lens — bộ phân tích tiếng Đức (chạy hoàn toàn trong extension, không gọi mạng).
// - lemma: dạng chia → từ gốc (dữ liệu data/lex/*.txt, nguồn simplemma/Wiktionary)
// - động từ tách: "rufe … an" → anrufen
// - từ ghép: Blogbeitrag → Blog + Beitrag
// - động từ đi với giới từ: warten auf + Akk
(function (global) {
  'use strict';

  const PARTICLES = new Set(('ab an auf aus bei dabei dar daran darauf durch ein empor entgegen entlang fern fest fort frei ' +
    'gegenüber heim her herab heran herauf heraus herbei herein herüber herum herunter hervor hin hinab hinauf hinaus hinein ' +
    'hinterher hinüber hinunter hinzu hoch kaputt kennen klar los mit nach nieder offen statt teil um voran voraus vorbei ' +
    'vor vorüber vorweg weg weiter wieder zu zurecht zurück zusammen zwischen über unter durch wider fertig bereit näher ' +
    'spazieren stand bekannt sicher schwer leicht gut übrig').split(/\s+/));
  // Tiểu từ "yếu": thường chỉ là tính từ/trạng từ đứng cuối câu ("Er macht das gut", "Das ist klar").
  // Vẫn gợi ý động từ tách (gutmachen) nhưng xếp SAU động từ gốc (machen), và ghi là "có thể".
  const WEAK_PARTICLES = new Set('gut schwer leicht sicher frei offen näher bekannt kaputt fertig bereit übrig klar'.split(' '));

  // Liên từ / ranh giới mệnh đề: tiểu từ của động từ tách không vượt qua các từ này.
  const CLAUSE_WORDS = new Set(('und oder aber denn sondern weil dass daß ob wenn als obwohl obgleich während bevor ehe ' +
    'nachdem damit sodass seit seitdem bis sobald solange falls indem wie wo wohin woher warum weshalb der die das ' +
    'welcher welche welches').split(/\s+/));
  // "der/die/das" chỉ là ranh giới khi đứng ngay sau dấu phẩy (mệnh đề quan hệ) — xử lý bằng dấu câu, nên bỏ khỏi tập dùng chung.
  ['der', 'die', 'das', 'welcher', 'welche', 'welches', 'wie', 'wo', 'bis', 'als'].forEach(w => CLAUSE_WORDS.delete(w));

  const CONTRACTIONS = { am: 'an', ans: 'an', im: 'in', ins: 'in', zum: 'zu', zur: 'zu', beim: 'bei', vom: 'von', aufs: 'auf',
    fürs: 'für', ums: 'um', übers: 'über', unters: 'unter', vors: 'vor', hinters: 'hinter', durchs: 'durch' };
  const PREPS = ['an', 'auf', 'aus', 'bei', 'durch', 'für', 'gegen', 'in', 'mit', 'nach', 'über', 'um', 'unter', 'von', 'vor', 'zu', 'zwischen', 'als'];

  // Động từ + giới từ thường gặp. A = Akkusativ, D = Dativ. "sich" = phản thân.
  const PREP_VERBS_SRC = `abhängen von D; achten auf A; anfangen mit D; ankommen auf A; antworten auf A; sich ärgern über A;
aufhören mit D; aufpassen auf A; sich bedanken bei D, für A; beginnen mit D; sich beklagen über A; sich bemühen um A;
berichten über A, von D; sich beschäftigen mit D; sich beschweren bei D, über A; bestehen aus D, auf D; sich beteiligen an D;
sich bewerben um A, bei D; sich beziehen auf A; bitten um A; danken für A; denken an A, über A; diskutieren über A, mit D;
sich eignen für A; sich einigen auf A; einladen zu D; sich entscheiden für A, gegen A; sich entschließen zu D;
sich entschuldigen bei D, für A; sich erholen von D; sich erinnern an A; erkennen an D; sich erkundigen nach D, bei D;
erzählen von D, über A; fragen nach D; sich freuen auf A, über A; führen zu D; sich fürchten vor D; gehören zu D;
gehen um A; sich gewöhnen an A; glauben an A; gratulieren zu D; halten für A, von D; handeln von D, mit D; helfen bei D;
hoffen auf A; hören von D, auf A; sich informieren über A; sich interessieren für A; kämpfen für A, gegen A, um A;
sich konzentrieren auf A; sich kümmern um A; lachen über A; leiden an D, unter D; nachdenken über A; protestieren gegen A;
rechnen mit D; reden über A, mit D; riechen nach D; schmecken nach D; schreiben an A, über A; sich schämen für A;
sich sehnen nach D; sorgen für A; sich sorgen um A; sprechen mit D, über A, von D; sterben an D; streiten mit D, über A;
suchen nach D; teilnehmen an D; telefonieren mit D; träumen von D; sich treffen mit D; überzeugen von D;
sich unterhalten mit D, über A; sich verabreden mit D; sich verlassen auf A; sich verlieben in A; sich vorbereiten auf A;
warnen vor D; warten auf A; sich wenden an A; wissen von D, über A; sich wundern über A; zweifeln an D; zählen zu D, auf A;
sich entwickeln zu D; ausgehen von D; beitragen zu D; dienen zu D, als N; hinweisen auf A; neigen zu D; passen zu D;
reagieren auf A; sich richten nach D; schützen vor D; sich spezialisieren auf A; stimmen für A, gegen A; verfügen über A;
verzichten auf A; wählen zwischen D; werden zu D; zwingen zu D; sich anpassen an A; sich anmelden für A, bei D, zu D;
ausgeben für A; sich auskennen mit D; basieren auf D; sich befassen mit D; beruhen auf D; bezeichnen als A; fliehen vor D;
garantieren für A; sich halten an A; investieren in A; klagen über A; motivieren zu D; profitieren von D; schließen aus D, auf A;
trennen von D; umgehen mit D; sich unterscheiden von D, in D; verbinden mit D; sich verabschieden von D; vergleichen mit D;
sich wehren gegen A; zurückführen auf A; arbeiten an D, bei D; sich aufregen über A; sich bedanken für A; sich engagieren für A;
erfahren von D; sich freuen mit D; sich gewöhnen an A; sich verstehen mit D; sich verlassen auf A; verstehen von D; abraten von D;
sich anstrengen für A; aufpassen auf A; sich bewähren als N; einsetzen für A; sich ergeben aus D; experimentieren mit D;
fehlen an D; sich handeln um A; liegen an D; mitwirken an D; sich orientieren an D; sich richten an A; sparen für A, an D;
verwenden für A; zuständig sein für A`;
  const PREP_VERBS = new Map();
  for (const item of PREP_VERBS_SRC.split(';')) {
    // Dạng: "[sich] động_từ [sein] giới_từ CÁCH, giới_từ CÁCH". "zuständig sein für A" → khóa "zuständig", hiển thị "zuständig sein".
    const m = item.trim().match(/^(sich\s+)?(\S+)(\s+sein)?\s+(.+)$/);
    if (!m) continue;
    const list = PREP_VERBS.get(m[2]) || [];
    for (const part of m[4].split(',')) {
      const [p, c] = part.trim().split(/\s+/);
      const caseName = { A: 'Akk', D: 'Dat', N: 'Nom' }[c];
      if (!p || !caseName) continue;
      if (!list.some(x => x.prep === p && x.case === caseName)) list.push({ prep: p, case: caseName, reflexive: !!m[1], display: m[2] + (m[3] ? ' sein' : '') });
    }
    PREP_VERBS.set(m[2], list);
  }

  // Chữ viết tắt thường gặp: dấu chấm sau các từ này KHÔNG kết thúc câu ("z. B.", "Dr.", "usw.").
  const ABBREVIATIONS = new Set(('abb abs abt allg anm bd bes betr bspw bzgl bzw ca chr dgl dh di do dr ebd eig entspr etc ev evtl ff fr frl ' +
    'gegr gem ges ggf hl hr hrsg inkl insb jh jhd jr kap kath max mi min mio mo mrd nachf nr od orig pkt prof rd rel ' +
    'sa sek sog so std str stud tel tsd ua usw uvm verf vgl vs zb zt zzt zz evang geb gest jan feb mär apr jun jul aug sep sept okt nov dez').split(' '));

  const WORD_RE = /[\p{L}\p{M}][\p{L}\p{M}'’-]*/gu;
  const cap = w => w ? w[0].toUpperCase() + w.slice(1) : w;
  const isCap = w => !!w && w[0] !== w[0].toLowerCase();
  const uniq = arr => [...new Set(arr)];
  const variants = w => uniq([w, w.toLowerCase(), cap(w.toLowerCase())]);

  function shardKey(w) {
    const c = (w[0] || '').toLowerCase();
    if (c >= 'a' && c <= 'z') return c;
    return { 'ä': 'ae', 'ö': 'oe', 'ü': 'ue', 'ß': 'ss' }[c] || '_';
  }

  // Một shard = nguyên văn file (các dòng đã sắp xếp theo mã ký tự) + vị trí đầu mỗi dòng.
  // Tìm bằng tìm kiếm nhị phân thay vì dựng Map: dựng Map cho cả 1,1 triệu dạng tốn ~150 MB RAM
  // và ~0,5 giây mỗi lần service worker khởi động lại; cách này chỉ tốn ~25 MB.
  function makeShard(text) {
    const starts = [];
    let i = 0;
    while (i < text.length) {
      starts.push(i);
      const nl = text.indexOf('\n', i);
      if (nl < 0) break;
      i = nl + 1;
    }
    return { text, starts: Int32Array.from(starts) };
  }
  function shardGet(sh, w) {
    const { text, starts } = sh;
    let lo = 0, hi = starts.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const s = starts[mid];
      let e = text.indexOf('\n', s);
      if (e < 0) e = text.length;
      const tab = text.indexOf('\t', s);
      const formEnd = tab >= 0 && tab < e ? tab : e;
      const form = text.slice(s, formEnd);
      if (form === w) {
        if (formEnd === e) return form; // chính nó là từ gốc
        const code = text.slice(formEnd + 1, e);
        const n = parseInt(code, 10);
        return form.slice(0, form.length - n) + code.slice(String(n).length);
      }
      if (form < w) lo = mid + 1; else hi = mid - 1;
    }
    return undefined;
  }

  function createGerman(io) {
    // io.text(path) → Promise<string>, path tương đối trong thư mục extension.
    const shards = new Map();
    let freqPromise = null;

    function loadShard(key) {
      if (!shards.has(key)) {
        const p = io.text('data/lex/' + key + '.txt').then(makeShard);
        // Lỗi đọc file (hiếm) không được lưu vĩnh viễn: lần sau sẽ thử đọc lại.
        shards.set(key, p.catch(() => { shards.delete(key); return makeShard(''); }));
      }
      return shards.get(key);
    }
    function loadFreq() {
      if (!freqPromise) freqPromise = io.text('data/freq.txt').then(text => {
        const map = new Map();
        for (const line of text.split('\n')) { const i = line.lastIndexOf(' '); if (i > 0) map.set(line.slice(0, i), +line.slice(i + 1)); }
        return map;
      }).catch(() => { freqPromise = null; return new Map(); });
      return freqPromise;
    }

    async function lemmaOf(w) { if (!w) return undefined; return shardGet(await loadShard(shardKey(w)), w); }
    async function isLemma(w) { return !!w && (await lemmaOf(w)) === w; }
    // Trả về dạng từ gốc có trong từ điển (giữ đúng chữ hoa/thường), không phân biệt hoa/thường khi tìm.
    async function lemmaForm(w) { for (const v of variants(w)) if (await isLemma(v)) return v; return null; }

    // Luật dự phòng khi từ không có trong dữ liệu (từ mới, từ mượn…).
    function ruleGuesses(w) {
      const lw = w.toLowerCase(), out = [];
      const add = x => { if (x && x.length > 2 && x !== lw) out.push(x); };
      let m;
      if ((m = lw.match(/^(.*?)ge(.+?)(t|et)$/))) { add(m[1] + m[2] + 'en'); add(m[1] + m[2] + 'n'); }
      if ((m = lw.match(/^(.*?)ge(.+)en$/))) add(m[1] + m[2] + 'en');
      if ((m = lw.match(/^(.+)zu(.+en)$/))) add(m[1] + m[2]);
      if ((m = lw.match(/^(.+ier)(t|te|ten|test|tet|st|e|en)$/))) add(m[1] + 'en');
      for (const suf of ['test', 'tet', 'ten', 'te', 'est', 'st', 'et', 't', 'e', 'en', 'n']) {
        if (lw.endsWith(suf) && lw.length - suf.length >= 2) { const stem = lw.slice(0, -suf.length); add(stem + 'en'); add(stem + 'n'); }
      }
      // danh từ / tính từ
      for (const suf of ['ern', 'en', 'er', 'es', 'em', 'e', 'n', 's']) {
        if (lw.endsWith(suf) && lw.length - suf.length >= 3) add(lw.slice(0, -suf.length));
      }
      return uniq(out);
    }

    async function lemmaCandidates(rawWord, { sentenceInitial = false, noContext = false } = {}) {
      const out = [];
      const push = (w, kind, label) => { if (w && !out.some(c => c.word === w)) out.push({ word: w, kind, label }); };
      // Bỏ gạch nối ở đầu/cuối: "Arbeits-" trong "Arbeits- und Sozialrecht" → Arbeits → Arbeit.
      const word = String(rawWord || '').replace(/^[-‐'’]+|[-‐]+$/g, '');
      if (!word) return out;
      // "geht’s", "gibt's", "wie war's" → tra phần trước 's (geht → gehen); vẫn giữ nguyên dạng làm ứng viên cuối.
      const apo = word.match(/^([\p{L}\p{M}]{2,})['’]s$/u);
      if (apo) {
        for (const c of await lemmaCandidates(apo[1], { sentenceInitial, noContext })) push(c.word, c.kind, c.kind === 'lemma' ? word + ' → ' + c.word : c.label);
        push(word, 'surface', word);
        return out;
      }
      // Chữ thường giữa câu → chỉ xét động/tính từ; viết hoa giữa câu → danh từ; đầu câu → cả hai.
      // Nếu nhóm ưu tiên không cho kết quả thì mới xét nhóm còn lại.
      const lower = word.toLowerCase(), upper = cap(lower);
      const groups = sentenceInitial ? [uniq([lower, word, upper])]
        : isCap(word) ? [uniq([word, upper]), [lower]] : [uniq([word, lower]), [upper]];
      for (const group of groups) {
        for (const v of group) {
          const l = await lemmaOf(v);
          if (l && l !== word) push(l, 'lemma', word + ' → ' + l);
          else if (l) push(l, 'surface', l);
        }
        if (out.length) break;
      }
      // Không có ngữ cảnh (vd tra riêng một phần từ ghép) mà viết hoa → coi là danh từ.
      const noun = isCap(word) && (!sentenceInitial || noContext);
      // Từ có gạch nối không có trong dữ liệu: đưa phần cuối về từ gốc (E-Mail-Adressen → E-Mail-Adresse)
      if (!out.length && /\p{L}[-‐]\p{L}/u.test(word)) {
        const segs = word.split(/[-‐]/);
        const last = segs.pop();
        const l = await lemmaOf(last) || await lemmaOf(cap(last));
        if (l && l !== last) push(segs.join('-') + '-' + (isCap(last) ? cap(l) : l), 'lemma', word + ' → ' + segs.join('-') + '-' + l);
      }
      if (!out.length) {
        for (const g of ruleGuesses(word)) {
          const f = await lemmaForm(g);
          // Danh từ viết hoa chỉ nhận từ gốc là danh từ (tránh Ersatzgerüste → động từ đoán bừa)
          if (f && (!noun || isCap(f))) push(f, 'lemma', word + ' → ' + f);
        }
      }
      // Từ ghép không có trong dữ liệu: đưa phần cuối về từ gốc (Ersatzgerüste → Ersatz + Gerüst → Ersatzgerüst)
      if (!out.length && isCap(word)) {
        const split = await splitCompound(word);
        if (split) {
          const head = split.parts[split.parts.length - 1];
          const lemma = cap(split.parts.slice(0, -1).map(p => p.text).join('') + head.lemma.toLowerCase());
          if (lemma !== word) push(lemma, 'lemma', word + ' → ' + lemma);
        }
      }
      const known = out.length > 0;
      push(word, 'surface', word);
      // Chỉ đoán thêm (không có trong dữ liệu) cho từ viết thường; từ viết hoa lạ để phần tách từ ghép xử lý
      // (trước đây "Bahnhofstraße" sinh ra các dạng đoán vô nghĩa "bahnhofstraßen", "bahnhofstraßn").
      if (!known && !isCap(word)) for (const g of ruleGuesses(word).slice(0, 2)) push(g, 'guess', g + ' (đoán)');
      return out;
    }

    // Lấy câu chứa vị trí offset trong đoạn văn text. Bỏ qua dấu chấm của chữ viết tắt ("z. B.", "Dr."),
    // số thứ tự/ngày ("am 3. Mai") và dấu chấm mà theo sau là chữ thường.
    // Trả về { sentence, offset } với offset tính lại theo câu.
    function isSentenceEnd(text, i) {
      const ch = text[i];
      if (!/[.!?…]/.test(ch)) return false;
      // Sau dấu câu có thể có dấu ngoặc kép đóng, rồi phải là khoảng trắng hoặc hết văn bản.
      let j = i + 1;
      while (j < text.length && /["»”“'’)\]]/.test(text[j])) j++;
      if (j < text.length && !/\s/.test(text[j])) return false;
      if (ch !== '.') return true;
      if (text[i + 1] === '.' || text[i - 1] === '.') return true; // "..." là dấu ba chấm
      const before = text.slice(Math.max(0, i - 25), i).match(/([\p{L}\d]+)$/u);
      if (before) {
        const w = before[1];
        if (/^\d+$/.test(w)) return false;              // 3. Mai, 2. Auflage
        if (w.length === 1) return false;                // z. B., d. h., Initialen "A. Merkel"
        if (ABBREVIATIONS.has(w.toLowerCase())) return false;
      }
      const next = text.slice(j).match(/^\s*(\S)/);
      if (next && /\p{Ll}/u.test(next[1])) return false; // câu mới không bắt đầu bằng chữ thường
      return true;
    }
    function sentenceAt(text, offset, maxLen = 600) {
      text = String(text || '');
      if (!Number.isInteger(offset) || offset < 0 || offset > text.length) return { sentence: text.slice(0, maxLen), offset: -1 };
      // Tìm ranh giới câu trong khoảng ±400 ký tự; không thấy thì cắt ±250 ký tự quanh từ.
      const lo = Math.max(0, offset - 400), hi = Math.min(text.length, offset + 400);
      let start = -1, end = -1;
      for (let i = offset - 1; i >= lo; i--) if (isSentenceEnd(text, i)) { start = i + 1; break; }
      if (start < 0) start = lo === 0 ? 0 : offset - 250;
      for (let i = offset; i < hi; i++) if (isSentenceEnd(text, i)) { end = i + 1; break; }
      if (end < 0) end = hi === text.length ? text.length : offset + 250;
      end = Math.min(end, start + maxLen);
      while (start < offset && /\s/.test(text[start])) start++;
      return { sentence: text.slice(start, end).trimEnd(), offset: offset - start };
    }

    function tokenize(sentence) {
      const tokens = [];
      let m, clause = 0, last = 0;
      WORD_RE.lastIndex = 0;
      while ((m = WORD_RE.exec(sentence))) {
        const gap = sentence.slice(last, m.index);
        if (/[,;:()\[\]–—!?.…"„“”«»]/.test(gap)) clause++;
        const lower = m[0].toLowerCase();
        if (CLAUSE_WORDS.has(lower)) clause++;
        tokens.push({ t: m[0], lower, start: m.index, end: m.index + m[0].length, clause });
        last = m.index + m[0].length;
      }
      return tokens;
    }

    function isVerbLemma(l) { return /[^\s](en|ern|eln|n)$/.test(l) && !isCap(l); }

    async function verbLemmas(tok) {
      const ls = [];
      for (const v of uniq([tok.lower, tok.t])) { const l = await lemmaOf(v); if (l && isVerbLemma(l)) ls.push(l); }
      if (!ls.length) for (const g of ruleGuesses(tok.lower)) if (await isLemma(g) && isVerbLemma(g)) ls.push(g);
      return uniq(ls);
    }

    // Tìm động từ tách trong câu. Trả về {verbTok, particleTok, lemma, display}.
    async function findSeparable(tokens, idx, sentenceInitial) {
      const sel = tokens[idx];
      if (!sel) return null;
      const verbLike = t => !isCap(t.t) || t === tokens[0] || (t === sel && sentenceInitial);
      const same = tokens.filter(t => t.clause === sel.clause);
      const pos = same.indexOf(sel);
      // Tiểu từ hợp lệ: đứng cuối mệnh đề, hoặc ngay trước "zu + động từ nguyên mẫu" (fängt an zu lachen).
      // Kiểm tra từ sau "zu" để "Lust auf zu viel Arbeit" không thành aufhaben.
      const infinitive = t => !!t && !isCap(t.t) && /[^\s](en|ern|eln|n)$/.test(t.lower);
      const particleOk = (t, i) => PARTICLES.has(t.lower) &&
        (i === same.length - 1 || (same[i + 1].lower === 'zu' && infinitive(same[i + 2])));
      // Trường hợp 1: chọn động từ → tìm tiểu từ phía sau trong cùng mệnh đề
      const verbs = verbLike(sel) ? await verbLemmas(sel) : [];
      if (verbs.length) {
        for (let i = same.length - 1; i > pos; i--) {
          if (!particleOk(same[i], i)) continue;
          for (const v of verbs) {
            const combo = same[i].lower + v;
            if (await isLemma(combo)) return { verbTok: sel, particleTok: same[i], lemma: combo, base: v, weak: WEAK_PARTICLES.has(same[i].lower) };
          }
        }
      }
      // Trường hợp 2: chọn tiểu từ ở cuối mệnh đề → tìm động từ đã chia phía trước
      if (particleOk(sel, pos)) {
        for (let i = 0; i < pos; i++) {
          if (!verbLike(same[i])) continue;
          for (const v of await verbLemmas(same[i])) {
            const combo = sel.lower + v;
            if (await isLemma(combo)) return { verbTok: same[i], particleTok: sel, lemma: combo, base: v, weak: WEAK_PARTICLES.has(sel.lower) };
          }
        }
      }
      return null;
    }

    function prepFor(lemma, sentence) {
      if (!lemma) return [];
      const key = lemma.replace(/^sich\s+/, '');
      const list = PREP_VERBS.get(key);
      if (!list) return [];
      const present = new Set();
      for (const t of tokenize(sentence || '')) {
        let w = t.lower;
        w = CONTRACTIONS[w] || w;
        const m = w.match(/^(?:da|wo)r?(an|auf|aus|bei|durch|für|gegen|in|mit|nach|über|um|unter|von|vor|zu|zwischen)$/);
        if (m) w = m[1];
        if (PREPS.includes(w)) present.add(w);
      }
      return list.map(x => ({ prep: x.prep, case: x.case, reflexive: x.reflexive, verb: x.display || key, inSentence: present.has(x.prep) }));
    }

    // Tách từ ghép (Koehn & Knight): chọn cách tách có trung bình nhân tần suất cao nhất.
    const FUGEN = ['ens', 'es', 'en', 'er', 's', 'n', 'e'];

    // Từ gốc "sâu nhất" của một dạng viết thường: überwachtes → überwacht → überwachen; freundliche → freundlich.
    // Dùng cho phần cuối của tính từ/phân từ ghép.
    async function baseLemma(s) {
      let l = await lemmaOf(s);
      if (!l) for (const g of ruleGuesses(s)) { if (await isLemma(g)) { l = g; break; } }
      if (!l) return null;
      const l2 = await lemmaOf(l);
      if (l2 && l2 !== l && !isCap(l2)) l = l2; // phân từ II → động từ nguyên mẫu
      return l;
    }

    // Từ có gạch nối: tách theo gạch nối, ghép lại các đoạn mà bản thân là một từ (E-Mail-Adresse → E-Mail + Adresse).
    async function splitHyphenated(word) {
      const segs = word.split(/[-‐]/).filter(Boolean);
      if (segs.length < 2) return null;
      const parts = [];
      for (let i = 0; i < segs.length;) {
        // Lấy đoạn dài nhất (từ vị trí i) có trong dữ liệu; không lấy nguyên cả từ làm một phần.
        for (let j = i === 0 ? segs.length - 1 : segs.length; j > i; j--) {
          const text = segs.slice(i, j).join('-');
          const lemma = (await lemmaOf(text)) || (await lemmaOf(cap(text)));
          if (lemma || j === i + 1) { parts.push({ text, lemma: lemma || text, fuge: '' }); i = j; break; }
        }
      }
      return parts.length >= 2 && parts.length <= 5 ? { word, parts } : null;
    }

    async function splitCompound(word) {
      if (/\p{L}[-‐]\p{L}/u.test(word)) return splitHyphenated(word.replace(/^[-‐]+|[-‐]+$/g, ''));
      const w = word.replace(/[-‐]/g, '');
      const lower = w.toLowerCase();
      const n = lower.length;
      if (n < 6 || /\s/.test(w)) return null;
      const freq = await loadFreq();
      const MIN = 3;
      const partCache = new Map();
      const fq = l => freq.get(l.toLowerCase()) || 0;
      const nounLemmaOf = async form => { const l = await lemmaOf(cap(form)); return l && isCap(l) ? l : null; };
      // Từ viết thường (tính từ / phân từ / động từ ghép: selbstüberwachtes, umweltfreundlich):
      // phần cuối là tính từ/phân từ/động từ, không phải danh từ. Trước đây chỉ tách danh từ ghép
      // nên "selbstüberwachtes" không tách được và popup báo "Chưa tìm thấy mục từ".
      const adjHead = !isCap(w);
      // role: 'first' | 'middle' | 'head'. Đầu ngữ và phần giữa phải là danh từ;
      // phần đầu tiên có thể là danh từ (+ Fugenelement), tính từ, gốc động từ (Schreib|tisch) hoặc tiểu từ.
      async function resolvePart(s, role) {
        const k = s + '|' + role;
        if (partCache.has(k)) return partCache.get(k);
        let r = null;
        if (role === 'head' && adjHead) {
          const l = await baseLemma(s);
          r = l && !isCap(l) ? { lemma: l, fuge: '' } : null;
          partCache.set(k, r);
          return r;
        }
        if (role === 'first' && adjHead && !isVerbLemma(s) && await isLemma(s) && fq(s)) {
          // selbst|überwacht: giữ "selbst" (viết thường), không đổi thành danh từ "Selbst".
          // Không áp dụng cho dạng giống động từ (daten, kosten): datengetrieben = Daten + treiben.
          r = { lemma: s, fuge: '', weak: PARTICLES.has(s) || PREPS.includes(s) };
          partCache.set(k, r);
          return r;
        }
        // Bậc 1: chính mảnh đó là một dạng danh từ (Kinder→Kind, Sonnen→Sonne, Tages→Tag)
        const direct = await nounLemmaOf(s);
        if (direct) {
          r = { lemma: direct, fuge: '' };
          const dl = direct.toLowerCase();
          if (fq(s) > fq(dl)) {
            // Dữ liệu đưa "Daten" về "Datum", nhưng chính "daten" phổ biến hơn → giữ Daten (Datenschutz ≠ Datum + Schutz).
            r = { lemma: cap(s), fuge: '' };
          } else if (role !== 'head' && s.startsWith(dl) && FUGEN.includes(s.slice(dl.length))) {
            // Dữ liệu ghi thẳng Arbeits → Arbeit, Tages → Tag: vẫn giữ lại Fugenelement (+s, +es) để hiển thị
            // (trước đây Arbeitsplatz ra "Arbeit + Platz", mất "+s").
            r.fuge = s.slice(dl.length);
          }
        }
        if (!r && role !== 'head') {
          // Bậc 2: bỏ Fugenelement rồi là danh từ (Arbeit|s, Schul(e))
          const opts = [];
          for (const fuge of FUGEN) {
            if (!s.endsWith(fuge) || s.length - fuge.length < MIN) continue;
            const b = s.slice(0, -fuge.length);
            if (await isLemma(cap(b))) opts.push({ lemma: cap(b), fuge });
          }
          if (await isLemma(cap(s + 'e'))) opts.push({ lemma: cap(s + 'e'), fuge: '-e' });
          if (opts.length) r = opts.sort((a, b) => fq(b.lemma) - fq(a.lemma))[0];
        }
        if (role === 'first') {
          // Bậc 3: tính từ, gốc động từ… — chọn cái phổ biến nhất (kể cả so với bậc 2: Schreib → schreiben, không phải Schreibe)
          // Danh từ chắc chắn (bậc 1/2 không phải dạng tự thêm -e) luôn được giữ: Haus|tür, không phải hausen.
          if (!r || r.fuge === '-e' || !fq(r.lemma)) {
            const opts = r ? [r] : [];
            const lower = await isLemma(s) ? s : null;
            if (lower) opts.push({ lemma: lower, fuge: '', weak: PARTICLES.has(s) || PREPS.includes(s) });
            for (const suf of ['en', 'n']) if (await isLemma(s + suf) && isVerbLemma(s + suf)) opts.push({ lemma: s + suf, fuge: '', stem: s });
            if (opts.length) r = opts.sort((a, b) => fq(b.lemma) - fq(a.lemma))[0];
          }
        }
        partCache.set(k, r);
        return r;
      }
      // Tiểu từ/giới từ (nach, bei, aus…) cực phổ biến nên bị giới hạn điểm, tránh "Nach+richten+portal".
      const score = r => r.weak ? Math.log(20) : Math.log(fq(r.lemma) + 1);
      // best[i] = cách tách tốt nhất cho lower.slice(i) (phần cuối là đầu ngữ)
      // best[i] = vài cách tách tốt nhất cho lower.slice(i) (giữ nhiều cách vì điểm trung bình không cộng dồn được)
      // Trung bình nhân tần suất, trừ điểm cho mỗi phần tách thêm (tránh Kran+ken+haus, Platt+form).
      const val = c => c.sum / c.parts.length - (c.parts.length - 1) * 1.5;
      const KEEP = 6;
      const best = new Array(n + 1).fill(null);
      best[n] = [{ parts: [], sum: 0 }];
      for (let i = n - MIN; i >= 0; i--) {
        const cands = [];
        for (let j = i + MIN; j <= n; j++) {
          if (!best[j]) continue;
          const isHead = j === n;
          if (i === 0 && isHead) continue; // không tách
          const r = await resolvePart(lower.slice(i, j), isHead ? 'head' : i === 0 ? 'first' : 'middle');
          if (!r) continue;
          for (const rest of best[j]) cands.push({ parts: [{ text: w.slice(i, j), ...r }, ...rest.parts], sum: score(r) + rest.sum });
        }
        best[i] = cands.length ? cands.sort((a, b) => val(b) - val(a)).slice(0, KEEP) : null;
      }
      const res = best[0] && best[0][0];
      if (!res || res.parts.length < 2 || res.parts.length > 5) return null;
      // Loại cách tách mà phần nào cũng hiếm (rất có thể là tách nhầm)
      if (res.parts.some(p => !freq.get(p.lemma.toLowerCase()))) {
        if (res.parts.filter(p => freq.get(p.lemma.toLowerCase())).length < res.parts.length - 1) return null;
      }
      // Tính từ/phân từ ghép giữ chữ thường (selbstüberwachtes), danh từ ghép viết hoa.
      return { word: adjHead ? w : cap(w), parts: res.parts };
    }

    // Phân tích vùng chọn. text: chuỗi đã chọn (có thể nhiều từ); sentence: câu chứa nó; offset: vị trí trong câu (-1 nếu không biết)
    async function analyze({ text, sentence = '', offset = -1 }) {
      text = (text || '').trim();
      const words = text.match(WORD_RE) || [];
      const tokens = tokenize(sentence);
      const result = { text, candidates: [], separable: null };
      const push = c => { if (c && c.word && !result.candidates.some(x => x.word === c.word)) result.candidates.push(c); };

      if (words.length >= 2) {
        // Nhiều từ: thử ghép động từ tách (vd "rufe an", "bereite vor"), rồi tra nguyên cụm
        const ws = words.map(w => ({ t: w, lower: w.toLowerCase(), clause: 0 }));
        const particle = ws.find(x => PARTICLES.has(x.lower));
        if (particle) {
          for (const x of ws) {
            if (x === particle) continue;
            for (const v of await verbLemmas(x)) {
              const combo = particle.lower + v;
              if (await isLemma(combo)) {
                result.separable = { lemma: combo, display: x.t + ' … ' + particle.t };
                push({ word: combo, kind: 'separable', label: x.t + ' … ' + particle.t + ' → ' + combo });
              }
            }
          }
        }
        push({ word: text, kind: 'phrase', label: text });
        return result;
      }

      const word = words[0] || text;
      // Tìm đúng token đã chọn trong câu: ưu tiên token trùng chữ gần offset nhất
      // (offset có thể lệch vài ký tự khi vùng chọn có dấu ngoặc/khoảng trắng ở đầu, hoặc từ xuất hiện nhiều lần).
      const wl = word.toLowerCase();
      let idx = -1, bestDist = Infinity;
      tokens.forEach((t, i) => {
        if (t.lower !== wl) return;
        const d = offset >= 0 ? Math.abs(t.start - offset) : i;
        if (d < bestDist) { bestDist = d; idx = i; }
      });
      if (idx < 0 && offset >= 0) idx = tokens.findIndex(t => offset >= t.start && offset < t.end);
      const sentenceInitial = idx === 0 || (idx > 0 && /[.!?:„"“]\s*$/.test(sentence.slice(tokens[idx - 1].end, tokens[idx].start)));
      let sep = null;
      if (idx >= 0 && tokens[idx].lower === wl) {
        sep = await findSeparable(tokens, idx, sentenceInitial);
        if (sep) {
          const display = sep.verbTok.t + ' … ' + sep.particleTok.t;
          result.separable = { lemma: sep.lemma, display, weak: !!sep.weak };
          // Tiểu từ yếu (gut, klar…): động từ gốc đứng trước, động từ tách chỉ là gợi ý.
          if (!sep.weak) push({ word: sep.lemma, kind: 'separable', label: display + ' → ' + sep.lemma });
        }
      }
      const lemmas = await lemmaCandidates(word, idx < 0 ? { sentenceInitial: false, noContext: true } : { sentenceInitial });
      for (const c of lemmas) {
        if (sep && sep.weak && c.kind === 'surface') push({ word: sep.lemma, kind: 'separable', label: sep.verbTok.t + ' … ' + sep.particleTok.t + ' → ' + sep.lemma + ' (có thể)' });
        push(c);
      }
      if (sep && sep.weak) push({ word: sep.lemma, kind: 'separable', label: sep.lemma + ' (có thể)' });
      return result;
    }

    return { analyze, lemmaOf, isLemma, lemmaForm, lemmaCandidates, splitCompound, prepFor, tokenize, sentenceAt, PARTICLES };
  }

  global.createGerman = createGerman;
  if (typeof module !== 'undefined') module.exports = { createGerman };
})(typeof self !== 'undefined' ? self : globalThis);

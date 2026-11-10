const { G, t, eq, first } = require('./german.test.js');
const top = async (text, sentence, word) => (await first(text, sentence, word)).candidates[0]?.word;
const parts = async w => { const s = await G.splitCompound(w); return s && s.parts.map(p => p.lemma + (p.fuge && p.fuge !== '-e' ? '+' + p.fuge : '')).join(' '); };

t('skaliert → skalieren', async () => eq(await top('skaliert', 'Das System skaliert gut.'), 'skalieren'));
t('ging → gehen', async () => eq(await top('ging', 'Er ging nach Hause.'), 'gehen'));
t('Häuser → Haus', async () => eq(await top('Häuser', 'Die Häuser sind alt.'), 'Haus'));
t('gegoogelt → googeln', async () => eq(await top('gegoogelt', 'Ich habe das gegoogelt.'), 'googeln'));
t('rufe … an → anrufen', async () => eq(await top('rufe', 'Ich rufe dich morgen an.'), 'anrufen'));
t('an (rufe) → anrufen', async () => eq(await top('an', 'Ich rufe dich morgen an.'), 'anrufen'));
t('kommt aus Berlin → kommen', async () => eq(await top('kommt', 'Er kommt aus Berlin.'), 'kommen'));
t('Der Laden ist zu → Laden', async () => eq(await top('Laden', 'Der Laden ist zu.'), 'Laden'));
t('Blogbeitrag', async () => eq(await parts('Blogbeitrag'), 'Blog Beitrag'));
t('Arbeitsplatz', async () => eq(await parts('Arbeitsplatz'), 'Arbeit+s Platz'));
t('Lernplattform', async () => eq(await parts('Lernplattform'), 'lernen Plattform'));
t('Krankenhaus', async () => eq(await parts('Krankenhaus'), 'Kranke+n Haus'));
t('Ersatzgerüste → Ersatzgerüst', async () => eq(await top('Ersatzgerüste', 'Die Ersatzgerüste stehen bereit.'), 'Ersatzgerüst'));
t('Ersatzgerüst = Ersatz + Gerüst', async () => eq(await parts('Ersatzgerüst'), 'Ersatz Gerüst'));

// Lỗi đã sửa ở 3.1.0
t('Tageszeitung giữ +es', async () => eq(await parts('Tageszeitung'), 'Tag+es Zeitung'));
t('Datenschutzerklärung: Daten, không phải Datum', async () => eq(await parts('Datenschutzerklärung'), 'Daten Schutz Erklärung'));
t('E-Mail-Adressen → E-Mail-Adresse', async () => eq(await top('E-Mail-Adressen', 'Bitte prüfen Sie die E-Mail-Adressen.'), 'E-Mail-Adresse'));
t('Tách theo gạch nối', async () => eq(await parts('E-Mail-Adresse'), 'E-Mail Adresse'));
t('geht’s → gehen', async () => eq(await top('geht’s', 'Wie geht’s dir?'), 'gehen'));
t('Arbeits- (Ergänzungsstrich) → Arbeit', async () => eq(await top('Arbeits-', 'Arbeits- und Sozialrecht'), 'Arbeit'));
t('"macht das gut" → machen trước gutmachen', async () => {
  const r = await first('macht', 'Er macht das gut.');
  eq(r.candidates[0].word, 'machen'); eq(r.separable.weak, true);
});
t('"Lust auf zu viel" không thành aufhaben', async () => eq(await top('habe', 'Ich habe keine Lust auf zu viel Arbeit.'), 'haben'));
t('fängt an zu lachen → anfangen', async () => eq(await top('fängt', 'Er fängt an zu lachen.'), 'anfangen'));
t('findet … statt → stattfinden', async () => eq(await top('findet', 'Die Konferenz findet morgen statt.'), 'stattfinden'));
t('Bahnhofstraße: không đoán dạng viết thường', async () => {
  const r = await first('Bahnhofstraße', '');
  eq(r.candidates.filter(c => c.kind === 'guess').length, 0);
});
t('Không có ngữ cảnh + viết hoa → danh từ trước (Laden)', async () => eq(await top('Laden', ''), 'Laden'));
t('Chọn đúng lần xuất hiện thứ hai', async () => {
  const s = 'Er kommt um acht Uhr an, und sie ruft an.';
  const r = await G.analyze({ text: 'an', sentence: s, offset: s.lastIndexOf('an') });
  eq(r.candidates[0].word, 'anrufen');
});
t('zuständig sein für + Akk', async () => eq(G.prepFor('zuständig', 'Er ist für alles zuständig.'), [{ prep: 'für', case: 'Akk', reflexive: false, verb: 'zuständig sein', inSentence: true }]));
t('warten auf + Akk, darauf ✓', async () => eq(G.prepFor('warten', 'Ich warte darauf.')[0].inSentence, true));
t('Câu: "z. B.", "Dr.", "3. Mai" không cắt câu', async () => {
  const T = 'Vorher. Das gilt z. B. für Dr. Müller am 3. Mai. Danach geht er.';
  eq(G.sentenceAt(T, T.indexOf('Müller')).sentence, 'Das gilt z. B. für Dr. Müller am 3. Mai.');
});
t('Câu: offset tính lại đúng', async () => {
  const T = 'Erst das. Ich rufe dich morgen an! Dann gut.';
  const r = G.sentenceAt(T, T.indexOf('rufe'));
  eq(r.sentence.slice(r.offset, r.offset + 4), 'rufe');
});
t('Câu: đoạn dài không có dấu chấm bị cắt ±250', async () => {
  const T = 'wort '.repeat(300);
  const r = G.sentenceAt(T, 750);
  eq(r.sentence.length <= 600 && r.offset >= 0, true);
});

// Tính từ / phân từ ghép (Faztaa không có nguyên từ)
t('selbstüberwachtes → selbst + überwachen', async () => eq(await parts('selbstüberwachtes'), 'selbst überwachen'));
t('umweltfreundliche → Umwelt + freundlich', async () => eq(await parts('umweltfreundliche'), 'Umwelt freundlich'));
t('Danh từ ghép không đổi: Blogbeitrag', async () => eq(await parts('Blogbeitrag'), 'Blog Beitrag'));
t('datengetriebenen → Daten + treiben', async () => eq(await parts('datengetriebenen'), 'Daten treiben'));
t('kostengünstig → Kosten + günstig', async () => eq(await parts('kostengünstig'), 'Kosten günstig'));

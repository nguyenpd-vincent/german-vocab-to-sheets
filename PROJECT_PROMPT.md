# Prompt: Deutsch Lens (German → English lookup extension for Chrome/Edge)

Copy everything below into a new conversation together with the extension folder (or a ZIP of it).

---

You are working on **Deutsch Lens 3.0.1**, a Manifest V3 browser extension for Chrome and Edge. It helps a Vietnamese learner read German web pages. The user selects a German word, and the extension shows its English meaning, IPA, part of speech, forms, synonyms, word family and German–English–Vietnamese example sentences. All dictionary data comes from the **Faztaa API**. The user can also save a word to Google Sheets through a Google Apps Script web app. The UI text is in Vietnamese and must stay Vietnamese.

## Hard constraints (do not break)
- **Faztaa is the only dictionary source.** No AI, no LLM, no other translation API. Never invent meanings or example sentences.
- **Only the selected word or its analysed candidates go to Faztaa.** The surrounding sentence stays inside the extension and is used only for local analysis.
- **The Faztaa token stays in `chrome.storage.local` with access level `TRUSTED_CONTEXTS`.** Content scripts can never read it, and it is never bundled into the code.
- Network access: `https://api.faztaa.com/*`, plus the optional Google Apps Script origins used for Sheets.
- Faztaa endpoints, verified against the real API (header `authorization: <token>`):
  - `GET https://api.faztaa.com/api/search/en/devi/{word}?page=1&limit=20` → `{ result: [ { word, pronounce:{de}, content:[{kind, field?, means:[{mean}]}], conjugation:{gt:{w: article}, ...}, snym, word_family } ] }`
  - `GET https://api.faztaa.com/api/search/list/example/en/{word}?page={n}&limit=10` → `[ { _id, e: German sentence, m:{en, vi} } ]`
  - The search type really is `devi` with language `en`. Do not "fix" it to `word`/`deen`.

## Files
- `manifest.json`: MV3. Service worker `background.js`, content script `content.js` on http/https pages, options page.
- `adapter.js`: `clean()` strips HTML from Faztaa strings; `normalizeEntry()` turns a raw Faztaa entry into `{word, ipa, meaning, pos, forms, synonyms, family}`.
- `german.js`: offline German analyser, `createGerman({ text(path) })`. It works in the service worker (via `importScripts`) and in Node (`module.exports`) for testing.
  - `analyze({text, sentence, offset})` → `{ candidates:[{word, kind:'separable'|'lemma'|'surface'|'guess'|'phrase', label}], separable }`
  - Lemmatisation: data lookup first; if that fails, rule-based guesses checked against the data.
    - Lowercase words in mid-sentence are treated as verbs or adjectives; capitalised mid-sentence words as nouns; the first word of a sentence as both.
    - An unknown capitalised word is reduced through the compound splitter (Ersatzgerüste → Ersatzgerüst).
  - Separable verbs: a particle (an, auf, vor, …) at the end of the same clause, or followed by "zu", is combined with the verb's lemma. The combination is accepted only if it exists in the data.
    - The clause ends at punctuation or a conjunction.
    - This works in both directions: selecting the verb or selecting the particle.
  - `splitCompound(word)`: Koehn & Knight style splitting.
    - Each split keeps the 6 best options per position.
    - The score is the geometric mean of the parts' frequencies, minus 1.5 for each extra part.
    - Particles and prepositions get a capped score.
    - Fugenelemente are handled (s, es, en, n, er, e, ens, and a dropped -e).
    - The last part (the head) must be a noun; the first part may also be an adjective or a verb stem.
  - `prepFor(lemma, sentence)`: about 150 hand-written verb + preposition + case entries, marking whether that preposition appears in the sentence.
- `data/lex/<key>.txt`: about 1.1M German form → lemma pairs, sharded by first letter (a–z, ae, oe, ue, ss, _). Built from simplemma 2.0.0 (MIT).
  - Line format: `form` when the form is itself a lemma, otherwise `form<TAB><n><suffix>` (drop the last n characters, append the suffix).
  - Shards are loaded on demand with `fetch(chrome.runtime.getURL(...))`.
- `data/freq.txt`: lemma frequencies (lowercase) from FrequencyWords / OpenSubtitles 2018 (CC BY-SA 4.0). Used only to rank compound splits. Sources are listed in `data/NGUON_DU_LIEU.txt`.
- `background.js`: Faztaa fetches with an in-memory cache (300 entries, 15 min) and de-duplication of identical requests in flight.
  - Messages:
    - `analyze {word, sentence, offset}`: runs the analyser, then tries up to 4 candidates until Faztaa has an exact headword (articles and "sich" ignored).
      - If none matches: split the compound, look up each part, and build a clearly marked synthetic entry (`synthetic:true`). Examples come from the whole word, or from the head if there are none.
      - If there is still nothing, show the closest fuzzy result with a note.
      - Returns `{query, sentence, candidates, chosen, separable, compound, note, entries, exact, examples, hasMore, exampleWord, errors, prep}`.
      - Returns `{error, needsSettings:true}` when there is no token.
    - `lookup {word, page, sentence?}`: one word, used by candidate chips, "Xem thêm ví dụ" and the options page test.
    - `scope`: whether the page is allowed, plus the UI preferences `{lookupMode, closeOnOutside}`.
    - `saveWord`, `sheetsTest`, `settings`, `clear`.
  - Scope modes: all sites, one site (origin), or one chat (origin + path).
- `content.js`: UI in a closed Shadow DOM.
  - The selection either shows a "Tra Faztaa" button or looks the word up at once (with Alt held, or per the `lookupMode` setting: button / dblclick / auto).
  - The sentence around the selection is extracted from the nearest block element. Soft hyphens and zero-width characters are stripped.
  - The popup opens next to the word, can be dragged (dragging pins it), and has a 📌 pin button, a ← history button (20 steps), Esc / ✕ to close, and optional close-on-outside-click (off by default).
  - Alt + click on another word adds it to the lookup (for example "bereiten" + "vor" → vorbereiten).
  - Popup contents:
    - candidate chips (✓ = exact match on Faztaa)
    - separable-verb line
    - compound box with clickable parts
    - preposition box
    - entry select and table
    - save to Sheets
    - Faztaa link
    - examples with paging
  - Every response goes through `normalize()`, and rendering goes through `safeRender()`, so a reply with missing fields cannot crash the UI.
- `options.html/js/css`: token, scope, lookup mode, close-on-outside, Sheets settings, Faztaa test, cache clear.
- `../google-apps-script/Code.gs` and `../HUONG_DAN_GOOGLE_SHEETS.md`: the Sheets backend (unchanged).

## Your task
1. Read every file. Load the folder unpacked in Chrome (`chrome://extensions`, Developer mode, Load unpacked) and test on real German pages: news articles, chat pages, cookie banners, text with hyphenation, text inside iframes and in shadow DOM.
2. **Find and fix all errors**: runtime exceptions (watch the service worker console and the page console, which logs lines prefixed `[Deutsch Lens]`), wrong lemmas, wrong separable-verb detection, bad compound splits, UI and positioning bugs, and race conditions between lookups. For each bug, explain the cause before fixing it.
3. Regression cases that must keep working:
   - skaliert → skalieren · ging → gehen · Häuser → Haus · gegoogelt → googeln
   - "Ich rufe dich morgen an." with "rufe" or "an" selected → anrufen
   - "Er kommt aus Berlin." → kommen (not auskommen) · "Der Laden ist zu." → Laden (noun, not zuladen)
   - Blogbeitrag → Blog + Beitrag · Arbeitsplatz → Arbeit + s + Platz · Lernplattform → lernen + Plattform · Krankenhaus → Kranke + Haus · Ersatzgerüste → Ersatzgerüst = Ersatz + Gerüst
   - No token → a friendly message with an "Open settings" button (no exception)
4. Keep the code readable, with comments in Vietnamese. Do not minify. Keep all user-facing text in Vietnamese. Update README.md (changelog) and the version in manifest.json.
5. Test the analyser in Node (`require('./german.js')`, with `text` reading files from disk) and the UI with Playwright, loading the unpacked extension and mocking `api.faztaa.com`.

## Known limitations worth improving
- Sentence splitting is naive: abbreviations like "z. B." or "Dr." end the sentence early.
- Compound ranking uses subtitle frequencies, which are lowercased, so rare technical compounds may split oddly.
- Verb + preposition data covers only about 150 common verbs.
- The data is about 18 MB unpacked; each shard is parsed into a Map when the service worker starts.
- Content scripts do not run in PDFs, the browser's internal pages, or the extension store.

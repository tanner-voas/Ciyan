# Deck data attribution and reuse

The v0.3.2 deck collection is distributed under Creative Commons Attribution–ShareAlike 4.0: https://creativecommons.org/licenses/by-sa/4.0/ . This applies to the deck data, not automatically to the app source or the user's learning history.

Practical topic vocabulary, concise English glosses, and 24 sentence exercises were prepared for Cíyán. HSK candidate glosses and spaced pinyin derive from the Complete HSK Vocabulary project and its CC-CEDICT source; common senses were selected and editorial corrections made. The data is educational material, not a claim that every possible translation or regional usage is covered.

Sources:

- Ministry of Education, GF 0025–2021: https://www.moe.gov.cn/jyb_xwfb/gzdt_gzdt/s5987/202103/t20210329_523304.html
- HSK level transcription: https://github.com/ivankra/hsk30 (MIT, Copyright (c) 2023 Ivan Krasilnikov; Copyright (c) 2021 Shawky; Copyright (c) 2021 Pleco Inc.). The bundled `content/hsk2021-levels.json` is a cleaned subset for levels 1–4, with simple variants expanded. This is the 2021 grading standard, not the later exam syllabus.
- Underlying word-list OCR: https://github.com/elkmovie/hsk30 (MIT, Copyright (c) 2021 Pleco Inc.).
- Pinyin, frequency candidate ranking and dictionary glosses: https://github.com/drkameleon/complete-hsk-vocabulary (MIT, Copyright (c) 2026 Yanis Zafirópulos).
- Dictionary definitions: CC-CEDICT contributors, distributed by MDBG, CC BY-SA 4.0. https://cc-cedict.org/wiki/ and https://www.mdbg.net/chinese/dictionary
- Climbing terminology checked against NICE CLIMBS' bilingual terminology and theCrag's Chinese glossary: https://niceclimbs.com/2019/04/26/chinese-english-climbing-term-dictionary/ and https://www.thecrag.com/zh_hans/article/glossary/ . English card glosses are concise descriptions, not reproduced explanatory passages. Local gym terms vary.

MIT permission notice for the listed MIT sources (retain the copyright notices above and in `content/LICENSES.txt`):

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

## v0.3.1 content additions

The extended geography, English glosses, curated sentence examples, and topical templates were authored for this application. Country memberships and capitals were cross-checked against official EU membership resources and standard geographic references; United States states and Chinese province-level terms use established Chinese transliterations. Source references for ongoing review:

- EU country list: https://european-union.europa.eu/principles-countries-history/eu-countries_en
- EU country data: https://european-union.europa.eu/principles-countries-history/country-profiles_en
- China administrative vocabulary and geography: https://www.stats.gov.cn/
- US states: https://www.census.gov/about/history/historical-censuses-and-surveys/census-states.html
- South Africa's executive/legislative/judicial capitals: https://www.gov.za/about-sa/south-africas-provinces
- Casual Chinese usage and internet slang were cross-checked against contemporary language-learning articles; usage varies by age, region and date. The seven friend-chat expressions are described in a separate deck and should not be mistaken for universal colloquial forms.

All new English translations and sentence patterns should be treated as learning aids, not official geographic or Chinese-language proficiency certifications.

## v0.3.2 Pleco reference and HSK labels

A user-provided Pleco flashcard export (`AllCards.txt`) was used solely as a candidate list of headwords and pinyin readings, including its HSK 3.0 group headings. We did not reproduce its dictionary definitions or include the original export in the distributed decks or Git repository. Added definitions, topic tags and sample sentences were independently curated as application learning material. Exact level assignments are frozen in `content/hsk-levels-032.json` and rendered uniformly as HSK1–HSK7-9. The labels describe the supplied 2021 HSK grading system (not the separately revised examination syllabus); the interface does not expose competing label sets.

Like previous releases, examples have been checked automatically for structural correctness and coverage; they are not a substitute for native-speaker review of every example.

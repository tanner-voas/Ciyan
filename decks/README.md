# Cíyán optional Mandarin decks — v0.3.1

The downloadable decks contain **2,002 distinct vocabulary entries** (including the original starter words), and **1,287 grammar entries** covering all of them through exact `{word}` tokens. There are 26 individual topical/HSK/grammar decks, plus `all-decks.json`. Counts for individual decks overlap because they include the vocabulary required for their sentences; do not add them together.

Open **Home → Explore optional decks** and import any topic, or load the all-in-one deck. Imports are strictly additive: existing vocabulary, grammar, and learning records are preserved, and additional tags may be merged. The larger grammar collection is optional; the app initially remains unchanged until you load a deck.

## New geography

`visited-places.json` preserves the places supplied by the user, with corrected spelling and geographic grouping. It does *not* imply travel to other places added in general-reference decks. The geographic corrections include **南昌 (Nanchang) under 江西 (Jiangxi)**, not Qinghai, and **恩施 (Enshi) under 湖北 (Hubei)**, not Zhejiang. Mount Fuji, Lake Tahoe, Yosemite National Park, Angkor Wat, Neuschwanstein Castle, and other landmarks are identified as places/landmarks rather than cities. User-listed Hong Kong and Macao areas are included without inventing individual trips within them.

`us-states.json` contains all **50 US states** plus **Washington, DC** as a distinct district. `china-regions.json` covers **34 province-level administrative/geographic entries** in the common Chinese vocabulary listing (23 provinces including Taiwan, 5 autonomous regions, 4 municipalities and 2 special administrative regions), without resolving contested legal status. `eu-capitals.json` lists **27 EU member countries** and their capitals. `asia-world-capitals.json` has the requested Southeast and East Asian nations, Oceania, Russia, South Africa's three-capital distinction, the UK's four constituent countries and their capitals, and additional relevant countries. Singapore is both a country and its own capital. Malaysia's Kuala Lumpur/Putrajaya distinction and Indonesia's Jakarta/Nusantara transition are explained in separate example cards.

## Slang and social language

`slang-friends.json` has seven expressions previously encountered in chats with friends: 阳了, 留守儿童, 爬墙, 不像话, 抓现行, 查岗 and 吐槽. **留守儿童** is primarily a serious term referring to children separated from migrant-working parents; the card explains that context rather than portraying it as general slang. `slang-modern.json` includes contemporary conversational language such as 无语, 离谱, 笑死, 上头, 摸鱼, 搭子, 种草, 吃瓜 and 社恐. Usage can change quickly and some expressions are online-oriented rather than universal spoken slang.

## Grammar coverage

Each word in the optional library, *including* the 52 starter words, is used in at least one sentence as an exact marked vocabulary token. The generator validates character-token correctness, grammar-card structure, unique IDs, syllable availability for tone testing, and prerequisite vocabulary. Original 24 grammar cards retain their IDs. Contextual examples span the following constructions: subject–verb–object, time/place fronting, classifiers, 了 / 过 / 着 aspect, negation, question particles, 还是 vs 或者, 比 comparisons, 把 and 被, complements, directional forms, cause/consequence, concessions, conditions, modal verbs, degrees of certainty, and colloquial conversation. Some grammar entries are fact statements about geography, restaurant orders, exercise, and travel.

**Quality limitation:** The 1,200+ new examples were composed using a combination of authored sentences, reviewed lexical overrides and template families. Tests establish *coverage and structural validity*, but cannot formally prove that every sentence's collocations or English gloss sound natural. More editorial review is appropriate as you encounter examples. A sentence can also have other valid Mandarin word orders; the existing grammar study mode grades against the target version on its card. Its usage-risk score remains 0% until the planned scoring algorithm is implemented. Automatically composed pinyin follows lexical citation tones rather than all conversational tone-sandhi rules.

## Existing subject decks and HSK levels

The original China foods, ingredients, ordering, world foods, activities/sports, muscles/body, climbing, places and daily-life decks remain included and are extended with independent usage examples. Selected HSK 3.0 level 1–4 decks continue to use **GF 0025–2021**, not a later exam-specific syllabus. The original selected 660 HSK words (180, 180, 160, 140) remain the primary selections; card counts in the shipped JSON are higher because associated grammar prerequisites are included.

## Rebuilding

`python3 build_decks.py` deterministically composes grammar and topic-deck JSON using committed source files in `content/`. The sentence builder is `build_sentence_031.py`. `python3 package.py` regenerates ignored `dist/ciyan/`; upload that folder (or a ZIP of its contents) to Cloudflare Pages. No network requests or third-party Python modules are required.

See [ATTRIBUTION.md](ATTRIBUTION.md) for sources and licensing, and `AUDIT_v0.3.1.md` at repository root for test results and remaining caveats.

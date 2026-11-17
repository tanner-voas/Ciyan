# Cíyán optional Mandarin decks — v0.3.2

The downloadable decks contain **2,277 distinct vocabulary entries** (including the original starter words), and **1,549 grammar entries** covering all of them through exact `{word}` tokens. There are 38 individual topical/HSK/grammar decks, plus `all-decks.json`. Counts for individual decks overlap because they include the vocabulary required for their sentences; do not add them together.

Open **Home → Explore optional decks** and import any topic, or load the all-in-one deck. Imports are strictly additive: existing vocabulary, grammar, and learning records are preserved, and additional tags may be merged. The larger grammar collection is optional; the app initially remains unchanged until you load a deck.

## v0.3.2 content and tagging

The library now comprises **2,277 distinct words and 1,549 grammar cards**, split across 38 individual optional decks plus the all-in-one deck. Included in the expansion are new curated conversation, relationships, errands, professional, health, travel, fluency and advanced-expression decks. These are **selected items** from the user-supplied Pleco headword inventory: their meanings are independently edited concise glosses, not copied definitions. Each word is explicitly used in an example; individual decks contain the example and all of its vocabulary prerequisites.

The HSK deck labels are simply **HSK1, HSK2, HSK3, HSK4, HSK5, HSK6 and HSK7-9**, with the corresponding lower-case tag names `hsk1`, `hsk2`, etc. There is no parallel `hsk-2021-*`, `hsk-3.0`, or bare `hsk` tag. The level map is drawn from the *HSK 3.0* group in the uploaded reference (the 2021 framework, including its combined 7–9 band); this is provenance, **not a second set of user-facing lists**. If a word from food, climbing or another topical deck belongs to one of those levels, it receives that tag too. A level deck is not an exhaustive HSK list.

The app is still in development and has no actual learning history. No v0.3.1-to-v0.3.2 migration of imported data or old tags is performed. Start with clean site data if needed while testing. Plan migration and backward-compatibility tests before real study data exists.

## New geography

`visited-places.json` preserves the places supplied by the user, with corrected spelling and geographic grouping. It does *not* imply travel to other places added in general-reference decks. The geographic corrections include **南昌 (Nanchang) under 江西 (Jiangxi)**, not Qinghai, and **恩施 (Enshi) under 湖北 (Hubei)**, not Zhejiang. Mount Fuji, Lake Tahoe, Yosemite National Park, Angkor Wat, Neuschwanstein Castle, and other landmarks are identified as places/landmarks rather than cities. User-listed Hong Kong and Macao areas are included without inventing individual trips within them.

`us-states.json` contains all **50 US states** plus **Washington, DC** as a distinct district. `china-regions.json` covers **34 province-level administrative/geographic entries** in the common Chinese vocabulary listing (23 provinces including Taiwan, 5 autonomous regions, 4 municipalities and 2 special administrative regions), without resolving contested legal status. `eu-capitals.json` lists **27 EU member countries** and their capitals. `asia-world-capitals.json` has the requested Southeast and East Asian nations, Oceania, Russia, South Africa's three-capital distinction, the UK's four constituent countries and their capitals, and additional relevant countries. Singapore is both a country and its own capital. Malaysia's Kuala Lumpur/Putrajaya distinction and Indonesia's Jakarta/Nusantara transition are explained in separate example cards.

## Slang and social language

`slang-friends.json` has seven expressions previously encountered in chats with friends: 阳了, 留守儿童, 爬墙, 不像话, 抓现行, 查岗 and 吐槽. **留守儿童** is primarily a serious term referring to children separated from migrant-working parents; the card explains that context rather than portraying it as general slang. `slang-modern.json` includes contemporary conversational language such as 无语, 离谱, 笑死, 上头, 摸鱼, 搭子, 种草, 吃瓜 and 社恐. Usage can change quickly and some expressions are online-oriented rather than universal spoken slang.

## Grammar coverage

Each word in the optional library, *including* the 52 starter words, is used in at least one sentence as an exact marked vocabulary token. The generator validates character-token correctness, grammar-card structure, unique IDs, syllable availability for tone testing, and prerequisite vocabulary. Original 24 grammar cards retain their IDs. Contextual examples span the following constructions: subject–verb–object, time/place fronting, classifiers, 了 / 过 / 着 aspect, negation, question particles, 还是 vs 或者, 比 comparisons, 把 and 被, complements, directional forms, cause/consequence, concessions, conditions, modal verbs, degrees of certainty, and colloquial conversation. Some grammar entries are fact statements about geography, restaurant orders, exercise, and travel.

**Quality limitation:** The 1,200+ new examples were composed using a combination of authored sentences, reviewed lexical overrides and template families. Tests establish *coverage and structural validity*, but cannot formally prove that every sentence's collocations or English gloss sound natural. More editorial review is appropriate as you encounter examples. A sentence can also have other valid Mandarin word orders; the existing grammar study mode grades against the target version on its card. Its usage-risk score remains 0% until the planned scoring algorithm is implemented. Automatically composed pinyin follows lexical citation tones rather than all conversational tone-sandhi rules.

## Existing subject decks and HSK levels

The original China foods, ingredients, ordering, world foods, activities/sports, muscles/body, climbing, places and daily-life decks remain included and are extended with independent usage examples. HSK1–HSK7-9 labels are canonical and unified; all included vocabulary receives its corresponding tag when present in the consolidated reference.

## Rebuilding

`python3 build_decks.py` deterministically composes grammar and topic-deck JSON using committed source files in `content/`. The sentence builder is `build_sentence_031.py`. `python3 package.py` regenerates ignored `dist/ciyan/`; upload that folder (or a ZIP of its contents) to Cloudflare Pages. No network requests or third-party Python modules are required.

See [ATTRIBUTION.md](ATTRIBUTION.md) for sources and licensing, and `AUDIT_v0.3.2.md` at repository root for test results and remaining caveats.

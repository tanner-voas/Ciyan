# Cíyán — Mandarin flashcards (PWA)

A pretty, offline-first Mandarin flashcard app for iPhone and desktop. No accounts, external fonts, analytics, network APIs, hosting backend, or build process are required.

## Install on an iPhone (recommended: Cloudflare Pages)

1. Download **Ciyan_PWA_Deploy.zip**. Keep the ZIP intact; its root contains `index.html`.
2. Sign in or create a free account at https://dash.cloudflare.com/ . In **Workers & Pages**, choose **Create application → Pages → Direct Upload / Upload assets / Drag and drop files** (the interface wording may vary).
3. Enter any available project name, upload the deployment ZIP, and select **Deploy**. Cloudflare provides an HTTPS URL such as `https://your-project.pages.dev`.
4. Open that URL in **Safari** on your iPhone. Tap **Share → Add to Home Screen**, enable **Open as Web App**, and tap **Add**.
5. Launch Cíyán from the Home Screen. After the first online load, the app shell is cached for offline use.

Official hosting instructions: https://developers.cloudflare.com/pages/get-started/direct-upload/ . Cloudflare's drag-and-drop deployment accepts ZIP files. The deployed web page is publicly reachable; **your personal review data is not sent to Cloudflare or any server**.

**Important:** Opening `index.html` directly in Files/Safari will not produce an installable, reliably offline PWA; service workers need an HTTPS origin (or localhost during development). Don't clear Safari website data, delete the Home Screen app, or change its hosting address without exporting a backup first.

## Using Cíyán

- **Home:** See due cards, words learned, today's activity, and topics.
- **Study:** Reveal each Chinese card, then rate **Again**, **Hard**, **Good**, or **Easy**. The review and schedule are written to IndexedDB immediately after each rating.
- **Words:** Search by Chinese, pinyin, English, example, or tag. Create, edit, or delete cards.
- **Stats:** See historical reviews, practice streak, estimated retention, and recent sessions.
- **Settings:** Adjust daily new words (default 8), session size (default 12), target retention (default 90%), and whether pinyin is shown on the front.
- **End of session:** The app always reminds you to export a full JSON progress backup. Tap **Save to Files (share sheet)** and choose **Save to Files** (preferably iCloud Drive). If Web Share isn't supported, tap **Download JSON instead**, then save the downloaded file in Files. Tap **I saved this file in Files** only after verifying that the file exists.
- **Restore:** Settings → Restore full backup → pick a `ciyan-progress-...json` file. This replaces current cards, schedules, settings, and review history; it can also restore a partial active session.

**Data safety:** The working copy is IndexedDB (browser-managed, not guaranteed permanent). Independent JSON backups stored in iPhone Files are your recovery source. A phone restart normally does not delete IndexedDB, but iOS can evict it. Export after *every session*. The app cannot automatically save a persistent file to Files or confirm that the user completed the Files action.

## Starter content and extension

Contains **32 test cards** focused on greetings, social conversation, work, food and restaurant vocabulary, Shanghai-style city navigation, and climbing. These are starter examples, not a graded curriculum. Add cards in-app or import a JSON deck.

Deck import accepts `[{...}, ...]` or `{ "cards": [{...}] }`. Each card requires `hanzi` and `english`; recommended fields: `id` (stable unique identifier), `pinyin`, `example`, `examplePinyin`, `exampleEnglish`, `tags` (array of strings), and `source`.

Example:

```json
{
  "format": "ciyan-deck",
  "version": 1,
  "cards": [
    {"id":"mydeck-001","hanzi":"咖啡","pinyin":"kāfēi","english":"Coffee","example":"我想喝咖啡。","examplePinyin":"Wǒ xiǎng hē kāfēi.","exampleEnglish":"I want coffee.","tags":["food","daily-life"],"source":"My deck"}
  ]
}
```

Import is **additive**: cards with previously unseen IDs are added; existing IDs and review progress are preserved. To update existing cards, use the in-app edit function. Stable IDs matter. For a starting template, choose Settings → Download deck template.

## Scheduling / limitations

- Implements a **self-contained FSRS-4.5** memory model with its published default parameters (rather than fetching a library over the network). The simple learning/relearning policy uses 1-minute **Again** and 10-minute early **Hard** steps, plus 90% configurable retention. The model is not personalized with FSRS parameter optimization. FSRS model reference: https://github.com/open-spaced-repetition/awesome-fsrs/wiki/The-Algorithm .
- One **Chinese → English** review direction in v1; reverse and listening cards can be added in future versions.
- User-provided vocabulary is rendered as text (not executable HTML).
- There are **no remote reminders / push notifications**. The backup reminder appears at the end of every completed session, including sessions ended early after at least one answer.
- If an imported deck contains bad card data, import fails rather than partially importing it.
- Service worker caches the app shell for offline use after first online installation. To release an updated version, change the cache version string in `sw.js` (for example `ciyan-shell-v2`), redeploy to the **same origin**, and reopen online. Export a backup first.

## Files / development

`index.html`, `styles.css`, `app.js`, `cards.js`, `fsrs.js`, `storage.js`, `manifest.webmanifest`, `sw.js`, and `icons/` are the **entire deployable app**. No npm dependencies. The source package additionally contains this README, `tests/`, and `package.json`.

To run locally from the app directory on any machine with Python:

```sh
python3 -m http.server 8765
```

Visit http://localhost:8765/ . Run unit tests with `npm test` on Node.js 20+.

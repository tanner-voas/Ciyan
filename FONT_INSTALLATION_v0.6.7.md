# Cíyán v0.6.7 — Installed Chinese font names

The six font family names below were transcribed from the user's installed-font list on their iPhone. They are now used as the first local-family names for font checks and rendering.

| Difficulty | App option and local font name |
|---|---|
| Beginner | Default iPhone Chinese print font (always accepted) |
| Intermediate | `xiaowei` (站酷小薇 LOGO 体) |
| Intermediate | `HappyZcool-2016` (站酷快乐体) |
| Advanced | `YRDZST` (杨任东竹石体) |
| Advanced | `Ma Shan Zheng` |
| Expert | `Muyao-Softbrush` (沐瑶软笔手写体) |
| Expert | `Zhi Mang Xing` |

**Using the fonts:** Under Settings → Chinese typography, choose your difficulty, then the exact font. The existing font remains in use until **Apply font** is tapped. Mixed requires both fonts at that level to pass the availability probe. If either fails, the app shows an error and restores the previous selection.

**Important iPhone Safari limitation:** An installed font in a native font manager may not be exposed to Safari or a Home Screen PWA. This release deliberately does not bundle font binaries, so font use cannot be guaranteed before testing on the actual device. If no installed font can load, Beginner remains available. Fonts are not being distributed in these ZIPs; earlier links to authorized font creators remain in `FONT_INSTALLATION_v0.6.6.md`.

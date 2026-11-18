# Installing optional Chinese fonts for Cíyán v0.6.6

The app does **not** distribute font binary files. Obtain the fonts from their
creator or an authorized distribution and install them using an iPhone font
management app. After installation, restart Cíyán and select a font under
**Settings → Chinese typography**. If the browser cannot access it, the app
will display an error and retain the last accepted font.

| Level | Font displayed in Cíyán | Suggested source |
|---|---|---|
| Beginner | iPhone default, clean print | Always available; no installation |
| Intermediate | 站酷小薇 LOGO 体 / ZCOOL XiaoWei | https://fonts.google.com/specimen/ZCOOL+XiaoWei |
| Intermediate | 站酷快乐体 / ZCOOL KuaiLe | https://fonts.google.com/specimen/ZCOOL+KuaiLe |
| Advanced | 杨任东竹石体 / Yang Ren Dong Zhu Shi | Creator's authorized distribution; see https://windfonts.com/news/587/ for font and authorization notes |
| Advanced | 马善政毛笔楷书 / Ma Shan Zheng | https://fonts.google.com/specimen/Ma+Shan+Zheng |
| Expert | 沐瑶软笔手写体 / Muyao Softbrush | https://www.hellofont.cn/font-detail?fontid=6313 |
| Expert | 志莽行书 / Zhi Mang Xing | https://fonts.google.com/specimen/Zhi+Mang+Xing |

**Mixed mode** requires both fonts at that level to be installed and accessible
through Safari. It cannot silently substitute the default font. The CSS
`mixed-fonts.css` shipped with the app contains only local font references and
per-character Unicode routing, *not* the font data itself.

**iPhone limitation:** Fonts installed through the iOS font manager can be
available in native document apps yet inaccessible to Safari/WebKit. Successful
installation in iOS Settings does not guarantee a browser can use that family.
The app intentionally rejects inaccessible fonts. In that case, use Beginner
until a future release can provide licensed, app-bundled fonts.

The app includes several known aliases for each font's Chinese and English
family name. If your installer uses a different internal name, contact the
app maintainer with that precise PostScript or family name; Cíyán can add it to
the list of accepted aliases in a future update. Always check the individual
font's license before sharing, modifying, or embedding the file.

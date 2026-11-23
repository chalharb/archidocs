# Embedded font

`inter-subset.ttf` is [Inter](https://github.com/rsms/inter) Regular (SIL Open Font License 1.1, see `OFL.txt`), from `@fontsource/inter` 5.3.0's `inter-latin-400-normal.woff2`, subset to Latin-1 and a few symbols with no hinting and no layout features, so advance widths alone give a label's width:

```sh
pyftsubset inter-latin-400-normal.woff2 --unicodes="U+0020-007E,U+00A0-00FF,U+2013,U+2014,U+2026,U+2192" \
  --no-hinting --desubroutinize --layout-features='' --output-file=inter-subset.ttf
```

The renderer doesn't read this file at runtime: `node scripts/embed-font.ts` turns it into `src/render/font.ts` (the font as base64 plus its advance widths), which works in Node and the browser alike. Rerun it after changing the font.

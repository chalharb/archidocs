# Embedded fonts

`overpass-400-subset.ttf` and `overpass-700-subset.ttf` are [Overpass](https://github.com/RedHatOfficial/Overpass) Regular and Bold (SIL Open Font License 1.1, see `OFL.txt`), the face the viewer self-hosts and `DESIGN.md` names. Each is a static instance of the viewer's variable `viewer/src/fonts/overpass-latin.woff2`, subset to Latin-1 and a few symbols with no hinting and no layout features, so advance widths alone give a label's width:

```sh
for w in 400 700; do
  fonttools varLib.instancer viewer/src/fonts/overpass-latin.woff2 wght=$w --static --update-name-table -o overpass-$w.ttf
  pyftsubset overpass-$w.ttf --unicodes="U+0020-007E,U+00A0-00FF,U+2013,U+2014,U+2026" \
    --no-hinting --desubroutinize --layout-features='' --drop-tables+=GDEF,GPOS,GSUB,STAT \
    --output-file=assets/fonts/overpass-$w-subset.ttf
done
```

Dropping `GDEF` matters: Overpass classes `·` and the spacing accents (¨, ´, ¯, ¸ and the spacing grave) as combining marks there, so shapers give them no width and `a · b` draws as `a ·b`. Static instances, not the variable font, because resvg picks a face by weight and doesn't vary one. The export draws no ids, so Overpass Mono isn't embedded.

The renderer doesn't read these files at runtime: `node scripts/embed-font.ts` turns them into `src/render/font.ts` (each weight as base64 plus its advance widths), which works in Node and the browser alike. Rerun it after changing a font.

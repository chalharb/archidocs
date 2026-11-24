# How hand-written pages are kept correct

Type: grilling
Status: resolved
Blocked by: –
Map: [Archidocs docs site](../map.md)

## Question

Generated pages can't drift, but hand-written ones can. Decide: link checking in the site build (internal links, and links to the demos and GitHub), and whether code samples are validated, e.g. YAML samples run through `archidocs check` or taken from `examples/kitchen-sink` by reference, and CLI samples run in CI.

## Answer

Generated pages can't drift, so these checks cover only the hand-written ones:

- **Internal links fail the build.** `starlight-links-validator` checks every internal link and anchor. Hand-written pages link to generated rule, flag and tool pages, so renaming one breaks the build wherever a page still uses the old name.
- **External links are checked weekly, outside the build.** A scheduled job (e.g. lychee) checks links to GitHub, npm and the demos, and opens an issue when one breaks. Keeping it out of the build keeps the build from going flaky.
- **YAML samples are included, not typed.** Every Model YAML sample on a hand-written page is pulled from a file in `examples/`, by path and an optional named region. Those files are checked and built on every PR, so a page can't show YAML that `archidocs check` rejects.
- **Failure samples are tested.** Snippets that are wrong on purpose live in `website/samples/`. A test checks that each one fails with exactly the rule the page says.
- **CLI samples are parsed, not run.** Shell snippets stay hand-written, but the build parses every `archidocs …` line against the structured CLI definitions (see the content-sources ticket). An unknown command or flag fails the build.
- **The tutorial has an end-to-end test.** "Model your first system" runs on every PR in a temp folder: `init`, write the files, `check`, `build`. It follows the pattern of the existing `action` CI job.

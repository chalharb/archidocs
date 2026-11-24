# Should check output link to rule pages

Type: grilling
Status: resolved
Blocked by: –
Map: [Archidocs docs site](../map.md)

## Question

Every rule now has a page at `/docs/reference/rules/<rule-id>/`. Should `archidocs check` (text, json, github formats) and MCP `validation_failed` issues include that URL? Consider: the site is latest-only, so a link can describe a newer rule than the installed CLI; offline use; and the agent guide's `rules` topic, which already explains rules locally.

## Answer

**Yes: `check` output links each rule to its page.** The links are always printed, with no flag to turn them off. They're plain text, and nothing is fetched.

| Output | How the link appears |
| --- | --- |
| `--format json` and MCP `validation_failed` | Each issue gains a `docs` field with `https://archidocs.dev/docs/reference/rules/<rule-id>/`. |
| `--format text` | A short **Rule docs** footer after the summary lists the URL once for each distinct rule in the run. Lines stay `file:line  severity  rule  message`. |
| `--format github` | Each annotation's message ends with `See https://archidocs.dev/docs/reference/rules/<rule-id>/`. |

**Agents:** the agent guide's `rules` topic is still the version-matched local source, and `llms.txt` says so (agents-as-readers ticket).

**Older CLIs:** rule pages are **never deleted**. A removed rule keeps a stub page ("Removed in vX.Y: what replaced it"), generated from a `removed` list kept beside the rule registry. That way every URL an older CLI prints still works on the latest-only site.

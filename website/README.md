# The Archidocs docs site

The site at [archidocs.dev](https://archidocs.dev): a landing page, and the docs under `/docs/`. It is built with [Astro Starlight](https://starlight.astro.build) from this repo, so every page matches the commit it was built from.

This file is for maintainers and for agents who write pages. It says how to build and test the site, which template each page follows, and the style rules. Terms follow [GLOSSARY.md](../GLOSSARY.md).

## Build and test

Run these from the repo root, after `pnpm install`.

| Command | What it does |
| --- | --- |
| `pnpm docs:dev` | Serves the site locally and reloads it as you edit. |
| `pnpm docs:build` | Builds the site into `website/dist/`. The build fails on a broken link, on an `archidocs` command line that the CLI wouldn't accept, and on a sample that names a missing file. |
| `pnpm docs:test` | Runs the tests in `website/test/`. They include the template and style checks described [below](#what-the-test-checks). Some of them build the whole site. |

To run only the template and style checks, which read the files and build nothing:

```bash
pnpm --dir website exec vitest run test/templates.test.ts
```

CI also runs `pnpm docs:tutorial`, which follows the tutorial's steps in a temp folder, and `pnpm test:e2e`, which opens the built site in a browser.

## Where things are

| What | Where |
| --- | --- |
| Hand-written pages | `website/src/content/docs/docs/`, one `.mdx` file per page |
| Reference pages | Generated at build time by `website/src/reference/`. They are never committed. |
| Intros of generated Model YAML pages | `website/src/intros/` |
| YAML samples shown on pages | `examples/`, and `website/samples/` for samples that are wrong on purpose |
| Screenshots of the viewer | The shot list in `website/src/screenshots.ts`. The pictures are taken at build time and never committed. |
| Tests | `website/test/` |

## Page types

Every page is one of four types, and does only that type's job. The type decides the folder, the title and the template.

| Type | Its job | Folder | Title |
| --- | --- | --- | --- |
| Tutorial | Teaches a new reader by building one thing from start to finish | `start/` | Names what the reader builds |
| How-to guide | Gets a reader who knows the basics through one task | `guides/<group>/` | Starts with a verb: "Add a Service" |
| Concept | Explains what a thing is and why it works the way it does | `concepts/` | A noun: "Relationships" |
| Reference | Describes every command, field, tool and rule | `reference/` | The name of the thing: "archidocs check" |

A few pages are none of the four: the docs home, a group's index page (`index.mdx`), the other pages in `start/`, the Examples and the Help pages. They follow the style rules and no template.

To add a Help page, put its `.mdx` file in `help/` with the next `sidebar.order`. The sidebar group and the Help index list it with no other change.

## Templates

Each template lists its sections in order. Write the headings exactly as shown: the test matches some of them, and readers learn where to look. Leave a section out only where the template says you can. Never reorder them or add a section of another page type.

### Tutorial

One path from nothing to a working result. It offers no options: where a reader could choose, the tutorial chooses.

| # | Section | What goes in it |
| --- | --- | --- |
| 1 | `## What you'll build` | The result, how long it takes, and where the finished files are |
| 2 | `## Before you start` | What the reader needs installed or set up |
| 3 | Numbered steps: `## 1. Create a Workspace`, `## 2. …` | One action each, in the order the reader does them. Each step ends with the output of its command or a picture of the result. |
| 4 | `## What you learned` | The ideas the steps used, each linked to its concept page |
| 5 | `## Next` | Two or three pages to read next |

````mdx
---
title: Model your first system
description: A slice of Big Bank, from an empty repo to a viewer you can open.
---

## What you'll build

A Workspace with one Project: a customer, a System and its three Services. It takes about twenty minutes.

## Before you start

You need Node.js 22.18 or later and git.

## 1. Create a Workspace

A Workspace is one git repo that holds the whole architecture. Create one:

```bash
git init big-bank
cd big-bank
archidocs init
```

## 2. Check the Workspace

```bash
archidocs check
```

```text
0 errors, 0 warnings
```

## What you learned

- A [Workspace](/docs/concepts/workspace-and-projects/) holds every Project in one repo.

## Next

- [Add a Service](/docs/guides/model/add-a-service/)
````

### How-to guide

One task, for a reader who has done the quick start. The title starts with a verb.

| # | Section | What goes in it |
| --- | --- | --- |
| 1 | The outcome | One sentence under the frontmatter, with no heading, that says what the reader has at the end |
| 2 | The "For agents" pointer | A `:::note[For agents]` callout that links the agent topic for the task. Leave it out when there is no topic. |
| 3 | `## Before you start` | A list of what must be true first, each item linked to the page that gets the reader there |
| 4 | Numbered steps: `## 1. Declare the Service`, `## 2. …` | One action each. Each heading starts with a verb. A short guide can have one step. |
| 5 | `## Check it worked` | What to run or open, and what the reader sees when the task worked |
| 6 | `## If it didn't` | The likely failures: what is printed, and the fix. Link the rule's page. Leave it out when nothing commonly goes wrong. |
| 7 | `## With an agent` | The same task over MCP: the tools that do it, or what to ask. Leave it out when the guide is about setting up the agent itself, or when no MCP tool does the task. |
| 8 | `## Related` | A short list of links: the concept, the reference, the next guide |

A guide holds no field lists and no explanation:

- **Fields:** show one sample per step and link the reference for the rest.
- **Why:** if a step needs a paragraph of why, link the concept page.

````mdx
---
title: Connect Services
description: Declare that one Service depends on another.
---

Declare a Relationship, so the viewer and agents know that one Service depends on another.

:::note[For agents]
The agent topic for this task is [`relationships`](/docs/reference/agent-guide/relationships/).
:::

## Before you start

- Both Services are in the Model. See [Add a Service](/docs/guides/model/add-a-service/).

## 1. Declare the Relationship under the consumer

A Relationship is one Element's dependency on another. Add it under the consumer, with `to` naming the provider:

```yaml file="examples/big-bank/archidocs/payments/model.yaml" region="payments-service"
```

## 2. Check the Workspace

```bash
archidocs check
```

```text
0 errors, 0 warnings
```

## Check it worked

Run `archidocs dev` and select the consumer. The Element panel lists the new Relationship.

## If it didn't

`check` reports [`unknown-element`](/docs/reference/rules/unknown-element/) when `to` names an id that isn't in the Model. Correct the id, or write a Qualified id for a provider in another Project.

## With an agent

[`upsert_relationship`](/docs/reference/mcp/write-tools/#upsert_relationship) adds or updates a Relationship.

## Related

- [Relationships](/docs/concepts/relationships/)
- [Elements and Relationships reference](/docs/reference/model/model-yaml/)
````

### Concept

What one thing is and why it works the way it does. The title is a noun.

| # | Section | What goes in it |
| --- | --- | --- |
| 1 | What it is | Two sentences under the frontmatter, with no heading |
| 2 | The picture | A `<Diagram>` or one YAML sample, with no heading |
| 3 | How it behaves | One or more `##` sections, each named for the behavior it describes: `## One direction` |
| 4 | `## Why it works this way` | The reasoning behind the design |
| 5 | `## Related` | A short list of links: the guides that use it and its reference |

A concept page holds no steps and no field lists:

- **Steps:** no heading starts with a number. A task belongs in a guide; link it.
- **Fields:** the reference lists them; link it. One YAML sample is enough, as illustration.

````mdx
---
title: Relationships
description: Dependencies, declared once under the consumer.
---

A [Relationship](/docs/reference/glossary/#term-relationship) is a directed edge from a consumer Element to the provider it depends on. It is declared once, under the consumer.

```yaml file="examples/big-bank/archidocs/payments/model.yaml" region="payments-service"
```

## One direction

A Relationship always points from what depends to what is depended on. A Person is only ever a consumer.

## Why it works this way

One direction makes impact questions answerable: everything upstream of a provider depends on it, so an outage there reaches all of it.

## Related

- [Connect Services](/docs/guides/model/connect-services/)
- [Elements and Relationships reference](/docs/reference/model/model-yaml/)
````

### Reference

Reference pages are generated. Nothing on them is copied by hand, so they can't disagree with the code.

| # | Section | What goes in it |
| --- | --- | --- |
| 1 | Summary | One or two sentences on what the thing is for |
| 2 | Syntax | The command line, the file's shape or the tool's input |
| 3 | Fields | Every field, flag or argument, with its type, default and description |
| 4 | Examples | A real call or file, with its result |
| 5 | Errors | Exit codes, error codes, or the rules that report on it |
| 6 | See also | Links to the guide and the concept |

The template fixes the order. The heading names belong to each generator, since a command has "Flags" where a file has "Fields".

To change a reference page, change its source, never the page:

| Pages | Source |
| --- | --- |
| CLI | `src/cli/commands.ts` |
| Model YAML | `src/schema/`, and the intro in `website/src/intros/` |
| MCP tools | The tool registrations in `src/mcp/` |
| Check rules | `src/core/rules.ts` |
| CI | `action.yml` and the GitLab template in `templates/gitlab/` |
| Viewer URLs | `URL_PARAMETERS` and `VIEW_ROUTE` in `viewer/src/place.ts`; the worked links in `website/src/reference/viewer-urls.ts` |

A generated command page, as Markdown:

````md
# archidocs check

Validate the Workspace found from the current folder.

## Usage

```text
archidocs check [--format text|json|github] [--strict]
```

## Flags

### `--strict`

`--strict` · Off by default.

Exit 1 on warnings too, not only on errors.

## Examples

```bash
archidocs check --format github
```

## Exit codes

| Code | Meaning |
| --- | --- |
| 0 | No errors |
| 1 | Errors, or warnings with `--strict` |
| 2 | The check could not run |

## See also

- [Check rules](/docs/reference/rules/)
````

## Style rules

1. **One page type per page.** If a guide needs a paragraph of why, link the concept. If a concept needs steps, link the guide.
2. **Guide titles start with a verb. Concept titles are nouns.**
3. **Use the Glossary's terms, capitalized as the Glossary has them.** Don't use a word from a term's "Avoid" list.
4. **Explain a Glossary term the first time a page uses it,** in half a sentence, and link it: "A [Project](/docs/reference/glossary/#term-project), one Team's folder in the Workspace, …".
5. **Show the output after any command whose output the reader acts on,** in a `text` code block right after the command.
6. **Every code block that is a file carries its path as a title.** A sample included with `file="examples/…"` gets its title from the path. Give any other file a `title="…"`.
7. **A callout marks a prerequisite, a pitfall or an agent pointer. Nothing else.** Use `:::note` for a prerequisite, `:::caution` for a pitfall and `:::note[For agents]` for an agent pointer.
8. **Write "coding agent" for the reader's tool, not "harness".** Where a page is about one client, use the client's name.
9. **At most two links in a sentence.**
10. **US spelling is the house spelling:** "organization", "color", "data center". Leave ids, URLs, file names, code and other products' names as they are.
11. **One idea per sentence.** Keep sentences short and plain.

Pages written before these rules may still break them. Fix a page when you rewrite it. New pages follow all of them.

## What the test checks

`website/test/templates.test.ts` checks the rules that a test can. It reads the files; it doesn't build the site.

| Rule | Pages | What fails |
| --- | --- | --- |
| A guide has the two headings | Every page under `guides/`, except an `index.mdx` | No `## Before you start` heading, or no `## Check it worked` heading. Both are second-level, with exactly this text. |
| A concept page follows the concept template | Every page under `concepts/`, except an `index.mdx` | No `## Why it works this way` heading, or no `## Related` heading. Or a heading of any level that starts with a number, or with "Step" and a number: `## 1. Add the file`, `### Step 2` |
| At most two links in a sentence | Every page under `concepts/`, except an `index.mdx` | A sentence with three or more Markdown links. A line break ends a sentence, so each list item and table row counts on its own. |
| No banned word | Every page under `website/src/content/docs/`, and every intro in `website/src/intros/` | A banned word in prose. The list is `BANNED_WORDS` in the test, and today holds "harness". |

The banned-word check reads prose: the frontmatter and the text, not code blocks, inline code or link targets. It matches the start of a word in any case, so "harness" also finds "Harnesses".

**Not-yet-migrated lists.** Each rule has a list of the pages that were written before it and still break it. The lists are in the test file. The test fails in two cases:

- A page that isn't on a rule's list breaks the rule. Fix the page. Don't add it to the list.
- A page on the list now passes, or was renamed or removed. Remove it from the list in the same change.

So a list only gets shorter. When you rewrite a page to its template, take it off the lists.

**To ban another word,** add one line to `BANNED_WORDS`: `{ word: "…", instead: "…" },`. Clear the word from every page in the same change.

## What the build and the other tests check

- **Links:** the build fails on a link to a page or anchor that doesn't exist.
- **Command lines:** every `archidocs …` line in a shell block or in inline code is parsed against the CLI's own definitions, and so is a command after ` -- `, as in `claude mcp add archidocs -- archidocs mcp`. In a JSON or TOML block, each object or table with a `command`, such as an MCP server entry, is read with its `args` as one command. An unknown command or flag fails the build.
- **Samples:** Model YAML is never typed into a page. Include it from a file with an empty fence, `file="examples/…"` and an optional `region="…"`. `website/test/samples.test.ts` fails on Model YAML typed inline.
- **Screenshots:** show the viewer with `<Screenshot id="…" alt="…" />`, where the id is a shot in `website/src/screenshots.ts`. A shot names an example (`big-bank`, `kitchen-sink` or `quick-start`), a viewer URL such as `#/view/c2` and a window size. The build opens the URL on the example's site in Chromium, in light and dark, and fails on an unknown id or on a URL that shows the viewer's error or empty state. A shot of a demo links to the same URL on the live demo. Pictures are cached in `website/node_modules/.cache/`, keyed on the built site and the shot, so an unchanged viewer isn't captured again. The build needs Chromium once: `pnpm exec playwright install chromium`.
- **Troubleshooting quotes:** `website/test/help.test.ts` reads every line of a code block on `help/troubleshooting.mdx` that starts with `archidocs: `. The rest of the line must be a message in `src/`, word for word, where a `${…}` placeholder stands for any text. Reword an error and the test fails until the page quotes the new wording. The test also fails on an entry that links no guide or reference page.
- **Samples that are wrong on purpose:** each lives in `website/samples/` and is shown with `fails="<rule-id>"`. The test checks that it fails `archidocs check` with exactly that rule, and that its page links the rule's page.

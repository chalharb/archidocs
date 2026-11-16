# Archidocs — Requirements

Nov 15, 2026 · @Logan

Archidocs is an npm package that turns a repository of FINOS CALM architecture files into a read-only, linkable static site. The site answers what depends on what, who owns it, why it is built this way and what changed. This document defines the first release as 19 requirements, each tied to a user job and a check, followed by a roadmap of the features meant to set it apart from Structurizr and LikeC4.

## Problem

A team that keeps its architecture as code has the facts but no way to read them. The model is JSON, the decisions are Markdown files and the history is in git, so answering "what breaks if this database is down?" means opening files and following ids by hand.

Archidocs reads those files as they are and publishes a site anyone on the team can browse and link to. It never writes to them.

## Users and jobs

Archidocs has two users: the reader who needs to understand a system, and the author who installs the package and maintains the model.

**First user: the builder.** There is no outside team yet. Work is done against reference models of the kind other tools use as examples, such as "Big Bank plc", and moves to a real team's model as soon as one exists.

| Job                                                                                | User   | Why it matters                                                                            |
| ---------------------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------- |
| J1. See what an element depends on and what depends on it                          | Reader | Impact of a change or an outage                                                           |
| J2. Find every diagram that shows an element                                       | Reader | Move between levels of detail                                                             |
| J3. Find a view or element by name or technology                                   | Reader | Entry point for someone who does not know the structure                                   |
| J4. Learn who owns an element or boundary                                          | Reader | Who to ask, who to page                                                                   |
| J5. Understand why the architecture looks this way                                 | Reader | Decisions outlive the people who made them                                                |
| J6. See what changed, when and by whom                                             | Reader | Review and audit                                                                          |
| J7. Send a colleague a link that shows exactly what I see                          | Reader | Architecture questions are asked in chat and tickets                                      |
| J8. Know my model is valid before I merge                                          | Author | Errors found in review cost less than errors found on the site                            |
| J9. Publish without running or operating anything                                  | Author | A docs site nobody has to keep alive                                                      |
| J10. Go from nothing to a working site with one install and one config file        | Author | Trying it has to cost minutes, or nobody switches                                         |
| J11. Keep the model healthy as it grows                                            | Author | Models rot quietly: orphans, missing owners, dead decision links                          |
| J12. Ask a question in plain language and get an answer that cites the model       | Reader | Faster than browsing, and checkable                                                       |
| J13. See what a proposed change affects before it merges                           | Author | Review needs the blast radius, not only the diff                                          |
| J14. Create or change a diagram by describing it, without opening the source files | Author | Hand-writing model JSON is the biggest barrier to starting and to keeping a model current |

J1 to J11 are served by the first release. J12 to J14 are served by the roadmap.

## Success criteria

The first release succeeds when architecture published with it is easy to consume and easy to maintain. No time limits are set.

1. A reference model the size of "Big Bank plc" is published with Archidocs from its own repository.
2. Someone new goes from installing the package to a published site by following the README alone.
3. Easy to consume: a reader answers J1 to J6 for any element without opening a source file.
4. Easy to maintain: a change to the architecture needs edits to model files only, and validation says what is wrong and where before merge.
5. Publishing needs no running service: the output is a folder of files.
6. Every automated check runs on a clean checkout with no deployment and no paid service.

## Principles

These constrain every requirement and every later addition.

- **Reference model first.** Work starts from a realistic reference model in its own repository, and from a real team's files once a team exists. Sample content inside the package exists only as test fixtures and the `init` starter.
- **Thin slices.** Each slice in the build order is used on the reference model before the next one starts.
- **Static first.** The site is files. A server is added only for a shipped feature that cannot work without one, and it is added beside the site, not under it.
- **Read-only.** No screen creates, edits or deletes content.
- **Content is plain files in the author's repository.** The model stays valid CALM and readable without Archidocs.
- **One bad file never breaks the site.**
- **Nothing to build on the consumer's side.** The package ships a finished viewer. The consumer installs, configures and runs a command.
- **Outcomes, not screens.** A requirement says what a user can do. It does not name a component, a width or a string.
- **Technology is not a requirement.** Technology choices are listed under Decisions and recorded as decision records in the repository.
- **Nothing is required without a job.** A new requirement cites J1 to J14 or a request from a named user.
- **Every requirement has a check.** One that cannot be checked is rewritten or removed.
- **Process scales with users.** No release ceremony or paid test infrastructure until someone depends on the result.
- **Code explains itself.** Comments describe behaviour and do not depend on this document or on ticket numbers.

## Requirements

These 19 requirements are the whole of the first release: 15 for the site and 4 for how it is packaged.

| ID  | Requirement                                                                                                                                                                                                                                                                                                       | Job    | Check                                                                                        |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------- |
| R1  | One command validates a model folder against the model format's schema plus reference checks, and reports each problem with its file and location. It runs in the author's repository without building the site.                                                                                                  | J8     | Invalid fixtures produce the expected report and exit code                                   |
| R2  | An invalid file shows its errors in place of its views. Every other view still builds.                                                                                                                                                                                                                            | J8, J9 | Build with one broken fixture; the other views render                                        |
| R3  | The build writes a folder that any static host can serve. No server, database or runtime secret is involved.                                                                                                                                                                                                      | J9     | End-to-end tests pass against the folder behind a plain file server                          |
| R4  | Each view shows its elements, relationships and nesting groups, laid out automatically at build time.                                                                                                                                                                                                             | J1, J2 | Layout snapshots; every fixture view renders                                                 |
| R5  | Element types and relationship kinds are visually distinct, and a legend explains those used in the view. An unknown type falls back to a default style and warns.                                                                                                                                                | J1     | Fallback fixture renders with a warning                                                      |
| R6  | Selecting an element shows its name, type, technology, description and owner, and highlights its direct relationships. Owner is inherited from its container unless set.                                                                                                                                          | J1, J4 | Unit tests for owner inheritance; one end-to-end selection test                              |
| R7  | An element lists what it calls and what calls it, taken from the whole model, not only the current view. Picking one goes to it, changing view when needed.                                                                                                                                                       | J1     | Unit tests for the target-view rule; one cross-view end-to-end test                          |
| R8  | An element lists every view that shows it, and each entry opens that view.                                                                                                                                                                                                                                        | J2     | One end-to-end test                                                                          |
| R9  | Views are listed in groups, in an order the author controls.                                                                                                                                                                                                                                                      | J2, J3 | Unit test for ordering                                                                       |
| R10 | Search finds views and elements by name, technology, type and id, and works from the keyboard.                                                                                                                                                                                                                    | J3     | Unit tests for matching; one keyboard end-to-end test                                        |
| R11 | Decision records show status, date and supersede links, and link to the views and elements they affect. Views and elements list their decisions.                                                                                                                                                                  | J5     | Parser unit tests; one end-to-end test                                                       |
| R12 | The site lists changes to the model newest first, each with what changed, when, by whom and the views touched. Entries come from commit history and nowhere else.                                                                                                                                                 | J6     | Diff unit tests; the build fails loudly when history is incomplete                           |
| R13 | A URL reproduces the view and selection. Back and Forward work. A stale link shows a not-found message with a way back.                                                                                                                                                                                           | J7     | Unit tests for URL state; one end-to-end test each                                           |
| R14 | Every control is reachable by keyboard, exposes its state to assistive technology, and text meets 4.5:1 contrast.                                                                                                                                                                                                 | All    | Automated accessibility scan; contrast check                                                 |
| R19 | Every laid-out view is drawn cleanly: no element overlaps another element; every element sits inside its group's border; no edge passes through an element it does not connect; every edge label sits on its own edge and overlaps no element and no other label. Edge crossings are minimised but not forbidden. | J1, J2 | A geometry test runs over the layout output of every fixture view and fails on any violation |

### Packaging

| ID  | Requirement                                                                                                                                                                                                                                                                        | Job    | Check                                                                                       |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------- |
| R15 | Installing one npm package gives a command-line tool with `init`, `validate`, `dev` and `build`. The consumer runs no bundler and needs no web framework.                                                                                                                          | J10    | In an empty folder, install the packed package, run `init` then `build`, and the site loads |
| R16 | One config file beside the model defines the workspace: name, title, where the model, decisions and notation live, the repository link and the site's base path. It can be TypeScript or JSON with a schema.                                                                       | J10    | Schema tests; an invalid config names the field at fault                                    |
| R17 | The built site works from a plain file server and under a sub-path, deep links included.                                                                                                                                                                                           | J7, J9 | End-to-end tests run once at the root and once under a sub-path                             |
| R18 | `validate` also reports model health: elements in no view, elements with no owner, elements with no relationships, decision records that point at ids that no longer exist, and views with more elements than a set limit. These are warnings unless the config makes them errors. | J11    | One fixture per rule                                                                        |

A config looks like this:

```ts
import { defineConfig } from "archidocs";

export default defineConfig({
  name: "big-bank",
  title: "Big Bank plc",
  model: "architectures/*.json",
  decisions: "docs/adr",
  notation: "c4",
  repository: { url: "https://github.com/acme/architecture", branch: "main" },
  site: { base: "/" },
});
```

### Config schema

The config is defined by one schema, and the TypeScript `defineConfig` type is generated from the same source so the two cannot drift. Only `name` and `model` are required, and unknown keys are rejected so a mistyped field is reported.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "Archidocs config",
  "type": "object",
  "additionalProperties": false,
  "required": ["name", "model"],
  "properties": {
    "$schema": { "type": "string" },
    "name": {
      "description": "Workspace id, used in URLs.",
      "type": "string",
      "pattern": "^[a-z0-9][a-z0-9-]*$"
    },
    "title": {
      "description": "Display name. Defaults to name.",
      "type": "string"
    },
    "model": {
      "description": "Glob or globs for the CALM architecture files, relative to this file.",
      "oneOf": [
        { "type": "string" },
        { "type": "array", "items": { "type": "string" }, "minItems": 1 }
      ]
    },
    "decisions": {
      "description": "Folder of decision records.",
      "type": "string",
      "default": "docs/adr"
    },
    "notation": {
      "description": "Built-in notation name.",
      "enum": ["c4"],
      "default": "c4"
    },
    "repository": {
      "type": "object",
      "additionalProperties": false,
      "required": ["url"],
      "properties": {
        "url": { "type": "string", "format": "uri" },
        "branch": { "type": "string", "default": "main" }
      }
    },
    "site": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "base": {
          "description": "Path the site is served under.",
          "type": "string",
          "pattern": "^/",
          "default": "/"
        }
      }
    },
    "checks": {
      "description": "Model health rules from validate (R18). Each is off, warn or error.",
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "elementInNoView": { "$ref": "#/$defs/level" },
        "elementWithoutOwner": { "$ref": "#/$defs/level" },
        "elementWithoutRelationships": { "$ref": "#/$defs/level" },
        "decisionRefersToMissingId": { "$ref": "#/$defs/level" },
        "viewTooLarge": { "$ref": "#/$defs/level" },
        "maxElementsPerView": { "type": "integer", "minimum": 1, "default": 30 }
      }
    }
  },
  "$defs": {
    "level": { "enum": ["off", "warn", "error"], "default": "warn" }
  }
}
```

- `notation` accepts only `c4` until configurable notation is built.
- `maxElementsPerView` defaults to 30 as a placeholder, to be set once the reference model shows what a readable view holds.
- The `checks` keys map one to one to the rules in R18.

## Build order

The requirements are built in four slices, and each one is used on the reference model before the next starts.

1. **Install and validate.** R15 (`init` and `validate` only), R16, R1, R2 and R18. No site yet.
2. **See a view.** R3, R4, R5, R13, R17 and R19, with the `dev` and `build` commands: a static site with diagrams and links that can be shared.
3. **Understand an element.** R6, R7, R8 and R9.
4. **Find and explain.** R10, R11 and R12.

R14 applies to every slice from the second on.

## Design

The design reference is the [Archidocs Prototype](https://claude.ai/artifact/AVwwNUMAY32k7BSS3JvtKJ#play-15dd8cd198dd): one interactive screen at 1440 × 900 with a dark theme, set in Geist and Geist Mono. It covers the diagram canvas with its inspectors, search, decision records and the changelog.

The prototype sets the look, layout and interaction model of the viewer. It is a reference and not a requirement, so these rules apply:

- **The requirements win.** Where the prototype shows something outside the 19 requirements, that part is not built in the first release. This covers the project switcher, the group inspector, the view info panel and the notation view, which are all under Later, when asked.
- **Match the design, not the pixels.** Colours, type, spacing and the arrangement of the screen follow the prototype. Exact widths and strings are not checked.
- **Requirements the prototype does not show still hold.** The prototype keeps all state in memory, so shareable links (R13) have no design yet. Sub-path hosting (R17) and the clean-layout rules (R19) are also not shown.

### Branding

The logo is option C, "Doorway tile": a rounded square tile with an arched doorway cut through it and a violet keystone above the arch. It is a light tile on dark backgrounds and a dark tile on light ones.

- It sits beside the "Archidocs" wordmark in the site header.
- It is the favicon and the app icons, and it must stay legible at 16 px.
- It is the mark on the package's README and npm page.

The prototype shows it in the sidebar header, redrawn from the option sheet.

## Roadmap after the first release

These releases carry the features meant to set Archidocs apart. Each starts only when the one before is in use on the reference model.

| Release                 | Adds                                                                                                                                                                                                                                                                                                                                   | Job        | Effort          |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | --------------- |
| 2. Ask the architecture | An `mcp` command: a local server an assistant runs from the repository, with exact graph queries for dependencies, dependents, paths, owners, decisions and changes. Every answer cites element and view ids with deep links. The build also writes an index file an assistant can read with no server.                                | J12        | Medium          |
| 3. Describe to diagram  | An agent skill plus write tools on the same server, so an author creates or changes a diagram by describing it to an assistant and never has to open the source. The assistant writes plain CALM files in the repository, `validate` runs on every change, and the `dev` preview shows the result. The published site stays read-only. | J14        | Medium to large |
| 4. Change review        | An impact check for a pull request that lists the affected elements, views, decisions and owners. A page that compares two git refs as a view of added, removed and changed elements.                                                                                                                                                  | J13, J6    | Medium          |
| 5. Model insight        | An ownership and decision coverage report per team. A path explorer between any two elements, with the path in the URL.                                                                                                                                                                                                                | J4, J1, J5 | Small to medium |
| 6. Hand-placed layout   | Saved positions keyed by stable element ids, so they survive renames, with layout drift reported by `validate`.                                                                                                                                                                                                                        | J11        | Small to medium |
| 7. In-app chat          | A chat panel on the same query tools and citations. It needs a small service beside the static site.                                                                                                                                                                                                                                   | J12        | Large           |

## Later, when asked

None of these is planned. Each has the condition that would justify it.

| Item                                                    | Build when                                                          |
| ------------------------------------------------------- | ------------------------------------------------------------------- |
| Notation the author can configure                       | A real model uses element types the default notation cannot express |
| More than one project per site                          | A second real project exists                                        |
| Step-by-step flow views and deployment views            | A model includes flows or deployments and a reader asks to see them |
| Details for groups and boundaries                       | Owner on the element (R6) is not enough                             |
| Export to image, PDF, PlantUML or Mermaid               | A reader needs diagrams outside the site                            |
| Light mode, remembered preferences, small-screen layout | A reader asks                                                       |
| Built-in sign-in or a single sign-on wrapper            | Access control in front of the site is not enough                   |

## Positioning

Archidocs is the polished viewer for an open standard, with decisions and change history attached to the model. An MCP endpoint alone does not set it apart, because LikeC4, IcePanel and Archyl already have one.

| Where Archidocs differs                                           | What the others do                                                                                                                                                            |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The model is FINOS CALM, an open standard                         | Structurizr, LikeC4, Ilograph and IcePanel each use their own format. CALM's own site generator is basic                                                                      |
| A decision record links to any number of elements and views (R11) | [Structurizr](https://docs.structurizr.com/dsl/adrs) attaches a record to one workspace, system or container. None was found in LikeC4                                        |
| Per-element change history from git, inside a static site (R12)   | No competitor was found documenting this                                                                                                                                      |
| Answers that cite elements and views with links back (release 2)  | [LikeC4](https://likec4.dev/tooling/mcp/) ships 22 MCP tools, and [IcePanel](https://docs.icepanel.io/integrations/mcp-server) has a remote MCP, but none documents citations |
| Model health checks beyond missing descriptions (R18)             | Structurizr's inspection flags missing descriptions and technology                                                                                                            |
| Free and static                                                   | [Structurizr server](https://docs.structurizr.com/server/pricing) starts at £300 a month and IcePanel is hosted only. LikeC4 is also free and static                          |

Against [Archify](https://github.com/tt-a1i/archify) the difference is what the prompt produces. Archify turns a description into one self-contained HTML diagram with no model behind it. Release 3 turns a description into CALM files that are validated, versioned in git, linked to decisions and queryable, and the same site is rebuilt from them.

Accepted gaps in the first release, which a prospective user will notice:

- No editor or editor extension. LikeC4 has a VS Code extension and IcePanel a visual editor.
- No dynamic or deployment views. LikeC4 and Structurizr have both.
- No export to image, PDF, PlantUML or Mermaid.
- No comments, drafts or collaboration.
- No ecosystem, and one developer behind it.

This comes from a review of vendor documentation on 15 November 2026 and has not been checked independently. Evidence of user complaints was thin, and several vendor pages failed to load.

## Non-goals

- Editing diagrams or models in the browser.
- Sign-in, roles or administration built into the app. Access control sits in front of the site.
- Server-side state of any kind.
- A general diagramming tool. Archidocs draws what the model says.
- Replacing the model format's own validation tools.
- Matching a prototype or mock-up pixel for pixel.

## Decisions

These are settled. Each becomes a decision record in the repository when work starts.

| Topic                 | Decision                                                                   | Note                                                                                                |
| --------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| First user            | The builder, using reference models such as "Big Bank plc"                 | Moves to a real team's model when one exists                                                        |
| Build or adopt        | Build                                                                      | Structurizr, LikeC4 and Archify (tt-a1i/archify) each have gaps that matter here                    |
| Model format          | FINOS CALM                                                                 |                                                                                                     |
| LLM and MCP           | A goal and a differentiator, not the goal                                  | Releases 2, 3 and 7                                                                                 |
| Change history source | Commit history                                                             | Confirmed; R12 states it                                                                            |
| Access                | Host access control in front of the static site                            | A single sign-on wrapper or login may come later                                                    |
| Success measure       | Easy to consume and easy to maintain                                       | No time limits                                                                                      |
| Distribution          | One npm package holding the command-line tool and a prebuilt viewer        | Split into separate packages only when someone needs to embed a part                                |
| Viewer                | A Vite and React single-page app that reads data files at runtime          | Not Next.js: its static export must know every route when built, before any consumer's model exists |
| Routing               | TanStack Router                                                            | Typed URL search parameters suit R13                                                                |
| Interface             | shadcn/ui, Tailwind CSS and React Flow                                     |                                                                                                     |
| Layout engine         | elkjs, at build time only                                                  | It never enters the viewer bundle                                                                   |
| Command-line tool     | Node, a small command library, bundled before publishing                   | `dev` runs Vite's dev server plus a file watcher                                                    |
| Package name          | archidocs                                                                  | Available on npm, as checked by the owner                                                           |
| Authoring by prompt   | An author can describe a diagram to an assistant instead of editing source | Release 3. The output is still plain CALM in the repository                                         |
| Design reference      | The Archidocs Prototype canvas                                             | A reference for look and interaction; the requirements win where they differ                        |
| Logo                  | Option C, "Doorway tile"                                                   | Chosen from six options                                                                             |

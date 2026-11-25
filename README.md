<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/brand/archidocs-mark-light.svg">
    <img src="assets/brand/archidocs-mark-dark.svg" alt="Archidocs" width="72">
  </picture>
</p>

<h1 align="center">Archidocs</h1>

<p align="center">Git-native architecture as code. Each Team declares its slice of the architecture as YAML; Archidocs validates it, combines it into one Model, and publishes a diagram viewer for people and an MCP server for agents.</p>

---

## Why

- **Diagrams that don't go stale.** Every diagram is generated from the validated Model at a commit, never drawn by hand.
- **Ownership is first-class.** Every Element has exactly one Owner Team, shown on every node.
- **One answer, many Teams.** Each Team keeps its own Project folder in one Workspace repo. Archidocs merges them, so nobody has to ask around.
- **Every screen is a link.** Any view in the viewer can be shared by URL and saved as View YAML.
- **Same answers for people and agents.** What the viewer shows, the MCP server can answer, and agents can edit the Model through it.

The questions it's built to answer:

| Who | Question |
| --- | --- |
| Enterprise Architect | How are two Services connected? |
| Solutions Architect | Where is a Service deployed? |
| Developer | What does my Team own? |
| Product Owner | What is upstream and downstream of an outage? |
| QA Tester | What is a Service's URL in a given Environment? |
| Technical staff | Which decisions sit behind an Element, and how has the system changed? |

## Quick start

From an empty repo to your first System in the viewer, in about five minutes. Archidocs needs Node.js 22.18 or later.

**1. Install the CLI.** With pnpm, use `pnpm add --global archidocs`. To install nothing, put `npx` before each command, as in `npx archidocs check`.

```bash
npm install --global archidocs
```

**2. Create a Workspace.** In the repo that will hold it (a new, empty one is fine):

```bash
archidocs init
```

This writes a starter `archidocs/workspace.yaml`, adds the `.archidocs/` cache to `.gitignore`, and installs an authoring skill for coding agents.

**3. Add three files.** Replace `archidocs/workspace.yaml`, which defines Teams and Environments, with:

```yaml
teams:
  storefront:
    name: Storefront
environments:
  prod:
    name: Production
```

Give the Team a Project folder, marked by `archidocs/shop/project.yaml`:

```yaml
id: shop
name: Shop
owner: storefront
```

Declare a Person, and a System that holds two Services, in `archidocs/shop/model.yaml`:

```yaml
people:
  shopper:
    name: Shopper
    relationships:
      - to: web
        description: Browses and buys using
systems:
  online-shop:
    name: Online Shop
    services:
      web:
        name: Web
        technology: TypeScript, React
        relationships:
          - to: api
            description: Places orders through
            technology: JSON/HTTPS
      api:
        name: API
        technology: Node.js
```

**4. Check it.**

```bash
archidocs check
```

```text
0 errors, 0 warnings
```

**5. Open the viewer.**

```bash
archidocs dev
```

Open <http://localhost:4321>. The viewer starts on the C2 Landscape, which shows the Shopper and the Online Shop; select the arrow button on the Online Shop box to see the two Services inside it. The viewer reloads as you edit the files.

The finished Workspace is in [examples/quick-start](examples/quick-start).

## The Model

A Workspace is one repo. `workspace.yaml` defines Teams and Environments; each Project folder, marked by a `project.yaml`, declares one Team's Elements, Relationships, Deployments and Saved Views.

```text
archidocs/
├── workspace.yaml        # Teams and Environments
├── payments/
│   ├── project.yaml      # id, name, owner Team
│   ├── model.yaml        # Systems, Services, Components, Relationships
│   ├── deployments.yaml  # which Service runs where, and its URL
│   └── views.yaml        # Saved Views
└── core/
    └── ...
```

```yaml
# payments/model.yaml
systems:
  payments:
    name: Payments
    services:
      payments-service:
        name: Payments Service
        technology: Java, Spring Boot
        relationships:
          - to: payments-db
            description: Stores payment state in
          - to: core:mainframe            # another Project's Element
            description: Posts payments to the ledger in
      payments-db:
        name: Payments DB
        type: datastore
```

```yaml
# payments/deployments.yaml
deployments:
  - service: payments-service
    environment: prod
    target: platform:eks-prod
    url: https://payments.bigbank.example
```

The terms (Workspace, Project, Element, Relationship, Team, Environment, Deployment Target and more) are defined in [GLOSSARY.md](GLOSSARY.md). Every check rule is listed in [docs/rules.md](docs/rules.md).

## CLI

| Command | What it does |
| --- | --- |
| `archidocs init [--skill]` | Set up a Workspace, or with `--skill` install only the agent skill in a code repo. |
| `archidocs check [--strict]` | Validate the Workspace. Formats: `text`, `json`, `github`. |
| `archidocs dev` | Serve the viewer locally with live reload. |
| `archidocs build [--out <dir>]` | Build the static viewer site with past Revisions. `--preview` builds a PR preview. |
| `archidocs export <view-id>` | Render a View to SVG or PNG, styled like the viewer; `--all-saved` renders every Saved View, `--theme dark` draws it in the viewer's dark palette and `--label <text>` replaces the source line. |
| `archidocs diff <from> [<to>]` | Show what changed in the Model between two refs. |
| `archidocs mcp` | Run the MCP server over a Workspace checkout or a published Bundle. |
| `archidocs guide [topic]` | Print the authoring guide for agents. |
| `archidocs version` | Print the CLI and Bundle schema versions. |

## Publishing

`archidocs build` writes a fully static site with relative URLs and hash routing, so any static host can serve it. The GitHub Action checks, builds and deploys to GitHub Pages:

```yaml
# .github/workflows/architecture.yml
on:
  push:
    branches: [main]
    tags: ["*"]

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  publish:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.archidocs.outputs.page-url }}
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: chalharb/archidocs@v1
        id: archidocs
```

A failed check deploys nothing, so the last good site stays up. GitLab Pages, PR previews, Saved View images for wikis, and other hosts are covered in [docs/publishing.md](docs/publishing.md); the GitLab template is in [templates/gitlab](templates/gitlab).

## Agents and MCP

`archidocs mcp` serves the Model to AI agents. Read tools answer the same questions as the viewer; write tools (`upsert_element`, `upsert_relationship`, `upsert_deployment`, `upsert_view`, `propose_adr` and more) edit the YAML in place, keep comments and formatting, return a diff, and refuse any change that would fail `archidocs check`.

```bash
archidocs mcp --workspace ./archidocs
```

`archidocs init` installs the authoring skill into `.agents/skills`, `.claude/skills` and `.github/skills`. The full guide is in [guide/SKILL.md](guide/SKILL.md) with task topics in [guide/topics](guide/topics).

## Examples

| Example | What it shows | Source | Demo |
| --- | --- | --- | --- |
| Big Bank plc | A fictional bank with five Teams, two Environments and a history of Revisions to browse and compare. | [examples/big-bank](examples/big-bank) | [big-bank.archidocs.dev](https://big-bank.archidocs.dev) |
| Kitchen sink | Every feature of the Model in one Workspace. | [examples/kitchen-sink](examples/kitchen-sink) | [kitchen-sink.archidocs.dev](https://kitchen-sink.archidocs.dev) |

## Development

Run `pnpm install`, then `pnpm dev` to serve the viewer and `pnpm test` to run the tests.
To run the other checks, work on the docs site or open a pull request, see [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)

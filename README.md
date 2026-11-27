<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/brand/archidocs-mark-light.svg">
    <img src="assets/brand/archidocs-mark-dark.svg" alt="Archidocs" width="72">
  </picture>
</p>

<h1 align="center">Archidocs</h1>

<p align="center">Git-native architecture as code. Each Team declares its slice of the architecture as YAML; Archidocs validates it, combines it into one Model, and publishes a diagram viewer for people and an MCP server for agents.</p>

<p align="center"><a href="https://archidocs.dev/docs/">Read the docs at archidocs.dev</a></p>

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

From an empty repo to your first System in the viewer, in about five minutes. Archidocs needs Node.js 22.18 or later. There is nothing to install: `npx` runs the CLI.

**1. Create a Workspace** in the repo that will hold it (a new, empty one is fine):

```bash
npx archidocs init
```

`init` writes a starter `archidocs/workspace.yaml` and installs an authoring skill for coding agents.

**2. Add three files.** Replace `archidocs/workspace.yaml`, which defines Teams and Environments, with:

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

**3. Check it.**

```bash
npx archidocs check
```

```text
0 errors, 0 warnings
```

**4. Open the viewer.**

```bash
npx archidocs dev
```

Open <http://localhost:4321>. The viewer starts on the C1 Landscape, which shows the Shopper and the Online Shop. Choose **Go deeper › C2 Landscape** and select the arrow button on the Online Shop box to see the two Services inside it. The finished Workspace is in [examples/quick-start](examples/quick-start).

## More

- **The Model.** A Workspace holds one Project folder per Team, each declaring its Elements, Relationships, Deployments and Saved Views. See [Workspace and Projects](https://archidocs.dev/docs/concepts/workspace-and-projects/) and the [Glossary](https://archidocs.dev/docs/reference/glossary/).
- **CLI.** `init`, `check`, `dev`, `build`, `export`, `diff`, `mcp`, `guide` and `version`: see the [CLI reference](https://archidocs.dev/docs/reference/cli/). Each `check` issue links to its [rule](https://archidocs.dev/docs/reference/rules/).
- **Publishing.** `archidocs build` writes a static site for any host, and a GitHub Action deploys it: see [Publish to GitHub Pages](https://archidocs.dev/docs/guides/publish/github-pages/), [GitLab Pages](https://archidocs.dev/docs/guides/publish/gitlab-pages/) and [other hosts](https://archidocs.dev/docs/guides/publish/other-hosts/).
- **Agents and MCP.** `archidocs mcp` serves the Model to agents and can edit it in place: see [Agents and MCP](https://archidocs.dev/docs/concepts/agents-and-mcp/).

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

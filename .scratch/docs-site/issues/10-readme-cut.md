# What the README keeps

Type: grilling
Status: resolved
Blocked by: –
Map: [Archidocs docs site](../map.md)

## Question

Once archidocs.dev exists, what stays in the README (the GitHub and npm front page) and what becomes a link? Today the README has the pitch, persona table, Quick start, Model overview, CLI table, Publishing, Agents and MCP, Examples and Development. Which sections stay, which are cut to a line plus a link, and how is the README kept in step with the site?

## Answer

The README is the front page on GitHub and npm, cut from 182 lines to **about 70**.

**Keeps:**
- The logo and pitch, with an archidocs.dev docs link under the pitch.
- **Why**: the bullets and the persona table.
- **Quick start**: install, `init`, `check`, `dev`.
- **Examples**: the table with its demo links.
- **Development** and **License**.

**Shrinks to one or two sentences plus a link:**

| Section | Links to |
| --- | --- |
| The Model | Concepts |
| CLI | Reference › CLI (the full command table goes) |
| Publishing | Guides › Publish (the Action YAML goes) |
| Agents and MCP | Concepts › Agents and MCP |

**Kept in step by hand, then checked:** the README stays hand-written. The CLI-line check from the hand-written-correctness ticket also runs over `README.md`, and its links go through the weekly external link check.

**Timing:** the cut lands in the same PR that first deploys the site, so the links it points to exist from day one.

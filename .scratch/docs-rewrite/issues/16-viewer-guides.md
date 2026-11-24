# 16: "Use the viewer" guides

Status: ready-for-agent
Blocked by: 07, 15
Spec: [Docs rewrite proposal](../spec.md)

## What to build

A new `guides/viewer/` group. Each page answers one of the persona questions in `PRODUCT.md`, shows the screen that answers it, and ends with the same question asked over MCP.

| Page | Question | Covers |
| --- | --- | --- |
| Find an Element | What does my Team own? | Find (`/`), the Model, Teams and Views trees, the Element panel, the Team Lens |
| Trace impact and paths | What is upstream and downstream of an outage? How are two Services connected? | The Impact and Connect to… Lenses |
| See where a Service runs | Where is a Service deployed, and at which URL? | Where is it deployed?, Deployment Views |
| Compare two Revisions | How has the system changed? | History, Compare, the ADR reader |
| Share or save what's on screen | | Copy link, Save as View, downloading a picture |

- Each page follows the how-to template and uses screenshots from the Big Bank demo.
- Fold `concepts/viewer` into these pages and "How Archidocs works", and redirect its URL to the group's index.
- Repoint the landing page's "How the viewer works" link.
- The introduction's persona table links each question to its guide.

## Acceptance criteria

- [ ] The five pages exist under a "Use the viewer" group and pass the template test.
- [ ] Each page has at least one `<Screenshot>` and a link that opens the same screen on the demo.
- [ ] Each of the six persona questions is answered on one of the pages, with its MCP tool.
- [ ] `/docs/concepts/viewer/` redirects, and no page links the old URL.

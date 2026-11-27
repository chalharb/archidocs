# Accessibility

Archidocs is for everyone who needs to understand a system's architecture, including people who use a keyboard, a screen reader, magnification or reduced motion. This file says what we aim for, what we check, what we know falls short, and how to report a barrier.

## What we aim for

The viewer and the docs site at [archidocs.dev](https://archidocs.dev) aim to meet [WCAG 2.2](https://www.w3.org/TR/WCAG22/) level AA. In practice:

- **Keyboard:** every flow works without a mouse, including selecting and picking nodes on a diagram, with a visible focus indicator.
- **Contrast:** text and non-text elements (node frames, edges, icons, focus rings) meet AA contrast.
- **Colour:** no meaning is carried by colour alone. An Element's Team, for example, is always written as well as coloured.
- **Motion:** animated transitions are off when the system asks for reduced motion, and above 100 nodes for everyone.
- **Semantics:** controls expose their state to assistive technology, such as which node is selected, which Step of a Dynamic View is current, and which toggle is pressed.

The same Model is also available as text, through `archidocs` commands and the MCP server, for anyone who prefers it to a diagram.

## What we check

- The viewer's browser tests (`e2e/`, run on every pull request) drive the main flows by keyboard and check the state exposed to assistive technology (`aria-selected`, `aria-current`, `aria-pressed`). One suite runs with reduced motion turned on.
- Design changes are reviewed against the accessibility rules in [PRODUCT.md](PRODUCT.md) and [DESIGN.md](DESIGN.md).

## Known gaps

- Archidocs hasn't had an independent accessibility audit.
- No automated checker, such as axe, runs in CI yet.
- Exported Views have no text alternative. An SVG keeps its labels as text but has no title, description or structure for a screen reader to follow, and a PNG is only a picture. Share the View's viewer link, or the Model itself, alongside an exported image.

## Report a barrier

Open a [bug report](https://github.com/chalharb/archidocs/issues/new?template=bug_report.yml&labels=accessibility) with the `accessibility` label. Say what you were trying to do, what got in the way, and what you use (browser, assistive technology, operating system).

An accessibility barrier is a bug, not a feature request. One that stops someone from finishing a core task, such as reading a View, finding an Element or following a Relationship, is triaged as `P0` or `P1`.

## Contributing

A pull request that changes the viewer or the docs site keeps to the aims above, and its Verification section says how it was checked with the keyboard and, for visual changes, for contrast. See [CONTRIBUTING.md](CONTRIBUTING.md).

# 17: "Why Archidocs" and Modelling guidelines

Status: done
Blocked by: 07
Spec: [Docs rewrite proposal](../spec.md)

## What to build

**`start/why-archidocs`:** what it's for and what it isn't, for someone choosing a tool.

- The problem: diagrams drawn by hand go stale, and no one Team holds the whole picture.
- What's different: one validated Model, an Owner on every Element, a URL per Environment, impact questions, the same answers for people and agents.
- When it isn't the right tool.
- It names no other tool ([ticket 01](01-decisions.md)). It describes kinds of approach instead: diagrams drawn by hand, diagrams as code, a service catalog.
- No testimonials or figures: `PRODUCT.md` says none exist.

**`concepts/modelling-guidelines`:** the judgement calls the reference can't make.

- How much detail to model, and when to add Components.
- System or Service; when something is External.
- Naming ids so they survive a rename of the display name.
- When to split a Project, and who declares shared Deployment Targets.
- When a question deserves a Saved View.

Take the guidance from `guide/` and the v1 tickets, so people and agents are told the same thing.

## Acceptance criteria

- [x] Both pages exist and are linked from the docs home.
- [x] The page names no other product.
- [x] Nothing in the modelling guidelines contradicts the agent guide in `guide/`.

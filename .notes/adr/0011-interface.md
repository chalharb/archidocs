# 0011. Interface

- Status: Accepted
- Date: 2026-11-15

## Context and problem statement

The viewer needs accessible components, a token-driven dark theme and a diagram canvas.

## Decision

shadcn/ui, Tailwind CSS and React Flow.

The interface uses shadcn/ui components on Tailwind CSS, and React Flow for diagrams. The foundation sets up shadcn/ui and Tailwind; React Flow is added with the first slice that draws a view.

## Consequences

- Good: components are copied into the repository and owned.
- Bad: updates to copied components are manual.

---
status: accepted
date: 2025-03-10
decision-makers: [core-banking, digital-banking]
elements: [mainframe, digital:mainframe-facade]
---

# Front the mainframe with a facade

## Context and Problem Statement

The internet banking API needs account data from the mainframe, whose CICS
transactions are XML over HTTPS and change on the mainframe's release cycle.

## Considered Options

- Call CICS transactions directly from every API controller
- A single facade component that owns the mainframe contract

## Decision Outcome

Chosen option: a facade. Only `digital:mainframe-facade` talks to the mainframe,
so a mainframe release changes one component.

---
status: accepted
date: 2026-02-03
decision-makers: [core, data]
elements: [mailer, events]
views: [place-order]
---

# Send receipts from order events

## Context and Problem Statement

The API sent receipt e-mails itself, so a slow mail server slowed checkout down.

## Decision Outcome

The API publishes `orders.placed` to Events, and Mailer subscribes to it and sends the receipt.

## Consequences

Checkout no longer waits for e-mail. A receipt can arrive a few seconds after the order.

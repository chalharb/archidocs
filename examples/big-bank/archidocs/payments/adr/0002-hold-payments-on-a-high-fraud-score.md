---
status: proposed
date: 2026-03-02
decision-makers: [payments]
elements: [fraud-detection, payments-service]
---

# Hold payments on a high fraud score

## Context and Problem Statement

Fraud Detection scores payments after they are initiated, but a payment can
settle before the score arrives.

## Considered Options

- Keep scoring after the fact and claw back
- Hold a payment until it is scored, when its amount is above a threshold

## Decision Outcome

Proposed: hold payments above £1,000 until Fraud Detection has scored them.

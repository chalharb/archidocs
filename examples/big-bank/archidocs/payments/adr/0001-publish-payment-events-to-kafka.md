---
status: accepted
date: 2025-11-03
decision-makers: [payments]
consulted: [platform, digital-banking]
elements: [payments-service, platform:kafka]
---

# Publish payment events to Kafka

## Context and Problem Statement

Fraud scoring and customer notifications both need to react to payments, and
calling each of them synchronously would put them on the payment's critical path.

## Decision Outcome

The Payments Service publishes `payments.initiated` and `payments.completed` to
the Event Bus. Fraud Detection and Notifications subscribe.

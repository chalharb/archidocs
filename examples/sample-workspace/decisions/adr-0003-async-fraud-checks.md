---
apiVersion: archdocs/v1
kind: Decision
id: adr-0003
title: Run fraud checks asynchronously
status: proposed
date: "2026-10-20"
deciders: [Payments team]
tags: [performance]
entities: [fraud-checker, payment-controller]
diagrams: [payments-api-components]
---

## Context

Synchronous fraud checks add latency to every payment.

## Decision

The [Payment Controller](entity:payment-controller) queues checks for the
[Fraud Checker](entity:fraud-checker).

## Consequences

Some fraudulent payments are flagged after authorisation and must be reversed.

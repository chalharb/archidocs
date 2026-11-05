---
apiVersion: archdocs/v1
kind: Decision
id: adr-0001
title: Store the ledger in MongoDB
status: superseded
date: "2025-06-02"
deciders: [Payments team]
tags: [data]
entities: [ledger-db]
---

## Context

The first ledger prototype needed a flexible schema.

## Decision

Use MongoDB for the [Ledger Database](entity:ledger-db).

## Consequences

Fast iteration, but no multi-document transactions at the time.

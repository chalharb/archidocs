---
apiVersion: archdocs/v1
kind: Decision
id: adr-0002
title: Use PostgreSQL for the ledger
status: accepted
date: "2026-03-14"
deciders: [Payments team, Platform team]
tags: [data]
entities: [ledger-db, payments-api]
diagrams: [containers]
supersedes: [adr-0001]
---

## Context

Ledger writes must be transactional, and [ADR-0001](decision:adr-0001)'s store
couldn't guarantee that.

## Decision

Move the [Ledger Database](entity:ledger-db) to PostgreSQL.

## Consequences

The [Payments API](entity:payments-api) uses a relational schema and
migrations.

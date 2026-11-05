---
apiVersion: archdocs/v1
kind: Document
id: payments-overview
title: Payments overview
description: How a card payment flows from the web shop to the ledger.
owner: Payments team
tags: [payments, overview]
entities: [payments-system, web-shop, payments-api, ledger-db]
diagrams: [system-context, containers]
---

Customers pay in the [Web Shop](entity:web-shop), which calls the
[Payments API](entity:payments-api). The API authorises the card with the
[Card Network](entity:card-network) and records the result in the
[Ledger Database](entity:ledger-db).

See the [container diagram](diagram:containers) for the full picture, and
[ADR-0002](decision:adr-0002) for why the ledger uses PostgreSQL.

Operational details are in the [runbook](document:payments-runbook).

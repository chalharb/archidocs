---
apiVersion: archdocs/v1
kind: Document
id: payments-runbook
title: Payments runbook
description: What to check when payments fail.
owner: Payments team
tags: [payments, operations]
entities: [payments-api, ledger-db]
diagrams: [deployment]
---

# Payments runbook

1. Check the [Payments API](entity:payments-api) instances in the
   [deployment diagram](diagram:deployment).
2. Check replication lag on the [Ledger Database](entity:ledger-db).

Background: [Payments overview](payments-overview.md).

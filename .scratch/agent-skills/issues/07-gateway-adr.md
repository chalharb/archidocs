# 07: Gateways and proxies ADR

Status: done
Blocked by: None (can start immediately)
Spec: [Agent skills](../spec.md)

## What to build

Settle how an API gateway or reverse proxy is modelled. PR title: `docs(adr): ...`.

- `docs/adr/0005-gateways-are-services.md`, in the style of ADR 0004:
  - **Default**: the gateway is a Service in the path (`technology: Apigee`), owned by the Team that runs it: `web → apigee → api`. Honest about the hop and its owner.
  - **Lighter option**: leave it out when it's shared infrastructure nobody needs to see; name it in the Relationship's `technology` (`HTTPS via Apigee`).
  - **URLs**: the gateway URL is the consumer-facing Deployment `url`.
  - **Considered**: a Deployment Target (invisible at the logical level); a sync `via` like the async broker `via` (a schema change, left as its own feature).
- `guide/topics/relationships.md`: a "Gateways and proxies" section with both options and a short YAML example.
- No GLOSSARY.md term: a gateway is a Service.

## Acceptance criteria

- [ ] `pnpm docs:test` passes.
- [ ] This ticket's `Status:` is set to `done` in the same PR.

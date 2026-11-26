# 03: Show that a Deployment is scaled

Status: needs-triage

## Problem

Nothing on a Deployment View shows that a Deployment runs as several instances. In the Sitecore Workspace the scaling lives only in the Target's name ("asp-sitecore-cd (Premium v3, Windows, autoscale 2…)").

## Notes

The model has no field for it: a Deployment is `service`, `environment`, `target`, `url`, `endpoints` (`schemas/model.schema.json`).

## Decide

- Where the fact lives: on the Deployment (`instances: 3` or `instances: { min: 2, max: 10 }` for autoscale) or on the Deployment Target.
- How it draws: a stacked-card shadow behind the box, and/or an `×3` / `2–10` chip beside the Team code. The Key gains a row for it.
- Whether the three `vm-solr-N` / `vm-zk-N` VMs in the search subnet should instead be modelled as one Deployment with `instances: 3` per AZ (and whether that's something the guide should teach agents).

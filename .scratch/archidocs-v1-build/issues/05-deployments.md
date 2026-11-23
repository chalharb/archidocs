# 05: Deployment Targets and Deployments

Status: done
Assignee: Claude (ticket-05 session)
Blocked by: 03
Spec: [Archidocs v1](../../archidocs-v1/spec.md)

## What to build

Authors record where Services run, and their URLs per Environment.

- `targets:` nest to any depth, each with id, name, kind, Owner and tags. Target ids share the Element id namespace within a Project, and Targets can be referenced from other Projects.
- `deployments:` is a list of `{service, environment, target, url?, endpoints?}`, identified by the (Service, Environment, Target) triple.
- Rules: `unknown-environment`, `unknown-target`, `duplicate-deployment`, and `wrong-kind` for a Deployment's `service`.
- The Bundle's `targets` and `deployments`. A Deployment's Owner is its Service's Owner.

## Acceptance criteria

- [x] A fixture with region › cluster Targets shared across Projects and Deployments in two Environments builds correctly.
- [x] A duplicate triple is an error at the later location.
- [x] Every new rule has failing and passing fixtures.

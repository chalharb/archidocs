# 14: Viewer URL reference

Status: done
Blocked by: None (can start immediately)
Spec: [Docs rewrite proposal](../spec.md)

## What to build

"Every screen is a link" is a headline feature, and the URL's parts appear only inside examples (`#/view/c2?impact=core:mainframe&way=upstream`).

- **One list of parameters:** in `viewer/src/place.ts`, declare the route and each query parameter as data: its name, its values and what it does. Parsing and formatting use the list, so the list can't fall behind.
- **Page:** a generated `reference/viewer-urls` page from that list: the route (`#/view/<view-id>`), a row per parameter, and worked links into the Big Bank demo for each persona question.
- **Stability:** say on the page that these URLs are meant to be shared and are stable within a major release ([ticket 19](19-upgrading-and-versioning.md)). The maintainer plans to drop `/#/` in a 1.x release, so generate the route from the parameter list and don't hard-code the hash form in prose.

Don't change what any existing URL means.

## Acceptance criteria

- [x] The page lists every parameter the viewer reads.
- [x] A unit test fails when the parser reads a parameter that isn't in the list.
- [x] Every example link on the page opens the View it describes on the Big Bank demo (checked in the viewer's end-to-end tests).
- [x] The viewer's existing URL tests pass unchanged.

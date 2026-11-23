# Rename, move or remove

The write tools never cascade: a removal is refused while anything still references the thing removed, and the refusal lists each reference with its file:line. Work through that list.

## Remove

1. Call the `remove_*` tool: `remove_element`, `remove_relationship`, `remove_target`, `remove_deployment`, `remove_view`.
2. On a refusal, handle each reference in `references`:
   - an Element inside it: remove it first, or move it (below);
   - a Relationship to or via it: remove it with `remove_relationship`, or point it elsewhere with `upsert_relationship`;
   - a Deployment of it, or on a Target: `remove_deployment`;
   - an ADR linking it: ask the user. Accepted ADRs are history; usually propose a new ADR rather than editing an old one.
   - a reference in another Project: that Project's Team owns it; tell the user.
3. Call the removal again. Removing an Element also removes the Relationships declared under it.

## Rename

Ids are referenced across files and Projects, so a rename is add, repoint, remove:

1. `upsert_element` the new id with the same fields and parent.
2. Recreate its Components, Relationships and Deployments under the new id, and repoint every reference to the old id: `get_element` lists the Relationships in, Deployments, Dynamic Views and ADRs, and `list_views` the Saved Views to look through.
3. Remove the old id; any refusal names what still points at it.

Changing only the display `name` is a plain `upsert_element` with `fields: {name}`.

## Move

Moving an Element to a new parent, or a Target to a new parent Target, isn't an update: add it under the new parent, repoint references, then remove the old one, as for a rename (the id may stay the same only after the old one is removed, so use a temporary id or remove first when nothing references it).

## Finish

Run `check`, show the combined diff, and suggest a branch, PR title and body that list what was renamed, moved or removed.

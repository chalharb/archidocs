# An Element's repository is a field, and its own facts go in `metadata`

Teams want the Element panel to say where a Service's code lives and to carry facts the Model has no field for, such as a tier or an on-call rota. Elements already take `links` (a list of `label` + `url`), so both could have been written as links. They are not.

**`repository` is a field on Systems, Services and Components.** A link labeled `Repository` would be a convention nothing checks: one Team writes `Repo`, another `Source`, and an agent asking "where is the code for this Service?" has to guess which label to read. As a field it is one URL, checked as a URL, that the viewer shows in its own row and `get_element` returns as `element.repository`. A Person has no repository, so the field is not offered there. An Element whose code is spread over several repositories names the main one in `repository` and the rest in `links`; `links` stays for every other page about the Element (runbooks, dashboards).

**`metadata` is a free-form map on every Element.** Keys are labels, shown as written; values are strings, numbers or booleans, and the Bundle carries them as strings in declared order. A nested value is reported as `invalid-value`, so the panel never has to draw a tree. Nothing in the Model reads `metadata`: no check rule, selector or Lens depends on it, and it never changes a diagram. A fact that the Model needs to reason about (as `technology`, `type` and `owner` are) becomes a field of its own, not a `metadata` key.

**The description is Markdown.** The viewer renders `description` with the same renderer as an ADR body, which builds React elements and never HTML strings. A plain sentence renders as before, so no existing Model changes.

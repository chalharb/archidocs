# A gateway or reverse proxy is a Service in the path

Most consumers reach an API through something in between: an API gateway such as Apigee or Kong, or a reverse proxy such as nginx or Envoy. Agents and Teams modeling `web → api` ask where it goes, and without an answer each writes it down differently, or not at all.

**By default the gateway is a Service in the path**, with `technology: Apigee`, owned by the Team that runs it. The consumer depends on the gateway and the gateway on the API: `web → apigee → api`. This is honest about the hop: impact and path questions see it, an outage of the gateway shows up as upstream of every API behind it, and its owner is named like any other Service's. No new kind of Element is needed, because a gateway is a Service; GLOSSARY.md gets no new term.

**The lighter option is to leave it out.** When the gateway is shared infrastructure nobody needs to see in the Model, the consumer depends on the API directly and the Relationship's `technology` names the gateway: `HTTPS via Apigee`. Impact and paths then skip the hop, which is the trade being made.

**The gateway's URL is the consumer-facing Deployment `url`.** Consumers call the address the gateway serves, so that is the main address of the Deployment they reach; an internal address behind the gateway goes in `endpoints` if it is worth naming.

**Considered and rejected:**

- **A Deployment Target.** A gateway does host routes, but Deployment Targets only appear at the deployment level; at the logical level, where Relationships and impact live, the gateway would be invisible.
- **A sync `via`, like the async broker `via`.** It would draw `web → api` with the gateway as a named hop, but it is a schema change with its own questions (what impact counts, how Dynamic Views draw it). It is left as a feature of its own, not settled here.

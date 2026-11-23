import { z } from "zod";
import { Ref } from "./workspace.ts";

/** An ADR's status as written. `superseded` is derived, never hand-written; `check` reports it. */
export const AdrStatus = z.enum(["proposed", "accepted", "rejected", "deprecated", "superseded"]);

/** An ADR file name: a four-digit number, then a slug. */
export const ADR_FILENAME = /^(\d{4})-[a-z0-9][a-z0-9-]*\.md$/;

/** A reference to an ADR: its number in this Project, or `project:NNNN`. */
export const AdrRef = z
  .string()
  .regex(/^([a-z0-9][a-z0-9-]*:)?\d{4}$/, "must be an ADR number (NNNN), or `project:NNNN` for one in another Project")
  .describe("An ADR number in this Project, or `project:NNNN` for one in another Project");

const people = z.array(z.string()).describe("People or Team ids; not checked");

/**
 * An ADR's frontmatter, with field names following MADR v4. The title is the
 * body's first `# ` heading, not a field.
 */
export const AdrFrontmatter = z.strictObject({
  status: AdrStatus,
  date: z.iso.date("must be an ISO date (YYYY-MM-DD)").describe("The date of the last status change"),
  "decision-makers": people.optional(),
  consulted: people.optional(),
  informed: people.optional(),
  tags: z.array(z.string()).optional(),
  elements: z.array(Ref).optional().describe("Elements and Deployment Targets the decision affects"),
  views: z.array(Ref).optional().describe("Saved Views the decision affects"),
  supersedes: z.array(AdrRef).optional().describe("ADRs this one replaces once accepted"),
});

export type AdrFrontmatter = z.infer<typeof AdrFrontmatter>;
export type AdrStatus = z.infer<typeof AdrStatus>;

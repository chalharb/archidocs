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
  .describe("An ADR number in this Project, or `project:NNNN` for one in another Project.");

const people = z.array(z.string());

/**
 * An ADR's frontmatter, with field names following MADR v4. The title is the
 * body's first `# ` heading, not a field.
 */
export const AdrFrontmatter = z
  .strictObject({
    status: AdrStatus.describe(
      "Where the decision stands. `proposed`: awaiting acceptance in a pull request. `accepted`: in force. `rejected`: turned down, and kept for its reasoning. `deprecated`: no longer in force, with no ADR replacing it. `superseded`: never written by hand; it is derived once an accepted ADR lists this one in `supersedes`.",
    ),
    date: z.iso.date("must be an ISO date (YYYY-MM-DD)").describe("The date of the last status change, as `YYYY-MM-DD`."),
    "decision-makers": people.optional().describe("Who made the decision: people's names or Team ids. Not checked."),
    consulted: people.optional().describe("Who was asked for input: people's names or Team ids. Not checked."),
    informed: people.optional().describe("Who was told of the decision: people's names or Team ids. Not checked."),
    tags: z.array(z.string()).optional().describe("Free-form labels for the ADR."),
    elements: z.array(Ref).optional().describe("The Elements and Deployment Targets the decision affects, each as an id in this Project or `project:id`."),
    views: z.array(Ref).optional().describe("The Saved Views the decision affects, each as an id in this Project or `project:id`."),
    supersedes: z
      .array(AdrRef)
      .optional()
      .describe("The ADRs this one replaces once it is accepted, each as a four-digit number in this Project or `project:NNNN`. Only an accepted or deprecated ADR can be superseded."),
  })
  .describe("An ADR's frontmatter. The ADR's title is the first `# ` heading of its body, not a field.");

export type AdrFrontmatter = z.infer<typeof AdrFrontmatter>;
export type AdrStatus = z.infer<typeof AdrStatus>;

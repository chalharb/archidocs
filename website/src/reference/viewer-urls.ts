/**
 * The viewer URL reference: the route and every query parameter, from the
 * list in `viewer/src/place.ts` that the viewer itself parses and formats
 * URLs with, and worked links into the Big Bank demo, one per question on the
 * introduction page. The viewer's end-to-end tests open each worked link on a
 * build of the Big Bank demo.
 */
import { formatPlace, viewPlace, URL_PARAMETERS, VIEW_ROUTE, type Place } from "../../../viewer/src/place.ts";
import { findExample } from "../lib/examples.ts";
import { blocks, fence, table, text, type GeneratedPage } from "./page.ts";

export const VIEWER_URLS_ID = "docs/reference/viewer-urls";

/** A link into the Big Bank demo that answers one question from the introduction page. */
export interface WorkedLink {
  who: string;
  question: string;
  place: Place;
  /** What the link opens, as Markdown. */
  shows: string;
}

const placeOn = (view: string, fields: Partial<Place>): Place => ({ ...viewPlace(view), ...fields });

export const WORKED_LINKS: readonly WorkedLink[] = [
  {
    who: "Enterprise Architect",
    question: "How are two Services connected?",
    place: placeOn("c2", { lens: { path: { from: "digital:spa", to: "core:mainframe", paths: "shortest" } } }),
    shows: "The Service Landscape with the Connect to… Lens from the Single-Page Application to the Mainframe.",
  },
  {
    who: "Solutions Architect",
    question: "Where is a Service deployed?",
    place: placeOn("deployment/prod", { selected: "payments:payments-service@platform:eks-prod" }),
    shows: "The Production Deployment View, with the Payments Service's Deployment on EKS prod selected.",
  },
  {
    who: "Developer",
    question: "What does my Team own?",
    place: placeOn("c2", { lens: { team: "payments" } }),
    shows: "The Service Landscape with the Team Lens on the Payments Team.",
  },
  {
    who: "Product Owner",
    question: "What is upstream and downstream of an outage?",
    place: placeOn("c2", { lens: { impact: "core:mainframe", direction: "upstream" } }),
    shows: "The Service Landscape with the Impact Lens upstream of the Mainframe: everything a Mainframe outage reaches.",
  },
  {
    who: "QA Tester",
    question: "What is a Service's URL in a given Environment?",
    place: placeOn("c2", { open: ["payments:payments"], selected: "payments:payments-service" }),
    shows: "The Payments System opened, with the Payments Service selected. Its Element panel lists the Service's URL in each Environment.",
  },
  {
    who: "Technical staff",
    question: "Which decisions sit behind an Element?",
    place: placeOn("c2", { adr: "digital:0002" }),
    shows: "The ADR reader, open on the Digital Banking Team's decision to delegate sign-in to the Identity Platform.",
  },
  {
    who: "Technical staff",
    question: "How has the system changed?",
    place: placeOn("c2", { vs: "2025-07-21" }),
    shows: "The Service Landscape in Compare against the Revision of 21 July 2025. Payments and Card Network were added since, and are marked.",
  },
];

/** The URL of a worked link on the live Big Bank demo. */
export const workedLinkUrl = (link: WorkedLink): string => `${findExample("big-bank").demo}/${formatPlace(link.place)}`;

export function viewerUrlPages(): GeneratedPage[] {
  const demo = findExample("big-bank");
  return [
    {
      id: VIEWER_URLS_ID,
      title: "Viewer URLs",
      description: "The viewer's URL: the route to a View and every query parameter that sets what is on screen.",
      source: "viewer/src/place.ts",
      body: blocks(
        "Every screen in the viewer is a link. Its URL holds the View and everything on it: the open boxes, the selection, the Lens, the picks, the Revision and the open ADR. Open the link and you see the same screen.",
        "These URLs are meant to be shared: paste them into a ticket, a chat or a page. A link keeps opening the same screen within a major release.",
        "## Syntax",
        fence("text", `${VIEW_ROUTE.syntax}?<parameter>=<value>&<parameter>=<value>`),
        `The route follows the address the viewer is served from, as in \`${demo.demo}/${formatPlace(viewPlace("c2"))}\`.`,
        text(VIEW_ROUTE.does),
        "Every parameter is optional. A list of ids is separated by commas. Ids keep their `:`, `/` and `@` as written, and any other character that isn't allowed in a URL is percent-encoded.",
        "## Parameters",
        table(
          ["Parameter", "Values", "What it does"],
          URL_PARAMETERS.map((p) => [`\`${p.name}\``, text(p.values), text(p.does)]),
        ),
        "## Examples",
        `Each link opens the [Big Bank demo](/docs/examples/big-bank/) on the screen that answers one question from the [introduction](/docs/start/introduction/#the-questions-it-answers).`,
        table(
          ["Who", "Question", "Link", "What it opens"],
          WORKED_LINKS.map((link) => [link.who, link.question, `[\`${formatPlace(link.place)}\`](${workedLinkUrl(link)})`, link.shows]),
        ),
        "## When a link can't be read",
        "The viewer never rejects a link. It opens what it can read:",
        [
          "- A URL that doesn't start with the route opens the Service Landscape.",
          "- A parameter that isn't in the table is ignored.",
          "- A value a parameter doesn't take is ignored, as if the parameter were left out.",
        ].join("\n"),
        "## See also",
        [
          "- [The viewer](/docs/concepts/viewer/): the screens these URLs open.",
          "- [Views](/docs/concepts/views/): the Views a route names.",
          "- [Big Bank](/docs/examples/big-bank/): the example Workspace the links open.",
        ].join("\n"),
      ),
    },
  ];
}

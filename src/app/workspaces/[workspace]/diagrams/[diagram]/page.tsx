import type { Metadata } from "next";
import { DiagramPage } from "./diagram-page";

type Props = PageProps<"/workspaces/[workspace]/diagrams/[diagram]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { diagram } = await params;
  return { title: `${diagram} · Architecture Docs` };
}

/** Read-only diagram view (DIAG-12). */
export default function DiagramViewPage(props: Props) {
  return <DiagramPage {...props} mode="view" />;
}

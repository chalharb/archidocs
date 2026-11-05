import type { Metadata } from "next";
import { DiagramPage } from "../diagram-page";

type Props = PageProps<"/workspaces/[workspace]/diagrams/[diagram]/edit">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { diagram } = await params;
  return { title: `Edit ${diagram} · Architecture Docs` };
}

/** Layout editor for a diagram (DIAG-12). */
export default function DiagramEditPage(props: Props) {
  return <DiagramPage {...props} mode="edit" />;
}

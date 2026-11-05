/** Resolve a workspace for a documentation page, or 404 (SEC-09: only via the service). */
import { notFound } from "next/navigation";
import { getWorkspaceService } from "@/server/service";

export async function workspaceOr404(workspace: string) {
  const entry = await getWorkspaceService().get(workspace);
  if (!entry || entry.status !== "ready") notFound();
  const repository = entry.repository!;
  const snapshot = repository.snapshot();
  return {
    repository,
    snapshot,
    name: snapshot.model.workspace?.name ?? workspace,
    home: { label: snapshot.model.workspace?.name ?? workspace, href: "/" },
  };
}

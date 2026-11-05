"use client";

/**
 * Refresh a server-rendered documentation page when the workspace changes (DOC-07).
 * Listens to the workspace change stream and re-renders on a newer version.
 */
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function LiveRefresh({ workspace, version }: { workspace: string; version: number }) {
  const router = useRouter();
  useEffect(() => {
    const source = new EventSource(`/api/workspaces/${encodeURIComponent(workspace)}/events`);
    source.addEventListener("change", (event) => {
      const data = JSON.parse((event as MessageEvent<string>).data) as { version: number };
      if (data.version !== version) router.refresh();
    });
    return () => source.close();
  }, [workspace, version, router]);
  return null;
}

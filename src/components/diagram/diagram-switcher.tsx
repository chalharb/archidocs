"use client";

import { useRouter } from "next/navigation";
import { useId } from "react";

export function DiagramSwitcher({
  workspace,
  current,
  diagrams,
}: {
  workspace: string;
  current: string;
  diagrams: ReadonlyArray<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const id = useId();
  return (
    <div className="ml-auto flex items-center gap-2 text-sm">
      <label htmlFor={id} className="text-muted-foreground">
        Diagram
      </label>
      <select
        id={id}
        className="h-7 rounded-md border bg-background px-2"
        value={current}
        onChange={(e) =>
          router.push(
            `/workspaces/${encodeURIComponent(workspace)}/diagrams/${encodeURIComponent(e.currentTarget.value)}`,
          )
        }
      >
        {diagrams.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </select>
    </div>
  );
}

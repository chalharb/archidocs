/** Page frame for documentation pages: breadcrumb, title, stale notice, live refresh (DOC-06). */
import Link from "next/link";
import type { ReactNode } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { ModelStatus } from "@/server/workspace/snapshot";
import { LiveRefresh } from "./live-refresh";

export interface Crumb {
  label: string;
  href: string;
}

export function DocShell({
  workspace,
  version,
  status,
  crumbs,
  title,
  actions,
  children,
}: {
  workspace: string;
  version: number;
  status: ModelStatus;
  crumbs: Crumb[];
  title: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8">
      <LiveRefresh workspace={workspace} version={version} />
      <header className="flex flex-col gap-2">
        <nav aria-label="Breadcrumb" className="text-sm">
          {crumbs.map((c, i) => (
            <span key={c.href}>
              {i > 0 && (
                <span className="mx-2 text-muted-foreground" aria-hidden>
                  /
                </span>
              )}
              <Link href={c.href} className="underline-offset-2 hover:underline">
                {c.label}
              </Link>
            </span>
          ))}
        </nav>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {actions}
        </div>
      </header>
      {status === "stale" && (
        <Alert variant="destructive">
          <AlertTitle>Showing the last valid version</AlertTitle>
          <AlertDescription>
            The latest workspace files have errors. Fix them and this page refreshes automatically.
          </AlertDescription>
        </Alert>
      )}
      <main className="flex flex-col gap-6">{children}</main>
    </div>
  );
}

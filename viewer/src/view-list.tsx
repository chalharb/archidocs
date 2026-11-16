import { useEffect, useState } from "react";
import { loadSiteData, type SiteData } from "./data";

export function ViewList() {
  const [data, setData] = useState<SiteData>();
  const [failure, setFailure] = useState<string>();

  useEffect(() => {
    loadSiteData().then(setData, (error: unknown) =>
      setFailure(error instanceof Error ? error.message : String(error)),
    );
  }, []);

  if (failure)
    return (
      <main className="p-6">
        <p role="alert">{failure}</p>
      </main>
    );
  if (!data)
    return (
      <main className="p-6">
        <p>Loading…</p>
      </main>
    );

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-[length:var(--text-title)] font-semibold">{data.title}</h1>
      <h2 className="mt-6 text-muted-foreground">Views</h2>
      <ul className="mt-2 space-y-1">
        {data.files.flatMap((file) =>
          file.views.map((view) => <li key={`${file.file}:${view.id}`}>{view.title}</li>),
        )}
      </ul>
      {data.files
        .filter((file) => file.errors.length > 0)
        .map((file) => (
          <section key={file.file} className="mt-6" aria-label={`Errors in ${file.file}`}>
            <h2 className="text-destructive">{file.file} has errors</h2>
            <ul className="mt-2 space-y-1">
              {file.errors.map((error, i) => (
                <li key={i}>
                  {error.path ? `${error.path}: ` : ""}
                  {error.message}
                </li>
              ))}
            </ul>
          </section>
        ))}
    </main>
  );
}

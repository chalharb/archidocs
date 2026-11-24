/** Where the e2e suite serves the built docs site. `E2E_DOCS_PORT` moves it, so suites in several checkouts can run side by side. */
export const DOCS_PORT = Number(process.env.E2E_DOCS_PORT ?? 4518);

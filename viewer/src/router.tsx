import {
  createHashHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
} from "@tanstack/react-router";
import logo from "./logo-on-dark.svg";
import { ViewList } from "./view-list";

function Root() {
  return (
    <>
      <header className="border-b border-border px-6 py-3">
        <img src={logo} alt="Archidocs" className="h-7 w-auto" />
      </header>
      <Outlet />
    </>
  );
}

const rootRoute = createRootRoute({ component: Root });
const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: "/", component: ViewList });

// Hash history keeps deep links working on a plain file server with no rewrite rules.
export const router = createRouter({
  routeTree: rootRoute.addChildren([indexRoute]),
  history: createHashHistory(),
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

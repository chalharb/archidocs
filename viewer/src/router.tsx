import {
  createHashHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
} from "@tanstack/react-router";
import { ViewList } from "./view-list";

const rootRoute = createRootRoute({ component: Outlet });
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

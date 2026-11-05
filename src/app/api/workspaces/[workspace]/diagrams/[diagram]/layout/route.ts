import { saveLayout } from "@/server/http/handlers";
import { getHttpDeps } from "@/server/service";

export async function PUT(
  request: Request,
  ctx: RouteContext<"/api/workspaces/[workspace]/diagrams/[diagram]/layout">,
) {
  return saveLayout(request, getHttpDeps(), await ctx.params);
}

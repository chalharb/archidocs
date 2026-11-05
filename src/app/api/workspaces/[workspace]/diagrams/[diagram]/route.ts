import { getDiagram } from "@/server/http/handlers";
import { getHttpDeps } from "@/server/service";

export async function GET(
  request: Request,
  ctx: RouteContext<"/api/workspaces/[workspace]/diagrams/[diagram]">,
) {
  return getDiagram(request, getHttpDeps(), await ctx.params);
}

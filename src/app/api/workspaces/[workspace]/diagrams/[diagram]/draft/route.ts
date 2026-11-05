import { discardDraft, saveDraft } from "@/server/http/handlers";
import { getHttpDeps } from "@/server/service";

type Ctx = RouteContext<"/api/workspaces/[workspace]/diagrams/[diagram]/draft">;

export async function PUT(request: Request, ctx: Ctx) {
  return saveDraft(request, getHttpDeps(), await ctx.params);
}

export async function DELETE(request: Request, ctx: Ctx) {
  return discardDraft(request, getHttpDeps(), await ctx.params);
}

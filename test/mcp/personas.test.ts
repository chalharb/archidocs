import { describe, expect, it } from "vitest";
import { deploymentWorkspace } from "../support/fixtures.ts";
import { connect } from "../support/mcp.ts";

/** Acceptance tests: each persona question answered through MCP, as an agent would. */
describe("persona questions through MCP", () => {
  it("Solutions Architect: where is a Service deployed?", async () => {
    const { call } = await connect(deploymentWorkspace);

    const found = await call("search_elements", { query: "Web", kind: "service" });
    const [web] = found.structuredContent!.elements as { id: string }[];
    const result = await call("get_deployments", { service: web!.id });

    const where = (result.structuredContent!.deployments as { environment: string; targetPath: { name: string }[] }[]).map(
      (d) => `${d.environment}: ${d.targetPath.map((t) => t.name).join(" › ")}`,
    );
    expect(where).toEqual(["prod: AWS eu-west-1 › EKS prod", "prod: Shop edge", "staging: AWS eu-west-1 › EKS staging"]);
  });

  it("QA Tester: what is a Service's URL in staging?", async () => {
    const { call, text } = await connect(deploymentWorkspace);

    const result = await call("get_deployments", { service: "shop:web", environment: "staging" });

    expect((result.structuredContent!.deployments as { url: string | null }[]).map((d) => d.url)).toEqual(["https://staging.shop.example.com"]);
    expect(text(result)).toContain("https://staging.shop.example.com");
  });

  it("QA Tester: which Service is behind this URL?", async () => {
    const { call } = await connect(deploymentWorkspace);

    const result = await call("search_elements", { query: "https://shop.example.com/healthz" });

    expect(result.structuredContent!.elements).toEqual([
      expect.objectContaining({ id: "shop:web", deployment: { environment: "prod", target: "platform:eks-prod", url: "https://shop.example.com/healthz" } }),
    ]);
  });
});

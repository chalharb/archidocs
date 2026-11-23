import type { Files } from "../support/workspace.ts";

/**
 * A generated Workspace in one Project: a Person, `systems` Systems of
 * `services` Services each (the first Service of each System has two
 * Components), and Relationships chosen by a fixed-seed generator, about
 * half inside a System and half across. `extra` is appended to the System
 * list's YAML so a test can add one Element.
 */
export function syntheticWorkspace({ systems = 6, services = 5, extraService }: { systems?: number; services?: number; extraService?: { system: number; to: string } } = {}): Files {
  let seed = 7;
  const random = (n: number) => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed % n;
  };
  const sys = (s: number) => `sys-${String.fromCharCode(97 + s)}`;
  const svc = (s: number, v: number) => `${sys(s)}-svc-${v}`;
  const lines = ["systems:"];
  for (let s = 0; s < systems; s++) {
    lines.push(`  ${sys(s)}:`, `    name: System ${String.fromCharCode(65 + s)}`, "    services:");
    for (let v = 0; v < services; v++) {
      lines.push(`      ${svc(s, v)}:`, `        name: Service ${String.fromCharCode(65 + s)}${v}`);
      const targets = new Set<string>();
      for (let r = 0; r < 2; r++) {
        const across = random(2) === 0;
        const ts = across ? random(systems) : s;
        const tv = random(services);
        if (ts === s && tv <= v) continue; // keep inside-System edges acyclic and off self
        targets.add(svc(ts, tv));
      }
      if (targets.size > 0) {
        lines.push("        relationships:");
        for (const t of [...targets].sort()) lines.push(`          - to: ${t}`, `            description: Calls ${t}`, ...(random(3) === 0 ? ["            interaction: async"] : []));
      }
      if (v === 0) lines.push("        components:", `          ${svc(s, v)}-api:`, "            name: API", `          ${svc(s, v)}-store:`, "            name: Store");
    }
    if (extraService?.system === s) {
      lines.push("      added-service:", "        name: Added service", "        relationships:", `          - to: ${extraService.to}`);
    }
  }
  return {
    "workspace.yaml": "teams:\n  core-team:\n    name: Core\n",
    "land/project.yaml": "id: land\nname: Land\nowner: core-team\n",
    "land/people.yaml": `people:\n  user:\n    name: User\n    relationships:\n      - to: ${svc(0, 0)}\n      - to: ${svc(1, 0)}\n`,
    "land/systems.yaml": lines.join("\n") + "\n",
  };
}

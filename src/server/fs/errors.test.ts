import { describe, expect, it, vi } from "vitest";
import { FsError } from "./errors";

describe("FsError instanceof across module copies", () => {
  it("recognises an FsError built by another copy of the module (Next.js bundle layers)", async () => {
    vi.resetModules();
    const other = await import("./errors");
    expect(other.FsError).not.toBe(FsError);
    const foreign = new other.FsError("NOT_FOUND", "missing", "a.png");
    expect(foreign instanceof FsError).toBe(true);
    expect(new FsError("TOO_LARGE", "big") instanceof other.FsError).toBe(true);
  });

  it("rejects values that are not FsErrors", () => {
    expect(new Error("x") instanceof FsError).toBe(false);
    expect(
      Object.assign(new Error("x"), { name: "FsError", code: "NOT_FOUND" }) instanceof FsError,
    ).toBe(false);
    expect((null as unknown) instanceof FsError).toBe(false);
    expect(("FsError" as unknown) instanceof FsError).toBe(false);
  });
});

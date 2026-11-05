import { describe, expect, it } from "vitest";
import { editDistance, suggest } from "./suggest";

describe("suggest", () => {
  it("computes edit distance", () => {
    expect(editDistance("", "")).toBe(0);
    expect(editDistance("abc", "abc")).toBe(0);
    expect(editDistance("", "abc")).toBe(3);
    expect(editDistance("kitten", "sitting")).toBe(3);
  });

  it("suggests the closest candidate case-insensitively", () => {
    expect(suggest("nmae", ["name", "type", "id"])).toBe("name");
    expect(suggest("entityset", ["EntitySet", "Entity"])).toBe("EntitySet");
  });

  it("returns undefined when nothing is close", () => {
    expect(suggest("zzzzzzzz", ["name", "type"])).toBeUndefined();
    expect(suggest("x", [])).toBeUndefined();
  });

  it("breaks ties alphabetically", () => {
    expect(suggest("ab", ["ac", "aa"])).toBe("aa");
  });
});

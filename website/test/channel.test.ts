import { describe, expect, it } from "vitest";
import { releaseLine } from "../src/lib/channel.ts";

describe("the footer's release line", () => {
  it("names the latest release on production and PR Previews", () => {
    expect(releaseLine({ channel: undefined, version: "1.3.2", commit: undefined })).toBe("Documents Archidocs v1.3.2, the latest release.");
    expect(releaseLine({ channel: "", version: "1.3.2", commit: "abc1234" })).toBe("Documents Archidocs v1.3.2, the latest release.");
  });

  it("names the beta branch and commit on the staging site", () => {
    expect(releaseLine({ channel: "beta", version: "1.3.2", commit: "abc1234" })).toBe("Documents the beta branch at abc1234, ahead of the latest release, v1.3.2.");
  });

  it("leaves the commit out when the build has no git", () => {
    expect(releaseLine({ channel: "beta", version: "1.3.2", commit: undefined })).toBe("Documents the beta branch, ahead of the latest release, v1.3.2.");
  });
});

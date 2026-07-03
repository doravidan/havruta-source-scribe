import { describe, expect, it } from "vitest";
import { authRedirectSearch } from "./auth-redirect";

describe("authRedirectSearch", () => {
  it("builds redirect search from pathname and query", () => {
    expect(authRedirectSearch("/chavruta", "?source=abc")).toEqual({
      redirect: "/chavruta?source=abc",
    });
  });

  it("falls back to home for unsafe paths", () => {
    expect(authRedirectSearch("//evil.com")).toEqual({ redirect: "/" });
  });
});

import { describe, expect, it } from "vitest";
import { safeRedirect } from "./safe-redirect";

describe("safeRedirect", () => {
  it("returns fallback for missing or unsafe values", () => {
    expect(safeRedirect(undefined)).toBe("/");
    expect(safeRedirect("https://evil.com")).toBe("/");
    expect(safeRedirect("//evil.com")).toBe("/");
    expect(safeRedirect("chavruta")).toBe("/");
  });

  it("allows same-origin relative paths", () => {
    expect(safeRedirect("/chavruta")).toBe("/chavruta");
    expect(safeRedirect("/library?tab=1")).toBe("/library?tab=1");
  });
});

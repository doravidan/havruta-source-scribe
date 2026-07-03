import { describe, expect, it } from "vitest";
import { localIsoDate, parseLocalIso, shiftLocalIso } from "./local-date";

describe("localIsoDate", () => {
  it("formats using local calendar components", () => {
    const d = new Date(2026, 6, 2, 23, 30, 0); // July 2 local
    expect(localIsoDate(d)).toBe("2026-07-02");
  });
});

describe("shiftLocalIso", () => {
  it("shifts by calendar days in local time", () => {
    expect(shiftLocalIso("2026-07-02", 1)).toBe("2026-07-03");
    expect(shiftLocalIso("2026-07-02", -1)).toBe("2026-07-01");
  });
});

describe("parseLocalIso", () => {
  it("parses at local noon", () => {
    const d = parseLocalIso("2026-07-02");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(6);
    expect(d.getDate()).toBe(2);
    expect(d.getHours()).toBe(12);
  });
});

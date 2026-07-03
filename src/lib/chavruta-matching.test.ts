import { describe, expect, it } from "vitest";
import {
  computeFinderMatches,
  intersectIntervals,
  slotToUtcIntervals,
  type ChavrutaProfile,
  type MatchingSlot,
} from "./chavruta-matching";

const baseProfile = (overrides: Partial<ChavrutaProfile> = {}): ChavrutaProfile => ({
  user_id: "user-a",
  display_name: "A",
  bio: "",
  learning_level: "intermediate",
  preferred_lang: "he",
  topics: ["תניא"],
  is_active: true,
  time_zone: "Asia/Jerusalem",
  ...overrides,
});

describe("intersectIntervals", () => {
  it("returns overlap when intervals intersect", () => {
    expect(intersectIntervals({ start: 100, end: 200 }, { start: 150, end: 250 })).toEqual({
      start: 150,
      end: 200,
    });
  });

  it("returns null when intervals do not overlap", () => {
    expect(intersectIntervals({ start: 100, end: 150 }, { start: 200, end: 250 })).toBeNull();
  });
});

describe("slotToUtcIntervals", () => {
  it("returns a single interval for same-day slots", () => {
    const slot: MatchingSlot = {
      user_id: "u1",
      day_of_week: 1,
      start_time: "20:00",
      end_time: "21:00",
    };
    const intervals = slotToUtcIntervals(slot, "Asia/Jerusalem");
    expect(intervals.length).toBe(1);
    expect(intervals[0]!.end).toBeGreaterThan(intervals[0]!.start);
  });
});

describe("computeFinderMatches", () => {
  it("finds overlap between profiles in the same timezone", () => {
    const me = baseProfile({ user_id: "me" });
    const them = baseProfile({ user_id: "them", display_name: "Them" });
    const mySlots: MatchingSlot[] = [
      { user_id: "me", day_of_week: 1, start_time: "20:00", end_time: "21:00" },
    ];
    const theirSlots: MatchingSlot[] = [
      { user_id: "them", day_of_week: 1, start_time: "20:30", end_time: "21:30" },
    ];
    const results = computeFinderMatches({
      userId: "me",
      myProfile: me,
      mySlots,
      profiles: [me, them],
      slots: [...mySlots, ...theirSlots],
      matches: [],
    });
    expect(results).toHaveLength(1);
    expect(results[0]!.profile.user_id).toBe("them");
    expect(results[0]!.reasons.minutes).toBeGreaterThanOrEqual(15);
  });

  it("excludes profiles with existing match pairs", () => {
    const me = baseProfile({ user_id: "me" });
    const them = baseProfile({ user_id: "them" });
    const slot: MatchingSlot = {
      user_id: "me",
      day_of_week: 2,
      start_time: "19:00",
      end_time: "20:00",
    };
    const results = computeFinderMatches({
      userId: "me",
      myProfile: me,
      mySlots: [slot],
      profiles: [me, them],
      slots: [
        slot,
        { user_id: "them", day_of_week: 2, start_time: "19:00", end_time: "20:00" },
      ],
      matches: [{ requester_id: "me", suggested_user_id: "them" }],
    });
    expect(results).toHaveLength(0);
  });
});

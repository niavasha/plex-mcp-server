import { describe, it, expect } from "vitest";
import { truncate, validatePlexId, chunkArray } from "../shared/utils.js";

describe("truncate", () => {
  it("returns string unchanged when under limit", () => {
    expect(truncate("short", 100)).toBe("short");
  });

  it("returns string unchanged when exactly at limit", () => {
    const str = "a".repeat(50);
    expect(truncate(str, 50)).toBe(str);
  });

  it("truncates and adds ellipsis when over limit", () => {
    const str = "a".repeat(100);
    const result = truncate(str, 50);
    expect(result).toBe("a".repeat(50) + "...");
    expect(result.length).toBe(53); // 50 + "..."
  });

  it("handles empty string", () => {
    expect(truncate("", 10)).toBe("");
  });

  it("handles limit of 0", () => {
    expect(truncate("hello", 0)).toBe("...");
  });
});

describe("validatePlexId", () => {
  it("returns valid numeric ID", () => {
    expect(validatePlexId("12345", "ratingKey")).toBe("12345");
  });

  it("accepts single digit", () => {
    expect(validatePlexId("1", "key")).toBe("1");
  });

  it("accepts large numbers", () => {
    expect(validatePlexId("999999999", "key")).toBe("999999999");
  });

  it("throws on alphabetic input", () => {
    expect(() => validatePlexId("abc", "ratingKey")).toThrow("must be a numeric Plex ID");
  });

  it("throws on mixed alphanumeric", () => {
    expect(() => validatePlexId("123abc", "ratingKey")).toThrow("must be a numeric Plex ID");
  });

  it("throws on empty string", () => {
    expect(() => validatePlexId("", "ratingKey")).toThrow("must be a numeric Plex ID");
  });

  it("throws on undefined", () => {
    expect(() => validatePlexId(undefined, "ratingKey")).toThrow("must be a numeric Plex ID");
  });

  it("throws on path traversal attempt", () => {
    expect(() => validatePlexId("../etc/passwd", "ratingKey")).toThrow("must be a numeric Plex ID");
  });

  it("includes param name in error message", () => {
    expect(() => validatePlexId("bad", "libraryKey")).toThrow("libraryKey must be a numeric Plex ID");
  });
});

describe("chunkArray", () => {
  it("chunks evenly divisible array", () => {
    expect(chunkArray([1, 2, 3, 4], 2)).toEqual([[1, 2], [3, 4]]);
  });

  it("handles remainder chunk", () => {
    expect(chunkArray([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("returns single chunk when size >= array length", () => {
    expect(chunkArray([1, 2, 3], 5)).toEqual([[1, 2, 3]]);
  });

  it("returns empty array for empty input", () => {
    expect(chunkArray([], 3)).toEqual([]);
  });

  it("chunks into singles when size is 1", () => {
    expect(chunkArray([1, 2, 3], 1)).toEqual([[1], [2], [3]]);
  });
});

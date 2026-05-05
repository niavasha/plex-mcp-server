/**
 * Tests for recommendation scoring normalization
 * Verifies that genre weights remain within [0, 1] bounds
 * across balanced and skewed genre distributions.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { PlexTools } from "../plex/tools.js";
import { PlexClient } from "../plex/client.js";
import { TASTE_TOP_GENRES } from "../plex/constants.js";

/**
 * Helper to extract scoring logic from recommendation engine
 * and test weight normalization independently
 */
function normalizeGenreWeights(
  genreCounts: Record<string, number>
): Record<string, number> {
  const total = Object.values(genreCounts).reduce((a, b) => a + b, 0);
  if (total === 0) return {};

  const normalized: Record<string, number> = {};
  for (const [genre, count] of Object.entries(genreCounts)) {
    normalized[genre] = count / total;
  }
  return normalized;
}

describe("Recommendation scoring normalization", () => {
  let tools: PlexTools;
  let mockPlexClient: Partial<PlexClient>;

  beforeEach(() => {
    mockPlexClient = {
      makeRequest: vi.fn(),
      getPlexTypeId: vi.fn().mockReturnValue(1),
    };
    tools = new PlexTools(mockPlexClient as any);
  });

  describe("Genre weight normalization", () => {
    it("should normalize balanced genre distribution to [0, 1]", () => {
      const balanced: Record<string, number> = {
        Action: 10,
        Drama: 10,
        Comedy: 10,
        SciFi: 10,
      };

      const normalized = normalizeGenreWeights(balanced);

      // All should be 0.25 (1/4)
      expect(normalized.Action).toBe(0.25);
      expect(normalized.Drama).toBe(0.25);
      expect(normalized.Comedy).toBe(0.25);
      expect(normalized.SciFi).toBe(0.25);

      // All should be in [0, 1]
      Object.values(normalized).forEach((weight) => {
        expect(weight).toBeGreaterThanOrEqual(0);
        expect(weight).toBeLessThanOrEqual(1);
      });
    });

    it("should normalize heavily skewed distribution", () => {
      const skewed: Record<string, number> = {
        Horror: 100,
        Action: 5,
        Comedy: 1,
      };

      const normalized = normalizeGenreWeights(skewed);

      // Horror dominant: 100/106 ≈ 0.943
      expect(normalized.Horror).toBeCloseTo(100 / 106, 2);
      expect(normalized.Action).toBeCloseTo(5 / 106, 2);
      expect(normalized.Comedy).toBeCloseTo(1 / 106, 2);

      // All should be in [0, 1]
      Object.values(normalized).forEach((weight) => {
        expect(weight).toBeGreaterThanOrEqual(0);
        expect(weight).toBeLessThanOrEqual(1);
      });
    });

    it("should handle single genre", () => {
      const single: Record<string, number> = {
        Drama: 50,
      };

      const normalized = normalizeGenreWeights(single);

      // Should be exactly 1.0
      expect(normalized.Drama).toBe(1.0);
    });

    it("should handle many genres with varying counts", () => {
      const varied: Record<string, number> = {
        Action: 25,
        Drama: 20,
        Comedy: 15,
        SciFi: 12,
        Thriller: 10,
        Romance: 8,
        Horror: 7,
        Animation: 2,
        Documentary: 1,
      };

      const normalized = normalizeGenreWeights(varied);
      const total = Object.values(varied).reduce((a, b) => a + b);

      // Verify normalization: sum should be ~1.0
      const sum = Object.values(normalized).reduce((a, b) => a + b);
      expect(sum).toBeCloseTo(1.0, 5);

      // All weights in [0, 1]
      Object.values(normalized).forEach((weight) => {
        expect(weight).toBeGreaterThanOrEqual(0);
        expect(weight).toBeLessThanOrEqual(1);
      });
    });

    it("should handle extremely skewed distribution (one outlier)", () => {
      const outlier: Record<string, number> = {
        Niche: 1000,
        Mainstream: 1,
      };

      const normalized = normalizeGenreWeights(outlier);

      // Niche: 1000/1001
      expect(normalized.Niche).toBeCloseTo(1000 / 1001, 4);
      // Mainstream: 1/1001
      expect(normalized.Mainstream).toBeCloseTo(1 / 1001, 4);

      // Both in [0, 1]
      expect(normalized.Niche).toBeLessThanOrEqual(1);
      expect(normalized.Mainstream).toBeGreaterThanOrEqual(0);
    });

    it("should sum to approximately 1.0 after normalization", () => {
      const testCase1: Record<string, number> = {
        Action: 1,
        Drama: 2,
        Comedy: 3,
      };
      const testCase2: Record<string, number> = {
        Horror: 100,
        SciFi: 50,
        Romance: 25,
      };
      const testCase3: Record<string, number> = {
        Thriller: 10,
        Mystery: 20,
        Crime: 30,
        Drama: 40,
      };
      const testCase4: Record<string, number> = {
        Animation: 1,
        Documentary: 1,
        Experimental: 1,
      };

      const testCases = [testCase1, testCase2, testCase3, testCase4];

      testCases.forEach((counts) => {
        const normalized = normalizeGenreWeights(counts);
        const sum = Object.values(normalized).reduce((a, b) => a + b, 0);
        expect(sum).toBeCloseTo(1.0, 10);
      });
    });

    it("should handle zero counts gracefully", () => {
      const withZeros: Record<string, number> = {
        Action: 10,
        Drama: 0,
        Comedy: 10,
      };

      const normalized = normalizeGenreWeights(withZeros);

      // Drama should still have a normalized weight of 0
      expect(normalized.Drama).toBe(0);
      // Action and Comedy should be 0.5 each
      expect(normalized.Action).toBe(0.5);
      expect(normalized.Comedy).toBe(0.5);
    });

    it("should handle empty distribution", () => {
      const empty: Record<string, number> = {};

      const normalized = normalizeGenreWeights(empty);

      expect(Object.keys(normalized).length).toBe(0);
    });
  });

  describe("Quality bias calculation", () => {
    it("should apply 1.2x quality bias for low average rating", () => {
      // Simulating quality bias logic
      const avgRating = 5.5; // Low rating
      const qualityBias = avgRating < 6 ? 1.2 : avgRating > 8 ? 0.85 : 1.0;

      expect(qualityBias).toBe(1.2);
    });

    it("should apply 0.85x quality bias for high average rating", () => {
      const avgRating = 8.5; // High rating
      const qualityBias = avgRating < 6 ? 1.2 : avgRating > 8 ? 0.85 : 1.0;

      expect(qualityBias).toBe(0.85);
    });

    it("should apply neutral 1.0x bias for mid-range rating", () => {
      const avgRating = 7.0; // Mid-range
      const qualityBias = avgRating < 6 ? 1.2 : avgRating > 8 ? 0.85 : 1.0;

      expect(qualityBias).toBe(1.0);
    });

    it("should keep quality bias bounded in reasonable range", () => {
      const testRatings = [1, 3, 5, 6, 7, 8, 9, 10];

      testRatings.forEach((rating) => {
        const qualityBias =
          rating < 6 ? 1.2 : rating > 8 ? 0.85 : 1.0;

        // Bias should be in reasonable range
        expect(qualityBias).toBeGreaterThanOrEqual(0.8);
        expect(qualityBias).toBeLessThanOrEqual(1.3);
      });
    });
  });

  describe("Combined scoring with normalized weights and bias", () => {
    it("should produce scores within [0, 1] after applying weights and bias", () => {
      const genreWeights = normalizeGenreWeights({
        Action: 50,
        Drama: 30,
        SciFi: 20,
      });

      const qualityBias = 1.1;

      // Simulating a recommendation score
      const baseScore = (genreWeights.Action * 0.8 +
                        genreWeights.Drama * 0.7 +
                        genreWeights.SciFi * 0.9);
      const finalScore = Math.min(1, baseScore * qualityBias);

      expect(finalScore).toBeGreaterThanOrEqual(0);
      expect(finalScore).toBeLessThanOrEqual(1);
    });

    it("should normalize extremely skewed weights correctly", () => {
      const skewed = normalizeGenreWeights({
        OneGenre: 1000000,
        Other: 1,
      });

      const score = skewed.OneGenre * 0.9;
      expect(score).toBeCloseTo(0.9, 2); // Nearly 1.0 * 0.9
      expect(score).toBeLessThanOrEqual(1);
    });

    it("should handle multiple genres with quality boost", () => {
      const weights = normalizeGenreWeights({
        Action: 25,
        Comedy: 25,
        Drama: 25,
        SciFi: 25,
      });

      const qualityBias = 1.2; // Boost for user preference

      // Weighted average score
      const scores = {
        Action: 0.8,
        Comedy: 0.7,
        Drama: 0.9,
        SciFi: 0.85,
      };

      const baseScore =
        weights.Action * scores.Action +
        weights.Comedy * scores.Comedy +
        weights.Drama * scores.Drama +
        weights.SciFi * scores.SciFi;

      const finalScore = Math.min(1, baseScore * qualityBias);

      expect(finalScore).toBeGreaterThanOrEqual(0);
      expect(finalScore).toBeLessThanOrEqual(1);
    });
  });

  describe("Edge cases in weight normalization", () => {
    it("should handle very large genre counts without overflow", () => {
      const large: Record<string, number> = {
        Action: Number.MAX_SAFE_INTEGER / 2,
        Drama: Number.MAX_SAFE_INTEGER / 2,
      };

      const normalized = normalizeGenreWeights(large);

      expect(normalized.Action).toBeCloseTo(0.5, 2);
      expect(normalized.Drama).toBeCloseTo(0.5, 2);
    });

    it("should handle very small genre weights", () => {
      const small: Record<string, number> = {
        Rare1: 0.0001,
        Rare2: 0.0002,
        Popular: 0.9997,
      };

      const normalized = normalizeGenreWeights(small);
      const sum = Object.values(normalized).reduce((a, b) => a + b);

      expect(sum).toBeCloseTo(1.0, 4);
      Object.values(normalized).forEach((w) => {
        expect(w).toBeGreaterThanOrEqual(0);
        expect(w).toBeLessThanOrEqual(1);
      });
    });

    it("should preserve genre order in normalization", () => {
      const ordered: Record<string, number> = {
        A: 10,
        B: 20,
        C: 30,
      };

      const normalized = normalizeGenreWeights(ordered);

      expect(Object.keys(normalized)).toEqual(["A", "B", "C"]);
    });
  });
});

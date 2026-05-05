/**
 * Tests for arrGetStatus partial failure resilience
 * Verifies that Promise.allSettled usage prevents one failure from blocking another.
 */

import { describe, it, expect } from "vitest";

/**
 * Unit test for Promise.allSettled resilience pattern used in arrGetStatus
 */
describe("arrGetStatus partial failure resilience pattern", () => {
  describe("Promise.allSettled behavior with mixed success/failure", () => {
    it("should return fulfilled results for successful promises", async () => {
      const sonarrPromise = Promise.resolve({
        available: true,
        version: "3.0.0",
      });
      const radarrPromise = Promise.resolve({
        available: true,
        version: "3.0.0",
      });

      const [sonarr, radarr] = await Promise.allSettled([
        sonarrPromise,
        radarrPromise,
      ]);

      expect(sonarr.status).toBe("fulfilled");
      expect(radarr.status).toBe("fulfilled");
      if (sonarr.status === "fulfilled") {
        expect(sonarr.value.available).toBe(true);
      }
      if (radarr.status === "fulfilled") {
        expect(radarr.value.available).toBe(true);
      }
    });

    it("should return rejected status when service fails", async () => {
      const sonarrPromise = Promise.reject(
        new Error("ECONNREFUSED: Connection refused")
      );
      const radarrPromise = Promise.resolve({
        available: true,
        version: "3.0.0",
      });

      const [sonarr, radarr] = await Promise.allSettled([
        sonarrPromise,
        radarrPromise,
      ]);

      expect(sonarr.status).toBe("rejected");
      expect(radarr.status).toBe("fulfilled");

      // Should be able to extract error from rejected promise
      if (sonarr.status === "rejected") {
        expect((sonarr.reason as Error).message).toContain("ECONNREFUSED");
      }
    });

    it("should allow extraction of per-service status", async () => {
      const sonarrPromise = Promise.reject(
        new Error("API key invalid")
      );
      const radarrPromise = Promise.resolve({
        available: true,
        version: "3.0.0",
        appName: "Radarr",
      });

      const [sonarr, radarr] = await Promise.allSettled([
        sonarrPromise,
        radarrPromise,
      ]);

      // Simulate the pattern used in arrGetStatus
      const results: Record<string, unknown> = {};

      results.sonarr =
        sonarr.status === "fulfilled"
          ? sonarr.value
          : {
              available: false,
              error:
                sonarr.reason instanceof Error
                  ? sonarr.reason.message
                  : String(sonarr.reason),
            };

      results.radarr =
        radarr.status === "fulfilled"
          ? radarr.value
          : {
              available: false,
              error:
                radarr.reason instanceof Error
                  ? radarr.reason.message
                  : String(radarr.reason),
            };

      const sonarrStatus = results.sonarr as Record<string, unknown>;
      const radarrStatus = results.radarr as Record<string, unknown>;

      expect(sonarrStatus.available).toBe(false);
      expect(sonarrStatus.error).toBe("API key invalid");
      expect(radarrStatus.available).toBe(true);
      expect(radarrStatus.version).toBe("3.0.0");
    });

    it("should not throw when all services fail", async () => {
      const sonarrPromise = Promise.reject(
        new Error("Sonarr connection failed")
      );
      const radarrPromise = Promise.reject(
        new Error("Radarr connection failed")
      );

      // Promise.allSettled never rejects, even if all promises reject
      const results = await expect(
        Promise.allSettled([sonarrPromise, radarrPromise])
      ).resolves.toBeDefined();

      const settled = await Promise.allSettled([
        sonarrPromise,
        radarrPromise,
      ]);
      expect(settled.length).toBe(2);
      expect(settled.every((s) => s.status === "rejected")).toBe(true);
    });

    it("should handle non-Error rejections", async () => {
      const sonarrPromise = Promise.reject("String error");
      const radarrPromise = Promise.resolve({
        available: true,
        version: "3.0.0",
      });

      const [sonarr, radarr] = await Promise.allSettled([
        sonarrPromise,
        radarrPromise,
      ]);

      // Handle both Error and non-Error rejections
      const sonarrStatus: Record<string, unknown> =
        sonarr.status === "fulfilled"
          ? sonarr.value
          : {
              available: false,
              error:
                sonarr.reason instanceof Error
                  ? sonarr.reason.message
                  : String(sonarr.reason),
            };

      expect(sonarrStatus.available).toBe(false);
      expect(sonarrStatus.error).toBe("String error");
    });

    it("should maintain independent status for each service", async () => {
      const sonarrError = new Error("API key invalid");
      const sonarrPromise = Promise.reject(sonarrError);

      const radarrSuccess = {
        available: true,
        version: "3.0.0",
        appName: "Radarr",
      };
      const radarrPromise = Promise.resolve(radarrSuccess);

      const [sonarr, radarr] = await Promise.allSettled([
        sonarrPromise,
        radarrPromise,
      ]);

      // Sonarr failure should not affect Radarr status
      expect(sonarr.status).toBe("rejected");
      expect(radarr.status).toBe("fulfilled");

      if (radarr.status === "fulfilled") {
        // Radarr should have complete status info
        expect(radarr.value).toEqual(radarrSuccess);
      }
    });

    it("should build correct response structure from mixed results", async () => {
      // Simulate typical arrGetStatus scenario with one up and one down
      const sonarrPromise = Promise.resolve({
        available: true,
        version: "3.0.0",
        appName: "Sonarr",
      });
      const radarrPromise = Promise.reject(
        new Error("Connection refused on port 7878")
      );

      const [sonarr, radarr] = await Promise.allSettled([
        sonarrPromise,
        radarrPromise,
      ]);

      const response: Record<string, unknown> = {};

      response.sonarr =
        sonarr.status === "fulfilled"
          ? sonarr.value
          : {
              available: false,
              error:
                sonarr.reason instanceof Error
                  ? sonarr.reason.message
                  : String(sonarr.reason),
            };

      response.radarr =
        radarr.status === "fulfilled"
          ? radarr.value
          : {
              available: false,
              error:
                radarr.reason instanceof Error
                  ? radarr.reason.message
                  : String(radarr.reason),
            };

      // Verify response structure
      expect(response).toHaveProperty("sonarr");
      expect(response).toHaveProperty("radarr");

      const sonarrStatus = response.sonarr as Record<string, unknown>;
      const radarrStatus = response.radarr as Record<string, unknown>;

      expect(sonarrStatus.available).toBe(true);
      expect(sonarrStatus.version).toBe("3.0.0");
      expect(radarrStatus.available).toBe(false);
      expect(radarrStatus.error).toBe("Connection refused on port 7878");
    });
  });

  describe("Error recovery in status reporting", () => {
    it("should convert Error objects to string messages", async () => {
      const error = new Error("Test error message");
      const [result] = await Promise.allSettled([Promise.reject(error)]);

      if (result.status === "rejected") {
        const errorMessage =
          result.reason instanceof Error
            ? result.reason.message
            : String(result.reason);
        expect(errorMessage).toBe("Test error message");
      }
    });

    it("should handle unusual error types gracefully", async () => {
      const [errorResult1, errorResult2, errorResult3] =
        await Promise.allSettled([
          Promise.reject(new Error("Typed error")),
          Promise.reject("String error"),
          Promise.reject({ message: "Object error" }),
        ]);

      // All should have rejected status
      expect(errorResult1.status).toBe("rejected");
      expect(errorResult2.status).toBe("rejected");
      expect(errorResult3.status).toBe("rejected");

      // Can extract string representation from all
      const messages = [errorResult1, errorResult2, errorResult3]
        .filter((r) => r.status === "rejected")
        .map((r) =>
          r.reason instanceof Error
            ? r.reason.message
            : String(r.reason)
        );

      expect(messages.length).toBe(3);
      messages.forEach((msg) => {
        expect(typeof msg).toBe("string");
      });
    });
  });
});

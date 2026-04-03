import { describe, it, expect, beforeEach, afterEach } from "vitest";

describe("Server startup validation", () => {
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    // Save and clear relevant env vars
    for (const key of ["PLEX_URL", "PLEX_TOKEN", "SONARR_API_KEY", "RADARR_API_KEY"]) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    // Restore env vars
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it("ArrMCPFunctions throws with clear message when SONARR_API_KEY missing", async () => {
    const { ArrMCPFunctions } = await import("../arr/mcp-functions.js");
    const arr = new ArrMCPFunctions();
    await expect(arr.sonarrGetSeries({})).rejects.toThrow("SONARR_API_KEY");
  });

  it("ArrMCPFunctions throws with clear message when RADARR_API_KEY missing", async () => {
    const { ArrMCPFunctions } = await import("../arr/mcp-functions.js");
    const arr = new ArrMCPFunctions();
    await expect(arr.radarrGetMovies({})).rejects.toThrow("RADARR_API_KEY");
  });

  it("ArrMCPFunctions error message includes setup instructions", async () => {
    const { ArrMCPFunctions } = await import("../arr/mcp-functions.js");
    const arr = new ArrMCPFunctions();
    await expect(arr.sonarrGetSeries({})).rejects.toThrow("Settings → General → API Key");
  });
});

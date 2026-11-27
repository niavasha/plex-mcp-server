import { beforeEach, describe, expect, it, vi } from "vitest";
import axios from "axios";
import { PlexClient } from "../plex/client.js";

vi.mock("axios", () => ({ default: vi.fn() }));

describe("PlexClient Discover requests", () => {
  const request = vi.mocked(axios);

  beforeEach(() => {
    request.mockReset();
    request.mockResolvedValue({ data: { ok: true } });
  });

  it("sends account actions to Plex Discover with account authentication", async () => {
    const client = new PlexClient({
      baseUrl: "http://plex.local:32400/",
      token: "secret-token",
      clientIdentifier: "plex-mcp-test",
    });

    await client.makeDiscoverRequest(
      "/actions/addToWatchlist",
      { ratingKey: "abc123" },
      "PUT"
    );

    expect(request).toHaveBeenCalledWith(
      "https://discover.provider.plex.tv/actions/addToWatchlist",
      expect.objectContaining({
        method: "PUT",
        params: { ratingKey: "abc123" },
        headers: expect.objectContaining({
          "X-Plex-Token": "secret-token",
          "X-Plex-Client-Identifier": "plex-mcp-test",
          "X-Plex-Product": "plex-mcp-server",
        }),
      })
    );
  });

  // A Plex server that stops answering used to hang the call, and keep its HTTP session from expiring.
  it("gives local and Discover requests PLEX_API_TIMEOUT_SECONDS, 120 by default, unless a timeout is given", async () => {
    const client = new PlexClient({ baseUrl: "http://plex.local:32400", token: "secret-token" });
    const previous = process.env.PLEX_API_TIMEOUT_SECONDS;

    try {
      delete process.env.PLEX_API_TIMEOUT_SECONDS;
      await client.makeRequest("/library/sections");
      await client.makeDiscoverRequest("/library/sections/watchlist/all");
      process.env.PLEX_API_TIMEOUT_SECONDS = "30";
      await client.makeRequest("/library/sections");
      await client.makeDiscoverRequest("/library/sections/watchlist/all");
      // The export sets its own.
      await client.makeRequest("/library/sections", {}, "GET", { timeout: 1234 });
    } finally {
      if (previous === undefined) delete process.env.PLEX_API_TIMEOUT_SECONDS;
      else process.env.PLEX_API_TIMEOUT_SECONDS = previous;
    }

    expect(request.mock.calls.map((call) => call[1]?.timeout)).toEqual([120_000, 120_000, 30_000, 30_000, 1234]);
  });
});

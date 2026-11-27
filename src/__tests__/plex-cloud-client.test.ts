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

  // Only a library export sets a timeout (PLEX_EXPORT_TIMEOUT); other requests wait as long as Plex takes.
  it("sends local and Discover requests without a timeout unless one is given", async () => {
    const client = new PlexClient({ baseUrl: "http://plex.local:32400", token: "secret-token" });

    await client.makeRequest("/library/sections");
    await client.makeDiscoverRequest("/library/sections/watchlist/all");
    await client.makeRequest("/library/sections", {}, "GET", 1234);

    expect(request).toHaveBeenCalledTimes(3);
    expect(request.mock.calls[0][1]).toMatchObject({ timeout: undefined });
    expect(request.mock.calls[1][1]).not.toHaveProperty("timeout");
    expect(request.mock.calls[2][1]).toMatchObject({ timeout: 1234 });
  });
});

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
});

describe("PlexClient account tokens", () => {
  const request = vi.mocked(axios);
  const client = new PlexClient({ baseUrl: "http://plex.local:32400", token: "owner-token", clientIdentifier: "plex-mcp-test" });

  // plex.tv answers in XML only. Shape taken from a live response, values replaced.
  const sharedServers = `<?xml version="1.0" encoding="UTF-8"?>
<MediaContainer friendlyName="myPlex" identifier="com.plexapp.plugins.myplex" machineIdentifier="machine-1" size="2">
  <SharedServer id="9" username="user1" email="user1@example.com" userID="1111" accessToken="token-1111" name="Server 1" owned="0" allLibraries="1">
    <Section id="5" key="1" title="Movies" type="movie" shared="1"/>
  </SharedServer>
  <SharedServer id="10" username="user2" email="" userID="111" accessToken="token-111" name="Server 1" owned="0" allLibraries="1"/>
</MediaContainer>`;

  beforeEach(() => {
    request.mockReset();
    request.mockResolvedValue({ data: sharedServers });
  });

  it("asks plex.tv for the server's shared users with the configured token", async () => {
    await client.getAccountServerToken("machine-1", "111");

    expect(request).toHaveBeenCalledWith(
      "https://plex.tv/api/servers/machine-1/shared_servers",
      expect.objectContaining({
        responseType: "text",
        headers: expect.objectContaining({ "X-Plex-Token": "owner-token", "X-Plex-Client-Identifier": "plex-mcp-test" }),
      })
    );
  });

  it("returns the access token of the entry whose userID matches exactly", async () => {
    await expect(client.getAccountServerToken("machine-1", "111")).resolves.toBe("token-111");
    await expect(client.getAccountServerToken("machine-1", "1111")).resolves.toBe("token-1111");
  });

  it("returns undefined for an account with no entry, such as the owner", async () => {
    await expect(client.getAccountServerToken("machine-1", "1")).resolves.toBeUndefined();
  });

  it("withToken sends the other token to the same server", async () => {
    request.mockResolvedValue({ data: {} });

    await client.withToken("user-token").makeRequest("/library/sections");

    expect(request).toHaveBeenCalledWith(
      "http://plex.local:32400/library/sections",
      expect.objectContaining({ headers: expect.objectContaining({ "X-Plex-Token": "user-token" }) })
    );
  });
});

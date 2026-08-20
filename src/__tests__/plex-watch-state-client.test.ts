import { describe, expect, it, vi } from "vitest";
import { PlexClient } from "../plex/client.js";

describe("PlexClient watch-state operations", () => {
  it("marks media watched with Plex's scrobble endpoint", async () => {
    const client = new PlexClient({ baseUrl: "http://localhost:32400", token: "test-token" });
    const request = vi.spyOn(client, "makeRequest").mockResolvedValue({});

    await client.markAsWatched("42");

    expect(request).toHaveBeenCalledWith("/:/scrobble", {
      key: "42",
      identifier: "com.plexapp.plugins.library",
    });
  });

  it("marks media unwatched with Plex's unscrobble endpoint", async () => {
    const client = new PlexClient({ baseUrl: "http://localhost:32400", token: "test-token" });
    const request = vi.spyOn(client, "makeRequest").mockResolvedValue({});

    await client.markAsUnwatched("42");

    expect(request).toHaveBeenCalledWith("/:/unscrobble", {
      key: "42",
      identifier: "com.plexapp.plugins.library",
    });
  });
});

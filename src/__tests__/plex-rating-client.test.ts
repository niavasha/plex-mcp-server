import { describe, expect, it, vi } from "vitest";
import { PlexClient } from "../plex/client.js";

describe("PlexClient media rating", () => {
  it("sets the user's rating with Plex's rate endpoint", async () => {
    const client = new PlexClient({ baseUrl: "http://localhost:32400", token: "test-token" });
    const request = vi.spyOn(client, "makeRequest").mockResolvedValue({});

    await client.rateMedia("42", 8.5);

    expect(request).toHaveBeenCalledWith(
      "/:/rate",
      {
        key: "42",
        identifier: "com.plexapp.plugins.library",
        rating: 8.5,
      },
      "PUT"
    );
  });
});

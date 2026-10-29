import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PlexClient } from "../plex/client.js";
import { PlexTools } from "../plex/tools.js";

describe("PlexClient.getPlexTypeId", () => {
  const client = new PlexClient({ baseUrl: "http://localhost:32400", token: "test-token" });

  it.each([
    ["movie", 1],
    ["show", 2],
    ["season", 3],
    ["episode", 4],
    ["artist", 8],
    ["album", 9],
    ["track", 10],
  ])("maps %s to %i", (type, id) => {
    expect(client.getPlexTypeId(type)).toBe(id);
  });

  it("throws for an unknown type, naming the value and the allowed ones", () => {
    expect(() => client.getPlexTypeId("episodes")).toThrow(
      'Unknown media type "episodes". Expected one of: movie, show, season, episode, artist, album, track'
    );
  });

  it("does not resolve names inherited from Object.prototype", () => {
    expect(() => client.getPlexTypeId("constructor")).toThrow(/Unknown media type "constructor"/);
  });
});

describe("unknown media types in tools", () => {
  let client: PlexClient;
  let tools: PlexTools;
  let request: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    client = new PlexClient({ baseUrl: "http://localhost:32400", token: "test-token" });
    // Fail rather than reach a real server if a regression lets a request through.
    request = vi.spyOn(client, "makeRequest").mockRejectedValue(new Error("unexpected request"));
    tools = new PlexTools(client);
  });

  it("getLibraryItems fails instead of listing movies", async () => {
    await expect(tools.getLibraryItems("2", "episodes")).rejects.toThrow('Unknown media type "episodes"');
    expect(request).not.toHaveBeenCalled();
  });

  it("searchMedia fails instead of searching movies", async () => {
    await expect(tools.searchMedia("anything", "tv")).rejects.toThrow('Unknown media type "tv"');
    expect(request).not.toHaveBeenCalled();
  });

  it("getFullyWatched fails instead of falling back to a generic empty result", async () => {
    await expect(tools.getFullyWatched(undefined, "tv")).rejects.toThrow('Unknown media type "tv"');
    expect(request).not.toHaveBeenCalled();
  });

  it("getPopularContent fails instead of skipping every library", async () => {
    request.mockResolvedValue({ MediaContainer: { Directory: [{ key: "1", title: "Movies" }] } });

    await expect(tools.getPopularContent(30, "plays", "tv")).rejects.toThrow('Unknown media type "tv"');
    expect(request).toHaveBeenCalledTimes(1);
  });
});

describe("update_metadata on a season", () => {
  const ORIGINAL_MUTATIVE_ENV = process.env.PLEX_ENABLE_MUTATIVE_OPS;

  beforeEach(() => {
    process.env.PLEX_ENABLE_MUTATIVE_OPS = "true";
  });

  afterEach(() => {
    if (ORIGINAL_MUTATIVE_ENV === undefined) {
      delete process.env.PLEX_ENABLE_MUTATIVE_OPS;
    } else {
      process.env.PLEX_ENABLE_MUTATIVE_OPS = ORIGINAL_MUTATIVE_ENV;
    }
  });

  it("sends the season type id, not the movie one", async () => {
    const client = new PlexClient({ baseUrl: "http://localhost:32400", token: "test-token" });
    const request = vi.spyOn(client, "makeRequest").mockImplementation(async (endpoint: string) => {
      if (endpoint === "/library/metadata/42") {
        return { MediaContainer: { Metadata: [{ type: "season", librarySectionID: 2 }] } };
      }
      return {};
    });

    await new PlexTools(client).updateMetadata({ ratingKey: "42", genres: ["Anime"] });

    expect(request).toHaveBeenCalledWith(
      "/library/sections/2/all",
      expect.objectContaining({ id: "42", type: 3 }),
      "PUT"
    );
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PlexClient } from "../plex/client.js";
import { PlexTools } from "../plex/tools.js";
import { PLEX_TYPE_IDS } from "../plex/constants.js";
import { PLEX_TOOL_SCHEMAS } from "../plex/tool-schemas.js";

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

  it("getRecentlyWatched fails instead of returning an empty history", async () => {
    await expect(tools.getRecentlyWatched(10, "tv")).rejects.toThrow('Unknown media type "tv"');
    expect(request).not.toHaveBeenCalled();
  });

  it("getWatchHistory refuses types that never appear in watch history", async () => {
    // Valid Plex types, but history rows are movies, episodes and tracks: this would scan for nothing.
    await expect(tools.getWatchHistory(10, undefined, "season")).rejects.toThrow('Unknown media type "season"');
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

describe("type argument of the listing tools", () => {
  it.each(["get_library_items", "export_library", "search_media", "get_recently_added"])(
    "%s offers every type the server resolves",
    (name) => {
      const schema = PLEX_TOOL_SCHEMAS.find((tool) => tool.name === name);
      const properties = schema?.inputSchema.properties as Record<string, { enum?: string[] }>;
      expect(properties.type.enum).toEqual(Object.keys(PLEX_TYPE_IDS));
    }
  );
});

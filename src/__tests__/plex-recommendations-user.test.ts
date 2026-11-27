import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from "vitest";
import { PlexTools } from "../plex/tools.js";
import { PlexClient } from "../plex/client.js";
import { createPlexToolRegistry } from "../plex/tool-registry.js";
import { LibraryMovieRecord } from "../plex/types.js";

// Plex reports watch state for the account whose token makes the request; library listings
// ignore accountID. So one user's recommendations must be built from a library read with
// that user's token, and must not inherit the configured Trakt account's watch data.

const movie = (ratingKey: string, viewCount: number): LibraryMovieRecord => ({
  ratingKey,
  title: `Movie ${ratingKey}`,
  year: 2020,
  viewCount,
  lastViewedAt: viewCount > 0 ? 1000 : undefined,
  rating: 7,
  genres: ["Drama"],
  directors: [],
  actors: [],
});

/** Five watched movies (enough for a profile) and the given unwatched ones. */
const library = (prefix: string, unwatched: number) => [
  ...Array.from({ length: 5 }, (_, i) => movie(`${prefix}-w${i}`, 1)),
  ...Array.from({ length: unwatched }, (_, i) => movie(`${prefix}-u${i}`, 0)),
];

const parse = (response: { content: Array<{ text: string }> }) => JSON.parse(response.content[0].text);

describe("getRecommendations for one user", () => {
  let ownerClient: PlexClient;
  let userClient: PlexClient;
  let tools: PlexTools;

  beforeEach(() => {
    userClient = { getLibraryMoviesWithMeta: vi.fn(async () => library("user", 1)) } as unknown as PlexClient;
    ownerClient = {
      makeRequest: vi.fn(async (path: string) => {
        if (path === "/identity") return { MediaContainer: { machineIdentifier: "machine-1" } };
        throw new Error(`unexpected ${path}`);
      }),
      getLibraryMoviesWithMeta: vi.fn(async () => library("owner", 3)),
      getAccountServerToken: vi.fn(async (_machine: string, accountId: string) => (accountId === "42" ? "user-token" : undefined)),
      withToken: vi.fn(() => userClient),
    } as unknown as PlexClient;
    tools = new PlexTools(ownerClient);
  });

  it("reads the library with that user's token", async () => {
    const result = parse(await tools.getRecommendations("1", 10, "42"));

    expect(ownerClient.getAccountServerToken).toHaveBeenCalledWith("machine-1", "42");
    expect(ownerClient.withToken).toHaveBeenCalledWith("user-token");
    expect(ownerClient.getLibraryMoviesWithMeta).not.toHaveBeenCalled();
    expect(result).toMatchObject({ success: true, userId: "42", unwatchedCount: 1 });
    expect(result.recommendations.map((m: { ratingKey: string }) => m.ratingKey)).toEqual(["user-u0"]);
  });

  it("reads the configured account's library without a userId, with no plex.tv lookup", async () => {
    const result = parse(await tools.getRecommendations("1", 10));

    expect(ownerClient.getAccountServerToken).not.toHaveBeenCalled();
    expect(result).toMatchObject({ success: true, userId: "server_owner", unwatchedCount: 3 });
  });

  it("fails for an account plex.tv does not list instead of using the owner's watch state", async () => {
    await expect(tools.getRecommendations("1", 10, "77")).rejects.toThrow("No access token for account 77");
    expect(ownerClient.getLibraryMoviesWithMeta).not.toHaveBeenCalled();
  });

  it("explains that only the owner's token can look users up when plex.tv refuses it", async () => {
    (ownerClient.getAccountServerToken as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Request failed with status code 401"));

    await expect(tools.getRecommendations("1", 10, "42")).rejects.toThrow(
      /only to the server owner's token, so a non-owner PLEX_TOKEN cannot specify userId; omit it to use PLEX_TOKEN's own account: Request failed with status code 401/
    );
  });
});

describe("get_recommendations and the configured Trakt account", () => {
  const ORIGINAL_TRAKT_TOKEN = process.env.TRAKT_ACCESS_TOKEN;
  let getRecommendations: ReturnType<typeof vi.fn>;
  let traktFunctions: {
    traktGetUserStats: Mock<() => Promise<Record<string, unknown>>>;
    getWatchedMovieTitles: Mock<() => Promise<Array<{ title: string; year: number; plays: number }> | null>>;
  };

  beforeEach(() => {
    process.env.TRAKT_ACCESS_TOKEN = "test-trakt-access";
    getRecommendations = vi.fn(async () => ({ content: [{ type: "text", text: "{}" }] }));
    traktFunctions = {
      traktGetUserStats: vi.fn(async (): Promise<Record<string, unknown>> => ({ stats: { traktStats: { ratings: { distribution: { "9": 10 } } } } })),
      getWatchedMovieTitles: vi.fn(async () => [{ title: "Movie A", year: 2020, plays: 1 }]),
    };
  });

  afterEach(() => {
    if (ORIGINAL_TRAKT_TOKEN === undefined) {
      delete process.env.TRAKT_ACCESS_TOKEN;
    } else {
      process.env.TRAKT_ACCESS_TOKEN = ORIGINAL_TRAKT_TOKEN;
    }
  });

  const handle = (args: Record<string, unknown>) =>
    createPlexToolRegistry({ getRecommendations } as unknown as PlexTools, { traktFunctions }).handle("get_recommendations", args);

  it("is left out of another user's recommendations", async () => {
    await handle({ libraryKey: "1", userId: "42" });

    expect(traktFunctions.traktGetUserStats).not.toHaveBeenCalled();
    expect(traktFunctions.getWatchedMovieTitles).not.toHaveBeenCalled();
    expect(getRecommendations).toHaveBeenCalledWith("1", 10, "42", 1.0, undefined);
  });

  it.each([[undefined], ["1"]])("is used for the server owner (userId %s)", async (userId) => {
    await handle({ libraryKey: "1", ...(userId && { userId }) });

    expect(getRecommendations).toHaveBeenCalledWith("1", 10, userId, 0.85, new Set(["movie a|2020"]));
  });
});

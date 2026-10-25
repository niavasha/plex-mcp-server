import { describe, expect, it, vi } from "vitest";
import { PlexClient } from "../plex/client.js";
import { PLEX_CONTAINER_SIZE } from "../plex/constants.js";

// Plex caps each response at X-Plex-Container-Size, so a library larger than
// one page has to be walked with X-Plex-Container-Start. This fakes a server
// that honours both, optionally leaving out totalSize as some endpoints do.
type Params = Record<string, string | number> | undefined;

function pagedContainer(all: Record<string, unknown>[], params: Params, withTotal = true) {
  const start = Number(params?.["X-Plex-Container-Start"] ?? 0);
  const size = Number(params?.["X-Plex-Container-Size"] ?? all.length);
  const slice = all.slice(start, start + size);
  return {
    MediaContainer: {
      size: slice.length,
      ...(withTotal && { totalSize: all.length }),
      Metadata: slice,
    },
  };
}

const movie = (i: number) => ({
  ratingKey: String(i),
  title: `Movie ${i}`,
  guid: `plex://movie/${i}`,
  viewCount: 1,
  Guid: [{ id: `tmdb://${i}` }],
});

const SECTIONS = {
  MediaContainer: { Directory: [{ key: "2", type: "show", title: "TV Shows" }] },
};

function clientServing(all: Record<string, unknown>[], withTotal = true) {
  const client = new PlexClient({ baseUrl: "http://localhost:32400", token: "test-token" });
  const request = vi
    .spyOn(client, "makeRequest")
    .mockImplementation(async (_endpoint, params) => pagedContainer(all, params as Params, withTotal));
  return { client, request };
}

describe("PlexClient watched items span every page", () => {
  it("returns watched movies beyond the first page", async () => {
    const all = Array.from({ length: PLEX_CONTAINER_SIZE * 2 + 500 }, (_, i) => movie(i + 1));
    const { client, request } = clientServing(all);

    const movies = await client.getWatchedMovies();

    expect(movies).toHaveLength(all.length);
    expect(movies.at(-1)?.Guid).toEqual([{ id: `tmdb://${all.length}` }]);
    expect(request).toHaveBeenCalledTimes(3);
    expect(request).toHaveBeenLastCalledWith("/library/all", {
      type: 1,
      includeGuids: 1,
      "X-Plex-Container-Start": PLEX_CONTAINER_SIZE * 2,
      "X-Plex-Container-Size": PLEX_CONTAINER_SIZE,
    });
  });

  it("makes a single request when the library fits in one page", async () => {
    const { client, request } = clientServing([movie(1), movie(2)]);

    expect(await client.getWatchedMovies()).toHaveLength(2);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("keeps paging when Plex omits totalSize", async () => {
    const all = Array.from({ length: PLEX_CONTAINER_SIZE + 500 }, (_, i) => movie(i + 1));
    const { client } = clientServing(all, false);

    expect(await client.getWatchedMovies()).toHaveLength(all.length);
  });

  it("gives up with an error instead of paging forever", async () => {
    const client = new PlexClient({ baseUrl: "http://localhost:32400", token: "test-token" });
    // Always a full page and never a totalSize: a server that never ends.
    const fullPage = Array.from({ length: PLEX_CONTAINER_SIZE }, (_, i) => movie(i + 1));
    const request = vi
      .spyOn(client, "makeRequest")
      .mockResolvedValue({ MediaContainer: { size: fullPage.length, Metadata: fullPage } });

    await expect(client.getWatchedMovies()).rejects.toThrow(/page/i);
    expect(request.mock.calls.length).toBeLessThan(1000);
  });

  it("matches show ids for shows and episodes beyond the first page", async () => {
    const showCount = PLEX_CONTAINER_SIZE + 5;
    const shows = Array.from({ length: showCount }, (_, i) => ({
      ratingKey: String(10_000 + i),
      title: `Show ${i}`,
      guid: `plex://show/${i}`,
      Guid: [{ id: `tvdb://${i + 1}` }],
    }));
    const episodes = shows.map((s, i) => ({
      ratingKey: String(50_000 + i),
      title: `Pilot ${i}`,
      parentIndex: 1,
      index: 1,
      viewCount: 1,
      guid: `plex://episode/${i}`,
      grandparentRatingKey: s.ratingKey,
      grandparentGuid: s.guid,
      Guid: [{ id: `tvdb://${900_000 + i}` }],
    }));
    const client = new PlexClient({ baseUrl: "http://localhost:32400", token: "test-token" });
    vi.spyOn(client, "makeRequest").mockImplementation(async (endpoint, params) => {
      if (endpoint === "/library/sections") return SECTIONS;
      const p = params as Params;
      return pagedContainer(p?.type === 2 ? shows : episodes, p);
    });

    const watched = await client.getWatchedEpisodes();

    expect(watched).toHaveLength(showCount);
    const last = watched.at(-1)!;
    expect(last.ratingKey).toBe(String(50_000 + showCount - 1));
    expect(last.show?.Guid).toEqual([{ id: `tvdb://${showCount}` }]);
  });
});

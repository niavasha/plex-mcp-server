import { describe, it, expect, vi, beforeEach } from "vitest";
import { PlexTools } from "../plex/tools.js";
import { PlexClient } from "../plex/client.js";
import { SUMMARY_PREVIEW_LENGTH } from "../plex/constants.js";

/** Create a mock PlexClient without hitting any real server */
function createMockClient() {
  return {
    makeRequest: vi.fn(),
    getPlexTypeId: vi.fn(() => 1),
  } as unknown as PlexClient;
}

/** Parse the JSON text from an MCP response */
function parseResponse(response: { content: Array<{ text: string }> }) {
  return JSON.parse(response.content[0].text);
}

function mockSessions(client: PlexClient, container: unknown) {
  (client.makeRequest as ReturnType<typeof vi.fn>).mockResolvedValue(container);
}

/** A realistic /status/sessions payload. Note Media is an ARRAY — see
 *  python-plexapi: "media (List<Media>) – List of media objects." */
const FULL_SESSION = {
  MediaContainer: {
    size: 1,
    Metadata: [
      {
        ratingKey: "12345",
        sessionKey: "9",
        title: "The Wire",
        type: "episode",
        grandparentTitle: "The Wire",
        parentTitle: "Season 1",
        summary: "Short summary",
        duration: 3600000,
        viewOffset: 120000,
        User: { title: "harry" },
        Player: { title: "Living Room TV", state: "playing", platform: "tvOS" },
        Session: { location: "lan" },
        TranscodeSession: { videoDecision: "transcode", audioDecision: "copy" },
        Media: [
          { videoResolution: "4k", videoCodec: "hevc", audioCodec: "eac3" },
        ],
      },
    ],
  },
};

describe("PlexTools.getActiveSessions", () => {
  let client: ReturnType<typeof createMockClient>;
  let tools: PlexTools;

  beforeEach(() => {
    client = createMockClient();
    tools = new PlexTools(client as unknown as PlexClient);
  });

  it("queries the /status/sessions endpoint", async () => {
    mockSessions(client, FULL_SESSION);
    await tools.getActiveSessions();
    expect(client.makeRequest).toHaveBeenCalledWith("/status/sessions");
  });

  it("returns core stream identity fields", async () => {
    mockSessions(client, FULL_SESSION);
    const s = parseResponse(await tools.getActiveSessions()).activeSessions[0];

    expect(s).toMatchObject({
      ratingKey: "12345",
      title: "The Wire",
      type: "episode",
      grandparentTitle: "The Wire",
      parentTitle: "Season 1",
      duration: 3600000,
      viewOffset: 120000,
    });
  });

  it("reports who is watching, on what, and in what state", async () => {
    mockSessions(client, FULL_SESSION);
    const s = parseResponse(await tools.getActiveSessions()).activeSessions[0];

    expect(s.user).toBe("harry");
    expect(s.player).toEqual({
      title: "Living Room TV",
      state: "playing",
      platform: "tvOS",
    });
    expect(s.session).toEqual({ location: "lan" });
  });

  it("reports transcode decisions", async () => {
    mockSessions(client, FULL_SESSION);
    const s = parseResponse(await tools.getActiveSessions()).activeSessions[0];

    expect(s.transcode).toEqual({
      videoDecision: "transcode",
      audioDecision: "copy",
    });
  });

  // Regression: Media is a LIST in the Plex API. Reading it as an object
  // yields undefined for every field while still producing valid-looking JSON.
  it("reads media details from the Media array, not as an object", async () => {
    mockSessions(client, FULL_SESSION);
    const s = parseResponse(await tools.getActiveSessions()).activeSessions[0];

    expect(s.media).toEqual({
      videoResolution: "4k",
      videoCodec: "hevc",
      audioCodec: "eac3",
    });
  });

  it("exposes sessionKey so a specific stream can be identified", async () => {
    mockSessions(client, FULL_SESSION);
    const s = parseResponse(await tools.getActiveSessions()).activeSessions[0];
    expect(s.sessionKey).toBe("9");
  });

  it("returns an empty list when nothing is playing", async () => {
    mockSessions(client, { MediaContainer: { size: 0 } });
    const result = parseResponse(await tools.getActiveSessions());

    expect(result.activeSessions).toEqual([]);
    expect(result.sessionCount).toBe(0);
  });

  it("derives sessionCount from the returned sessions, not a trusted size field", async () => {
    mockSessions(client, {
      MediaContainer: {
        size: 99, // Plex can report a stale/paged size
        Metadata: [{ ratingKey: "1", title: "A" }, { ratingKey: "2", title: "B" }],
      },
    });
    const result = parseResponse(await tools.getActiveSessions());
    expect(result.sessionCount).toBe(2);
  });

  it("handles a session with no user, player, transcode or media blocks", async () => {
    mockSessions(client, {
      MediaContainer: { size: 1, Metadata: [{ ratingKey: "1", title: "Bare" }] },
    });
    const s = parseResponse(await tools.getActiveSessions()).activeSessions[0];

    expect(s.user).toBeNull();
    expect(s.player).toBeNull();
    expect(s.session).toBeNull();
    expect(s.transcode).toBeNull();
    expect(s.media).toBeNull();
  });

  it("treats an empty Media array as no media rather than throwing", async () => {
    mockSessions(client, {
      MediaContainer: { size: 1, Metadata: [{ ratingKey: "1", title: "X", Media: [] }] },
    });
    const s = parseResponse(await tools.getActiveSessions()).activeSessions[0];
    expect(s.media).toBeNull();
  });

  it("truncates long summaries to the project-wide preview length", async () => {
    mockSessions(client, {
      MediaContainer: {
        size: 1,
        Metadata: [{ ratingKey: "1", title: "X", summary: "A".repeat(2000) }],
      },
    });
    const s = parseResponse(await tools.getActiveSessions()).activeSessions[0];

    expect(s.summary.length).toBeLessThanOrEqual(SUMMARY_PREVIEW_LENGTH + 3);
    expect(s.summary.startsWith("AAA")).toBe(true);
  });

  it("omits summary when the session has none", async () => {
    mockSessions(client, {
      MediaContainer: { size: 1, Metadata: [{ ratingKey: "1", title: "X" }] },
    });
    const s = parseResponse(await tools.getActiveSessions()).activeSessions[0];
    expect(s.summary).toBeUndefined();
  });

  it("tolerates a MediaContainer with no Metadata key at all", async () => {
    mockSessions(client, { MediaContainer: {} });
    const result = parseResponse(await tools.getActiveSessions());
    expect(result.activeSessions).toEqual([]);
    expect(result.sessionCount).toBe(0);
  });
});

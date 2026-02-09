/**
 * MCP tool schema definitions for Sonarr/Radarr tools.
 * Mirrors the pattern from plex/tool-schemas.ts and trakt/tool-schemas.ts.
 */

// ──── Sonarr schemas (8) ────

export const SONARR_TOOL_SCHEMAS = [
  {
    name: "sonarr_get_series",
    description: "List all series in Sonarr with optional title filter",
    inputSchema: {
      type: "object" as const,
      properties: {
        filter: { type: "string", description: "Optional title substring filter" },
      },
    },
  },
  {
    name: "sonarr_search",
    description: "Search TheTVDB for new series to add to Sonarr",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Search query (series title)" },
      },
      required: ["query"],
    },
  },
  {
    name: "sonarr_add_series",
    description: "Add a new series to Sonarr by TVDB ID",
    inputSchema: {
      type: "object" as const,
      properties: {
        tvdbId: { type: "number", description: "TheTVDB ID of the series" },
        title: { type: "string", description: "Series title" },
        qualityProfileId: { type: "number", description: "Quality profile ID (auto-detected if omitted)" },
        rootFolderPath: { type: "string", description: "Root folder path (auto-detected if omitted)" },
        monitored: { type: "boolean", description: "Whether to monitor the series (default: true)", default: true },
        seasonFolder: { type: "boolean", description: "Use season folders (default: true)", default: true },
        monitorType: {
          type: "string",
          description: "Which episodes to monitor",
          enum: ["all", "future", "missing", "existing", "firstSeason", "latestSeason", "none"],
          default: "all",
        },
        searchForMissingEpisodes: { type: "boolean", description: "Search for missing episodes after adding (default: true)", default: true },
      },
      required: ["tvdbId", "title"],
    },
  },
  {
    name: "sonarr_get_missing",
    description: "Get missing/wanted episodes from Sonarr",
    inputSchema: {
      type: "object" as const,
      properties: {
        page: { type: "number", description: "Page number (default: 1)", default: 1 },
        pageSize: { type: "number", description: "Items per page (default: 50)", default: 50 },
      },
    },
  },
  {
    name: "sonarr_get_queue",
    description: "Get the current Sonarr download queue",
    inputSchema: { type: "object" as const, properties: {} },
  },
  {
    name: "sonarr_get_calendar",
    description: "Get upcoming episodes from the Sonarr calendar",
    inputSchema: {
      type: "object" as const,
      properties: {
        startDate: { type: "string", description: "Start date (YYYY-MM-DD, default: 7 days ago)" },
        endDate: { type: "string", description: "End date (YYYY-MM-DD, default: 30 days from now)" },
      },
    },
  },
  {
    name: "sonarr_get_profiles",
    description: "Get Sonarr quality profiles and root folders (needed before adding series)",
    inputSchema: { type: "object" as const, properties: {} },
  },
  {
    name: "sonarr_trigger_search",
    description: "Trigger a search for missing episodes, optionally for a specific series",
    inputSchema: {
      type: "object" as const,
      properties: {
        seriesId: { type: "number", description: "Sonarr series ID (omit to search all missing)" },
      },
    },
  },
];

// ──── Radarr schemas (8) ────

export const RADARR_TOOL_SCHEMAS = [
  {
    name: "radarr_get_movies",
    description: "List all movies in Radarr with optional title filter",
    inputSchema: {
      type: "object" as const,
      properties: {
        filter: { type: "string", description: "Optional title substring filter" },
      },
    },
  },
  {
    name: "radarr_search",
    description: "Search TMDB for new movies to add to Radarr",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Search query (movie title)" },
      },
      required: ["query"],
    },
  },
  {
    name: "radarr_add_movie",
    description: "Add a new movie to Radarr by TMDB ID",
    inputSchema: {
      type: "object" as const,
      properties: {
        tmdbId: { type: "number", description: "The Movie Database (TMDB) ID" },
        title: { type: "string", description: "Movie title" },
        qualityProfileId: { type: "number", description: "Quality profile ID (auto-detected if omitted)" },
        rootFolderPath: { type: "string", description: "Root folder path (auto-detected if omitted)" },
        monitored: { type: "boolean", description: "Whether to monitor the movie (default: true)", default: true },
        minimumAvailability: {
          type: "string",
          description: "When the movie is considered available",
          enum: ["announced", "inCinemas", "released", "preDB"],
          default: "released",
        },
        searchForMovie: { type: "boolean", description: "Search for the movie after adding (default: true)", default: true },
      },
      required: ["tmdbId", "title"],
    },
  },
  {
    name: "radarr_get_missing",
    description: "Get missing/wanted movies from Radarr",
    inputSchema: {
      type: "object" as const,
      properties: {
        page: { type: "number", description: "Page number (default: 1)", default: 1 },
        pageSize: { type: "number", description: "Items per page (default: 50)", default: 50 },
      },
    },
  },
  {
    name: "radarr_get_queue",
    description: "Get the current Radarr download queue",
    inputSchema: { type: "object" as const, properties: {} },
  },
  {
    name: "radarr_get_calendar",
    description: "Get upcoming movies from the Radarr calendar",
    inputSchema: {
      type: "object" as const,
      properties: {
        startDate: { type: "string", description: "Start date (YYYY-MM-DD, default: 7 days ago)" },
        endDate: { type: "string", description: "End date (YYYY-MM-DD, default: 30 days from now)" },
      },
    },
  },
  {
    name: "radarr_get_profiles",
    description: "Get Radarr quality profiles and root folders (needed before adding movies)",
    inputSchema: { type: "object" as const, properties: {} },
  },
  {
    name: "radarr_trigger_search",
    description: "Trigger a search for missing movies, optionally for a specific movie",
    inputSchema: {
      type: "object" as const,
      properties: {
        movieId: { type: "number", description: "Radarr movie ID (omit to search all missing)" },
      },
    },
  },
];

// ──── Cross-service schemas (1) ────

export const ARR_CROSS_TOOL_SCHEMAS = [
  {
    name: "arr_get_status",
    description: "Check connection status of Sonarr and Radarr services",
    inputSchema: { type: "object" as const, properties: {} },
  },
];

/** All 17 Arr tool schemas */
export const ARR_TOOL_SCHEMAS = [
  ...SONARR_TOOL_SCHEMAS,
  ...RADARR_TOOL_SCHEMAS,
  ...ARR_CROSS_TOOL_SCHEMAS,
];

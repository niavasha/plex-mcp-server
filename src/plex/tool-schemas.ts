/**
 * MCP tool schema definitions for Plex tools.
 * Defined once, used by both servers.
 */

const GET_LIBRARIES_SCHEMA = {
  name: "get_libraries",
  description: "Get all Plex libraries",
  inputSchema: {
    type: "object" as const,
    properties: {},
  },
};

const GET_LIBRARY_ITEMS_SCHEMA = {
  name: "get_library_items",
  description: "List items in a library with pagination (useful for large libraries)",
  inputSchema: {
    type: "object" as const,
    properties: {
      libraryKey: { type: "string", description: "Library section key" },
      type: {
        type: "string",
        description: "Media type (movie, show, episode, artist, album, track)",
        enum: ["movie", "show", "episode", "artist", "album", "track"],
      },
      limit: { type: "number", description: "Number of items to return (default: 200)", default: 200 },
      offset: { type: "number", description: "Zero-based offset for pagination (default: 0)", default: 0 },
      sort: { type: "string", description: "Sort order (optional, e.g., titleSort:asc)" },
    },
    required: ["libraryKey"],
  },
};

const EXPORT_LIBRARY_SCHEMA = {
  name: "export_library",
  description: "Export a full library to a JSON file (within ./exports)",
  inputSchema: {
    type: "object" as const,
    properties: {
      libraryKey: { type: "string", description: "Library section key" },
      type: {
        type: "string",
        description: "Media type (movie, show, episode, artist, album, track)",
        enum: ["movie", "show", "episode", "artist", "album", "track"],
      },
      outputPath: {
        type: "string",
        description:
          "Optional relative path under ./exports (default: library_{key}_{timestamp}.json)",
      },
      pageSize: { type: "number", description: "Items per page for export (default: 500)", default: 500 },
    },
    required: ["libraryKey"],
  },
};

const SEARCH_MEDIA_SCHEMA = {
  name: "search_media",
  description: "Search for media in Plex libraries",
  inputSchema: {
    type: "object" as const,
    properties: {
      query: { type: "string", description: "Search query" },
      type: {
        type: "string",
        description: "Media type (movie, show, episode, artist, album, track)",
        enum: ["movie", "show", "episode", "artist", "album", "track"],
      },
      libraryKey: { type: "string", description: "Library section key to restrict search (optional)" },
      limit: { type: "number", description: "Number of items to return (default: 50)", default: 50 },
      offset: { type: "number", description: "Zero-based offset for pagination (default: 0)", default: 0 },
    },
    required: ["query"],
  },
};

const GET_RECENTLY_ADDED_SCHEMA = {
  name: "get_recently_added",
  description: "Get recently added media",
  inputSchema: {
    type: "object" as const,
    properties: {
      limit: { type: "number", description: "Number of items to return (default: 10)", default: 10 },
    },
  },
};

const GET_ON_DECK_SCHEMA = {
  name: "get_on_deck",
  description: "Get on deck (continue watching) items",
  inputSchema: {
    type: "object" as const,
    properties: {},
  },
};

const GET_MEDIA_DETAILS_SCHEMA = {
  name: "get_media_details",
  description: "Get detailed information about a specific media item",
  inputSchema: {
    type: "object" as const,
    properties: {
      ratingKey: { type: "string", description: "The rating key of the media item" },
    },
    required: ["ratingKey"],
  },
};

const GET_EDITABLE_FIELDS_SCHEMA = {
  name: "get_editable_fields",
  description: "Get editable fields and available tags for a media item",
  inputSchema: {
    type: "object" as const,
    properties: {
      ratingKey: { type: "string", description: "The rating key of the media item" },
    },
    required: ["ratingKey"],
  },
};

const GET_PLAYLIST_ITEMS_SCHEMA = {
  name: "get_playlist_items",
  description: "Get items in a Plex playlist",
  inputSchema: {
    type: "object" as const,
    properties: {
      playlistId: { type: "string", description: "Playlist rating key" },
    },
    required: ["playlistId"],
  },
};

const GET_PLAYLISTS_SCHEMA = {
  name: "get_playlists",
  description: "Get all Plex playlists",
  inputSchema: {
    type: "object" as const,
    properties: {},
  },
};

const GET_WATCHLIST_SCHEMA = {
  name: "get_watchlist",
  description: "Get the user's Plex watchlist",
  inputSchema: {
    type: "object" as const,
    properties: {},
  },
};

const GET_RECENTLY_WATCHED_SCHEMA = {
  name: "get_recently_watched",
  description: "Get recently watched movies and shows",
  inputSchema: {
    type: "object" as const,
    properties: {
      limit: { type: "number", description: "Number of items to return (default: 25)", default: 25 },
      mediaType: {
        type: "string",
        description: "Filter by media type (movie, show, episode, all)",
        enum: ["movie", "show", "episode", "all"],
        default: "all",
      },
    },
  },
};

const GET_WATCH_HISTORY_SCHEMA = {
  name: "get_watch_history",
  description: "Get detailed watch history with session information",
  inputSchema: {
    type: "object" as const,
    properties: {
      limit: { type: "number", description: "Number of sessions to return (default: 50)", default: 50 },
      userId: { type: "string", description: "Filter by specific user ID (optional)" },
      mediaType: {
        type: "string",
        description: "Filter by media type",
        enum: ["movie", "show", "episode", "all"],
        default: "all",
      },
    },
  },
};

const GET_FULLY_WATCHED_SCHEMA = {
  name: "get_fully_watched",
  description: "Get all fully watched movies and shows from a library",
  inputSchema: {
    type: "object" as const,
    properties: {
      libraryKey: { type: "string", description: "Library section key (optional, searches all if not provided)" },
      mediaType: {
        type: "string",
        description: "Filter by media type (movie, show, all)",
        enum: ["movie", "show", "all"],
        default: "all",
      },
      limit: { type: "number", description: "Number of items to return (default: 100)", default: 100 },
    },
  },
};

const GET_WATCH_STATS_SCHEMA = {
  name: "get_watch_stats",
  description: "Get comprehensive watch statistics (Tautulli-style analytics)",
  inputSchema: {
    type: "object" as const,
    properties: {
      timeRange: { type: "number", description: "Time range in days (default: 30)", default: 30 },
      statType: {
        type: "string",
        description: "Type of statistics to retrieve",
        enum: ["plays", "duration", "users", "libraries", "platforms"],
        default: "plays",
      },
    },
  },
};

const GET_USER_STATS_SCHEMA = {
  name: "get_user_stats",
  description: "Get user-specific watch statistics",
  inputSchema: {
    type: "object" as const,
    properties: {
      timeRange: { type: "number", description: "Time range in days (default: 30)", default: 30 },
    },
  },
};

const GET_LIBRARY_STATS_SCHEMA = {
  name: "get_library_stats",
  description: "Get library-specific statistics",
  inputSchema: {
    type: "object" as const,
    properties: {
      libraryKey: { type: "string", description: "Library section key (optional)" },
    },
  },
};

const GET_POPULAR_CONTENT_SCHEMA = {
  name: "get_popular_content",
  description: "Get most popular content by plays or duration",
  inputSchema: {
    type: "object" as const,
    properties: {
      timeRange: { type: "number", description: "Time range in days (default: 30)", default: 30 },
      metric: {
        type: "string",
        description: "Sort by plays or total duration",
        enum: ["plays", "duration"],
        default: "plays",
      },
      mediaType: {
        type: "string",
        description: "Filter by media type",
        enum: ["movie", "show", "episode", "all"],
        default: "all",
      },
      limit: { type: "number", description: "Number of items to return (default: 10)", default: 10 },
    },
  },
};

/** Core tools shared by both servers (13 tools) */
export const PLEX_CORE_TOOL_SCHEMAS = [
  GET_LIBRARIES_SCHEMA,
  GET_LIBRARY_ITEMS_SCHEMA,
  EXPORT_LIBRARY_SCHEMA,
  SEARCH_MEDIA_SCHEMA,
  GET_RECENTLY_ADDED_SCHEMA,
  GET_ON_DECK_SCHEMA,
  GET_MEDIA_DETAILS_SCHEMA,
  GET_EDITABLE_FIELDS_SCHEMA,
  GET_PLAYLIST_ITEMS_SCHEMA,
  GET_PLAYLISTS_SCHEMA,
  GET_WATCHLIST_SCHEMA,
  GET_RECENTLY_WATCHED_SCHEMA,
  GET_WATCH_HISTORY_SCHEMA,
];

/** Extended analytics tools (5 tools) — only in standalone Plex server */
const PLEX_EXTENDED_TOOL_SCHEMAS = [
  GET_FULLY_WATCHED_SCHEMA,
  GET_WATCH_STATS_SCHEMA,
  GET_USER_STATS_SCHEMA,
  GET_LIBRARY_STATS_SCHEMA,
  GET_POPULAR_CONTENT_SCHEMA,
];

/** All 18 Plex tool schemas */
export const PLEX_TOOL_SCHEMAS = [
  ...PLEX_CORE_TOOL_SCHEMAS,
  ...PLEX_EXTENDED_TOOL_SCHEMAS,
];

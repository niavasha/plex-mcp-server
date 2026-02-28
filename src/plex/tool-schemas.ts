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
const UPDATE_METADATA_SCHEMA = {
  name: "update_metadata",
  description: "Update metadata fields for a media item (requires PLEX_ENABLE_MUTATIVE_OPS=true)",
  inputSchema: {
    type: "object" as const,
    properties: {
      ratingKey: { type: "string", description: "The rating key of the media item to update" },
      title: { type: "string", description: "New title (optional)" },
      sortTitle: { type: "string", description: "New sort title (optional)" },
      originalTitle: { type: "string", description: "New original title (optional)" },
      summary: { type: "string", description: "New summary/description (optional)" },
      year: { type: "number", description: "New year (optional)" },
      contentRating: { type: "string", description: "New content rating (optional)" },
      rating: { type: "number", description: "New user rating (optional)" },
      tagline: { type: "string", description: "New tagline (optional)" },
      studio: { type: "string", description: "New studio (optional)" },
      genres: { type: "array", description: "Replace genres with these tags (optional)", items: { type: "string" } },
      collections: {
        type: "array",
        description: "Replace collections with these tags (optional)",
        items: { type: "string" },
      },
      roles: { type: "array", description: "Replace roles/actors with these tags (optional)", items: { type: "string" } },
      directors: {
        type: "array",
        description: "Replace directors with these tags (optional)",
        items: { type: "string" },
      },
    },
    required: ["ratingKey"],
  },
};

const UPDATE_METADATA_FROM_JSON_SCHEMA = {
  name: "update_metadata_from_json",
  description: "Update metadata from a JSON payload (requires PLEX_ENABLE_MUTATIVE_OPS=true)",
  inputSchema: {
    type: "object" as const,
    properties: {
      ratingKey: { type: "string", description: "The rating key of the media item to update" },
      metadata: { type: "object", description: "Metadata payload to apply" },
      setPosterFromUrl: {
        type: "boolean",
        description: "Attempt to set poster from metadata.images.posters[0].url",
        default: false,
      },
    },
    required: ["ratingKey", "metadata"],
  },
};

const CREATE_PLAYLIST_SCHEMA = {
  name: "create_playlist",
  description: "Create a new Plex playlist (requires PLEX_ENABLE_MUTATIVE_OPS=true)",
  inputSchema: {
    type: "object" as const,
    properties: {
      title: { type: "string", description: "Playlist title" },
      type: {
        type: "string",
        description: "Playlist type (video, audio, photo) or media type (movie, show, episode, artist, album, track)",
        enum: ["video", "audio", "photo", "movie", "show", "episode", "artist", "album", "track"],
      },
      ratingKeys: { type: "array", description: "Optional list of rating keys", items: { type: "string" } },
      smart: { type: "boolean", description: "Create smart playlist (default: false)", default: false },
    },
    required: ["title", "type"],
  },
};

const ADD_TO_PLAYLIST_SCHEMA = {
  name: "add_to_playlist",
  description: "Add a media item to a playlist (requires PLEX_ENABLE_MUTATIVE_OPS=true)",
  inputSchema: {
    type: "object" as const,
    properties: {
      playlistId: { type: "string", description: "Playlist rating key" },
      ratingKey: { type: "string", description: "Media rating key to add" },
    },
    required: ["playlistId", "ratingKey"],
  },
};

const REMOVE_FROM_PLAYLIST_SCHEMA = {
  name: "remove_from_playlist",
  description: "Remove an item from a playlist (requires PLEX_ENABLE_MUTATIVE_OPS=true)",
  inputSchema: {
    type: "object" as const,
    properties: {
      playlistId: { type: "string", description: "Playlist rating key" },
      playlistItemId: { type: "string", description: "Playlist item ID to remove" },
    },
    required: ["playlistId", "playlistItemId"],
  },
};

const CLEAR_PLAYLIST_SCHEMA = {
  name: "clear_playlist",
  description: "Clear all items from a playlist (preview unless confirm=true; requires PLEX_ENABLE_MUTATIVE_OPS=true)",
  inputSchema: {
    type: "object" as const,
    properties: {
      playlistId: { type: "string", description: "Playlist rating key" },
      confirm: { type: "boolean", description: "Set true to execute clear after preview", default: false },
    },
    required: ["playlistId"],
  },
};

const ADD_TO_WATCHLIST_SCHEMA = {
  name: "add_to_watchlist",
  description: "Add a media item to watchlist (requires PLEX_ENABLE_MUTATIVE_OPS=true)",
  inputSchema: {
    type: "object" as const,
    properties: {
      ratingKey: { type: "string", description: "The rating key of the media item" },
    },
    required: ["ratingKey"],
  },
};

const REMOVE_FROM_WATCHLIST_SCHEMA = {
  name: "remove_from_watchlist",
  description: "Remove a media item from watchlist (requires PLEX_ENABLE_MUTATIVE_OPS=true)",
  inputSchema: {
    type: "object" as const,
    properties: {
      ratingKey: { type: "string", description: "The rating key of the media item" },
    },
    required: ["ratingKey"],
  },
};
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
/** Mutative tools (8 tools) — registered only when opt-in is enabled */
export const PLEX_MUTATIVE_TOOL_SCHEMAS = [
  UPDATE_METADATA_SCHEMA,
  UPDATE_METADATA_FROM_JSON_SCHEMA,
  CREATE_PLAYLIST_SCHEMA,
  ADD_TO_PLAYLIST_SCHEMA,
  REMOVE_FROM_PLAYLIST_SCHEMA,
  CLEAR_PLAYLIST_SCHEMA,
  ADD_TO_WATCHLIST_SCHEMA,
  REMOVE_FROM_WATCHLIST_SCHEMA,
];
export const PLEX_TOOL_SCHEMAS = [
  ...PLEX_CORE_TOOL_SCHEMAS,
  ...PLEX_EXTENDED_TOOL_SCHEMAS,
];

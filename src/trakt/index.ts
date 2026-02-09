/**
 * Trakt Integration Module
 * Main exports for the Trakt.tv integration
 */

export { TraktClient } from './client.js';
export { PlexToTraktMapper } from './mapper.js';
export { TraktSyncEngine } from './sync.js';
export { TraktMCPFunctions } from './mcp-functions.js';

export * from './types.js';

export type {
  PlexMovie,
  PlexEpisode,
  PlexWatchSession
} from './mapper.js';
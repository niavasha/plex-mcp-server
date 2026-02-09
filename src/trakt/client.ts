/**
 * Trakt.tv API Client
 * Handles authentication, rate limiting, and API communication
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import {
  TraktConfig,
  TraktTokens,
  TraktUser,
  TraktMovie,
  TraktShow,
  TraktWatchedMovie,
  TraktWatchedShow,
  TraktScrobbleItem,
  TraktScrobbleResponse,
  TraktSyncRequest,
  TraktSyncResult,
  TraktUserStats,
  TraktProgress,
  TraktAPIError,
} from './types.js';
import {
  TRAKT_OAUTH_URL,
  TRAKT_API_TIMEOUT,
  TRAKT_INITIAL_RATE_LIMIT_DELAY,
  TRAKT_DEFAULT_RETRY_AFTER,
  TRAKT_RATE_LIMIT_BACKOFF_MULTIPLIER,
} from './constants.js';
import { sleep } from '../shared/utils.js';

export interface TraktSearchResult {
  type: string;
  score: number;
  movie?: TraktMovie;
  show?: TraktShow;
}

export class TraktClient {
  private config: TraktConfig;
  private http: AxiosInstance;
  private rateLimitDelay: number = TRAKT_INITIAL_RATE_LIMIT_DELAY;
  private lastRequestTime: number = 0;

  constructor(config: TraktConfig) {
    this.config = config;
    this.http = axios.create({
      baseURL: config.baseUrl,
      timeout: TRAKT_API_TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
        'trakt-api-version': '2',
        'trakt-api-key': config.clientId,
        'User-Agent': 'PlexMCPServer/1.0'
      }
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor for authentication and rate limiting
    this.http.interceptors.request.use(async (config) => {
      // Rate limiting - ensure we don't exceed limits
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequestTime;
      if (timeSinceLastRequest < this.rateLimitDelay) {
        await sleep(this.rateLimitDelay - timeSinceLastRequest);
      }
      this.lastRequestTime = Date.now();

      // Add authorization header if we have a token
      if (this.config.accessToken) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${this.config.accessToken}`;
      }

      return config;
    });

    // Response interceptor for error handling and token refresh
    this.http.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        if (error.response?.status === 429) {
          // Rate limited - increase delay and retry
          const retryAfter = parseInt(error.response.headers['retry-after'] || String(TRAKT_DEFAULT_RETRY_AFTER));
          this.rateLimitDelay = Math.max(this.rateLimitDelay * TRAKT_RATE_LIMIT_BACKOFF_MULTIPLIER, retryAfter * 1000);

          console.warn(`Trakt rate limit hit. Waiting ${retryAfter}s before retry. New delay: ${this.rateLimitDelay}ms`);

          await sleep(retryAfter * 1000);
          return this.http.request(error.config!);
        }

        if (error.response?.status === 401) {
          // Unauthorized - try to refresh token
          if (this.config.refreshToken) {
            try {
              await this.refreshAccessToken();
              // Retry the original request with new token
              if (error.config) {
                error.config.headers = error.config.headers || {};
                error.config.headers.Authorization = `Bearer ${this.config.accessToken}`;
                return this.http.request(error.config);
              }
            } catch (refreshError) {
              throw new Error('Token refresh failed. Re-authentication required.');
            }
          }
        }

        // Handle other errors
        if (error.response?.data) {
          const traktError = error.response.data as TraktAPIError;
          throw new Error(`Trakt API Error: ${traktError.error_description || traktError.error}`);
        }

        throw error;
      }
    );
  }

  /**
   * Generate OAuth authorization URL
   */
  generateAuthUrl(state?: string): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      state: state || 'default'
    });

    return `${TRAKT_OAUTH_URL}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(code: string): Promise<TraktTokens> {
    try {
      const response = await this.http.post<TraktTokens>('/oauth/token', {
        code,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        redirect_uri: this.config.redirectUri,
        grant_type: 'authorization_code'
      });

      const tokens = response.data;
      tokens.created_at = Math.floor(Date.now() / 1000);

      // Store tokens in config
      this.config.accessToken = tokens.access_token;
      this.config.refreshToken = tokens.refresh_token;

      return tokens;
    } catch (error) {
      throw new Error(`Token exchange failed: ${error}`);
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(): Promise<TraktTokens> {
    if (!this.config.refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      const response = await this.http.post<TraktTokens>('/oauth/token', {
        refresh_token: this.config.refreshToken,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        redirect_uri: this.config.redirectUri,
        grant_type: 'refresh_token'
      });

      const tokens = response.data;
      tokens.created_at = Math.floor(Date.now() / 1000);

      // Update stored tokens
      this.config.accessToken = tokens.access_token;
      this.config.refreshToken = tokens.refresh_token;

      return tokens;
    } catch (error) {
      throw new Error(`Token refresh failed: ${error}`);
    }
  }

  /**
   * Get current user information
   */
  async getCurrentUser(): Promise<TraktUser> {
    const response = await this.http.get<TraktUser>('/users/me');
    return response.data;
  }

  /**
   * Get user's watched movies
   */
  async getWatchedMovies(): Promise<TraktWatchedMovie[]> {
    const response = await this.http.get<TraktWatchedMovie[]>('/sync/watched/movies');
    return response.data;
  }

  /**
   * Get user's watched shows
   */
  async getWatchedShows(): Promise<TraktWatchedShow[]> {
    const response = await this.http.get<TraktWatchedShow[]>('/sync/watched/shows');
    return response.data;
  }

  /**
   * Get user statistics
   */
  async getUserStats(): Promise<TraktUserStats> {
    const response = await this.http.get<TraktUserStats>('/users/me/stats');
    return response.data;
  }

  /**
   * Get watching progress
   */
  async getWatchingProgress(): Promise<TraktProgress[]> {
    const response = await this.http.get<TraktProgress[]>('/sync/playback');
    return response.data;
  }

  /**
   * Sync watched movies to Trakt
   */
  async syncWatchedMovies(movies: TraktSyncRequest['movies']): Promise<TraktSyncResult> {
    const response = await this.http.post<TraktSyncResult>('/sync/history', {
      movies
    });
    return response.data;
  }

  /**
   * Sync watched shows to Trakt
   */
  async syncWatchedShows(shows: TraktSyncRequest['shows']): Promise<TraktSyncResult> {
    const response = await this.http.post<TraktSyncResult>('/sync/history', {
      shows
    });
    return response.data;
  }

  /**
   * Sync watched episodes to Trakt
   */
  async syncWatchedEpisodes(episodes: TraktSyncRequest['episodes']): Promise<TraktSyncResult> {
    const response = await this.http.post<TraktSyncResult>('/sync/history', {
      episodes
    });
    return response.data;
  }

  /**
   * Start scrobbling (watching started)
   */
  async scrobbleStart(item: TraktScrobbleItem): Promise<TraktScrobbleResponse> {
    const response = await this.http.post<TraktScrobbleResponse>('/scrobble/start', item);
    return response.data;
  }

  /**
   * Pause scrobbling (watching paused)
   */
  async scrobblePause(item: TraktScrobbleItem): Promise<TraktScrobbleResponse> {
    const response = await this.http.post<TraktScrobbleResponse>('/scrobble/pause', item);
    return response.data;
  }

  /**
   * Stop scrobbling (watching stopped/finished)
   */
  async scrobbleStop(item: TraktScrobbleItem): Promise<TraktScrobbleResponse> {
    const response = await this.http.post<TraktScrobbleResponse>('/scrobble/stop', item);
    return response.data;
  }

  /**
   * Remove items from watch history
   */
  async removeFromHistory(request: TraktSyncRequest): Promise<TraktSyncResult> {
    const response = await this.http.post<TraktSyncResult>('/sync/history/remove', request);
    return response.data;
  }

  /**
   * Search for movies/shows on Trakt
   */
  async search(query: string, type?: 'movie' | 'show', year?: number): Promise<TraktSearchResult[]> {
    const params = new URLSearchParams({ query });
    if (type) params.append('type', type);
    if (year) params.append('year', year.toString());

    const response = await this.http.get(`/search/${type || 'movie,show'}?${params.toString()}`);
    return response.data;
  }

  /**
   * Get movie details by Trakt ID
   */
  async getMovie(id: string | number): Promise<TraktMovie> {
    const response = await this.http.get(`/movies/${id}?extended=full`);
    return response.data;
  }

  /**
   * Get show details by Trakt ID
   */
  async getShow(id: string | number): Promise<TraktShow> {
    const response = await this.http.get(`/shows/${id}?extended=full`);
    return response.data;
  }

  /**
   * Test API connection and authentication
   */
  async testConnection(): Promise<{ success: boolean; user?: TraktUser; error?: string }> {
    try {
      if (!this.config.accessToken) {
        return { success: false, error: 'No access token configured' };
      }

      const user = await this.getCurrentUser();
      return { success: true, user };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Update configuration (for token updates)
   */
  updateConfig(updates: Partial<TraktConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Get current configuration (excluding sensitive data)
   */
  getConfig(): Omit<TraktConfig, 'clientSecret' | 'accessToken' | 'refreshToken'> {
    const { clientSecret, accessToken, refreshToken, ...safeConfig } = this.config;
    return safeConfig;
  }
}
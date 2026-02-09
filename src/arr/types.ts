/**
 * Sonarr/Radarr shared and service-specific types
 */

// --- Configuration ---

export interface ArrConfig {
  baseUrl: string;
  apiKey: string;
}

// --- Shared types ---

export interface ArrQualityProfile {
  id: number;
  name: string;
  upgradeAllowed: boolean;
  cutoff: number;
}

export interface ArrRootFolder {
  id: number;
  path: string;
  accessible: boolean;
  freeSpace: number;
}

export interface ArrSystemStatus {
  appName: string;
  version: string;
  buildTime: string;
  isDebug: boolean;
  isProduction: boolean;
  isAdmin: boolean;
  isUserInteractive: boolean;
  startupPath: string;
  appData: string;
  osName: string;
  osVersion: string;
  isDocker: boolean;
  branch: string;
  authentication: string;
  urlBase: string;
  instanceName: string;
}

export interface ArrQueueItem {
  id: number;
  title: string;
  status: string;
  trackedDownloadStatus: string;
  trackedDownloadState: string;
  statusMessages: Array<{ title: string; messages: string[] }>;
  downloadId: string;
  protocol: string;
  downloadClient: string;
  indexer: string;
  outputPath: string;
  size: number;
  sizeleft: number;
  timeleft: string;
  estimatedCompletionTime: string;
}

export interface ArrQueueResponse {
  page: number;
  pageSize: number;
  sortKey: string;
  sortDirection: string;
  totalRecords: number;
  records: ArrQueueItem[];
}

// --- Sonarr types ---

export interface SonarrSeriesStatistics {
  seasonCount: number;
  episodeFileCount: number;
  episodeCount: number;
  totalEpisodeCount: number;
  sizeOnDisk: number;
  releaseGroups: string[];
  percentOfEpisodes: number;
}

export interface SonarrSeason {
  seasonNumber: number;
  monitored: boolean;
  statistics: {
    episodeFileCount: number;
    episodeCount: number;
    totalEpisodeCount: number;
    percentOfEpisodes: number;
    sizeOnDisk: number;
  };
}

export interface SonarrSeries {
  id: number;
  title: string;
  sortTitle: string;
  status: string;
  ended: boolean;
  overview: string;
  network: string;
  airTime: string;
  images: Array<{ coverType: string; remoteUrl: string }>;
  seasons: SonarrSeason[];
  year: number;
  path: string;
  qualityProfileId: number;
  seasonFolder: boolean;
  monitored: boolean;
  runtime: number;
  tvdbId: number;
  tvRageId: number;
  tvMazeId: number;
  imdbId: string;
  titleSlug: string;
  certification: string;
  genres: string[];
  tags: number[];
  added: string;
  ratings: { votes: number; value: number };
  statistics: SonarrSeriesStatistics;
}

export interface SonarrEpisode {
  id: number;
  seriesId: number;
  tvdbId: number;
  episodeFileId: number;
  seasonNumber: number;
  episodeNumber: number;
  title: string;
  airDate: string;
  airDateUtc: string;
  overview: string;
  hasFile: boolean;
  monitored: boolean;
}

export interface SonarrSearchResult {
  tvdbId: number;
  title: string;
  overview: string;
  status: string;
  images: Array<{ coverType: string; remoteUrl: string }>;
  seasons: Array<{ seasonNumber: number; monitored: boolean }>;
  year: number;
  network: string;
  runtime: number;
  genres: string[];
  ratings: { votes: number; value: number };
  certification: string;
}

export interface SonarrCalendarEntry {
  id: number;
  seriesId: number;
  tvdbId: number;
  episodeFileId: number;
  seasonNumber: number;
  episodeNumber: number;
  title: string;
  airDate: string;
  airDateUtc: string;
  overview: string;
  hasFile: boolean;
  monitored: boolean;
  series?: {
    id: number;
    title: string;
    network: string;
  };
}

export interface SonarrMissingResponse {
  page: number;
  pageSize: number;
  sortKey: string;
  sortDirection: string;
  totalRecords: number;
  records: SonarrEpisode[];
}

export interface SonarrAddSeriesRequest {
  tvdbId: number;
  title: string;
  qualityProfileId: number;
  rootFolderPath: string;
  monitored: boolean;
  seasonFolder: boolean;
  addOptions: {
    monitor: string;
    searchForMissingEpisodes: boolean;
    searchForCutoffUnmetEpisodes: boolean;
  };
}

// --- Radarr types ---

export interface RadarrMovie {
  id: number;
  title: string;
  sortTitle: string;
  sizeOnDisk: number;
  status: string;
  overview: string;
  inCinemas: string;
  physicalRelease: string;
  digitalRelease: string;
  images: Array<{ coverType: string; remoteUrl: string }>;
  year: number;
  path: string;
  qualityProfileId: number;
  hasFile: boolean;
  monitored: boolean;
  minimumAvailability: string;
  isAvailable: boolean;
  folderName: string;
  runtime: number;
  tmdbId: number;
  imdbId: string;
  titleSlug: string;
  certification: string;
  genres: string[];
  tags: number[];
  added: string;
  ratings: { imdb: { votes: number; value: number }; tmdb: { votes: number; value: number } };
  movieFile?: {
    id: number;
    relativePath: string;
    size: number;
    quality: { quality: { id: number; name: string } };
  };
}

export interface RadarrSearchResult {
  tmdbId: number;
  imdbId: string;
  title: string;
  overview: string;
  status: string;
  images: Array<{ coverType: string; remoteUrl: string }>;
  year: number;
  runtime: number;
  genres: string[];
  ratings: { imdb?: { votes: number; value: number }; tmdb?: { votes: number; value: number } };
  certification: string;
}

export interface RadarrCalendarEntry {
  id: number;
  title: string;
  sortTitle: string;
  status: string;
  overview: string;
  inCinemas: string;
  physicalRelease: string;
  digitalRelease: string;
  year: number;
  hasFile: boolean;
  monitored: boolean;
  tmdbId: number;
  imdbId: string;
}

export interface RadarrMissingResponse {
  page: number;
  pageSize: number;
  sortKey: string;
  sortDirection: string;
  totalRecords: number;
  records: RadarrMovie[];
}

export interface RadarrAddMovieRequest {
  tmdbId: number;
  title: string;
  qualityProfileId: number;
  rootFolderPath: string;
  monitored: boolean;
  minimumAvailability: string;
  addOptions: {
    searchForMovie: boolean;
  };
}

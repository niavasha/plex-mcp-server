/**
 * Arr Tool Registry — eliminates switch statement for Sonarr/Radarr tool dispatch.
 * Reuses ToolRegistry class from plex/tool-registry.ts.
 */

import { ToolRegistry } from "../plex/tool-registry.js";
import { ArrMCPFunctions } from "./mcp-functions.js";
import { formatToolPayload } from "../shared/output-format.js";

export function createArrToolRegistry(arrFunctions: ArrMCPFunctions): ToolRegistry {
  const registry = new ToolRegistry();

  // ──── Sonarr tools ────

  registry.register("sonarr_get_series", (args) =>
    arrFunctions.sonarrGetSeries({ filter: args.filter as string | undefined, limit: args.limit as number | undefined }).then(wrapResponse)
  );

  registry.register("sonarr_search", (args) =>
    arrFunctions.sonarrSearch({ query: args.query as string, limit: args.limit as number | undefined }).then(wrapResponse)
  );

  registry.register("sonarr_add_series", (args) =>
    arrFunctions.sonarrAddSeries({
      tvdbId: args.tvdbId as number,
      title: args.title as string,
      qualityProfileId: args.qualityProfileId as number | undefined,
      rootFolderPath: args.rootFolderPath as string | undefined,
      monitored: args.monitored as boolean | undefined,
      seasonFolder: args.seasonFolder as boolean | undefined,
      monitorType: args.monitorType as string | undefined,
      seriesType: args.seriesType as string | undefined,
      searchForMissingEpisodes: args.searchForMissingEpisodes as boolean | undefined,
      searchForCutoffUnmetEpisodes: args.searchForCutoffUnmetEpisodes as boolean | undefined,
      tags: args.tags as string[] | undefined,
    }).then(wrapResponse)
  );

  registry.register("sonarr_get_missing", (args) =>
    arrFunctions.sonarrGetMissing({
      page: args.page as number | undefined,
      pageSize: args.pageSize as number | undefined,
    }).then(wrapResponse)
  );

  registry.register("sonarr_get_queue", (args) =>
    arrFunctions.sonarrGetQueue({ limit: args.limit as number | undefined }).then(wrapResponse)
  );

  registry.register("sonarr_get_calendar", (args) =>
    arrFunctions.sonarrGetCalendar({
      startDate: args.startDate as string | undefined,
      endDate: args.endDate as string | undefined,
      limit: args.limit as number | undefined,
    }).then(wrapResponse)
  );

  registry.register("sonarr_get_profiles", () =>
    arrFunctions.sonarrGetProfiles().then(wrapResponse)
  );

  registry.register("sonarr_trigger_search", (args) =>
    arrFunctions.sonarrTriggerSearch({
      seriesId: args.seriesId as number | undefined,
    }).then(wrapResponse)
  );

  registry.register("sonarr_get_tags", () =>
    arrFunctions.sonarrGetTags().then(wrapResponse)
  );

  registry.register("sonarr_create_tag", (args) =>
    arrFunctions.sonarrCreateTag({ label: args.label as string }).then(wrapResponse)
  );

  registry.register("sonarr_update_tag", (args) =>
    arrFunctions.sonarrUpdateTag({ id: args.id as number, label: args.label as string }).then(wrapResponse)
  );

  registry.register("sonarr_delete_tag", (args) =>
    arrFunctions.sonarrDeleteTag({ id: args.id as number }).then(wrapResponse)
  );

  // ──── Radarr tools ────

  registry.register("radarr_get_movies", (args) =>
    arrFunctions.radarrGetMovies({ filter: args.filter as string | undefined, limit: args.limit as number | undefined }).then(wrapResponse)
  );

  registry.register("radarr_search", (args) =>
    arrFunctions.radarrSearch({ query: args.query as string, limit: args.limit as number | undefined }).then(wrapResponse)
  );

  registry.register("radarr_add_movie", (args) =>
    arrFunctions.radarrAddMovie({
      tmdbId: args.tmdbId as number,
      title: args.title as string,
      qualityProfileId: args.qualityProfileId as number | undefined,
      rootFolderPath: args.rootFolderPath as string | undefined,
      monitored: args.monitored as boolean | undefined,
      minimumAvailability: args.minimumAvailability as string | undefined,
      monitorType: args.monitorType as string | undefined,
      searchForMovie: args.searchForMovie as boolean | undefined,
      tags: args.tags as string[] | undefined,
    }).then(wrapResponse)
  );

  registry.register("radarr_get_missing", (args) =>
    arrFunctions.radarrGetMissing({
      page: args.page as number | undefined,
      pageSize: args.pageSize as number | undefined,
    }).then(wrapResponse)
  );

  registry.register("radarr_get_queue", (args) =>
    arrFunctions.radarrGetQueue({ limit: args.limit as number | undefined }).then(wrapResponse)
  );

  registry.register("radarr_get_calendar", (args) =>
    arrFunctions.radarrGetCalendar({
      startDate: args.startDate as string | undefined,
      endDate: args.endDate as string | undefined,
      limit: args.limit as number | undefined,
    }).then(wrapResponse)
  );

  registry.register("radarr_get_profiles", () =>
    arrFunctions.radarrGetProfiles().then(wrapResponse)
  );

  registry.register("radarr_trigger_search", (args) =>
    arrFunctions.radarrTriggerSearch({
      movieId: args.movieId as number | undefined,
    }).then(wrapResponse)
  );

  registry.register("radarr_get_tags", () =>
    arrFunctions.radarrGetTags().then(wrapResponse)
  );

  registry.register("radarr_create_tag", (args) =>
    arrFunctions.radarrCreateTag({ label: args.label as string }).then(wrapResponse)
  );

  registry.register("radarr_update_tag", (args) =>
    arrFunctions.radarrUpdateTag({ id: args.id as number, label: args.label as string }).then(wrapResponse)
  );

  registry.register("radarr_delete_tag", (args) =>
    arrFunctions.radarrDeleteTag({ id: args.id as number }).then(wrapResponse)
  );

  // ──── Cross-service tools ────

  registry.register("arr_get_status", () =>
    arrFunctions.arrGetStatus().then(wrapResponse)
  );

  return registry;
}

function wrapResponse(data: Record<string, unknown>) {
  return { content: [{ type: "text", text: formatToolPayload(data) }] };
}

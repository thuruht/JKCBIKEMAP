/**
 * tasks/index.ts
 *
 * Orchestrates daily data-sync tasks for JKC.
 */

import { logger } from "../lib/logger.js";
import type { Env } from "../types.js";
import { syncGisData } from "./sync-gis.js";
import { syncKmlConstruction } from "./sync-kml-construction.js";
import { syncMarcBikeways } from "./sync-marc-bikeways.js";
import { syncOsmData } from "./sync-osm.js";

export interface SyncSummary {
  ok: boolean;
  marc: {
    bikeways: number;
    metrogreen: number;
    trailAccess: number;
  };
  gis: number;
  osm: number;
  kml: number;
  error?: string;
}

export async function runAllSyncs(env: Env): Promise<SyncSummary> {
  logger.info("Running all data sync tasks", undefined, "SYNC");
  try {
    const marc = await syncMarcBikeways(env);
    const gis = await syncGisData(env);
    const osm = await syncOsmData(env);
    const kml = await syncKmlConstruction(env);

    const summary: SyncSummary = {
      ok: true,
      marc,
      gis,
      osm,
      kml,
    };

    logger.info("All data sync tasks complete", summary, "SYNC");
    return summary;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    logger.error("Data sync runner failed", e, "SYNC");
    return { ok: false, marc: { bikeways: 0, metrogreen: 0, trailAccess: 0 }, gis: 0, osm: 0, kml: 0, error: message };
  }
}

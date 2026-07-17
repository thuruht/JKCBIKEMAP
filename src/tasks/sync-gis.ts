/**
 * sync-gis.ts
 *
 * Fetches authoritative MARC GIS point-of-interest data and imports it into
 * the JKC `features` / `feature_geometries` tables.
 */

import { logger } from "../lib/logger.js";
import type { Env } from "../types.js";

interface GeoJSONFeature {
  geometry?: {
    type: string;
    coordinates: [number, number];
  };
  properties: Record<string, any>;
}

interface GeoJSONFeatureCollection {
  features: GeoJSONFeature[];
}

interface GISRow {
  id: string;
  slug: string;
  name: string;
  category: string;
  officiality: string;
  description: string;
  lat: number;
  lon: number;
  geom: string;
  sourceUrl: string;
  sourceNote: string;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

async function upsertGeometry(env: Env, featureId: string, geom: string) {
  const update = await env.DB.prepare(
    "UPDATE feature_geometries SET public_geometry = ? WHERE feature_id = ?"
  )
    .bind(geom, featureId)
    .run() as any;
  if ((update.meta?.changes ?? 0) === 0) {
    await env.DB.prepare(
      "INSERT INTO feature_geometries (feature_id, public_geometry) VALUES (?, ?)"
    )
      .bind(featureId, geom)
      .run();
  }
}

export async function syncGisData(env: Env): Promise<number> {
  logger.info("Starting MARC GIS sync", undefined, "SYNC");

  const endpoints = [
    {
      key: "restroom",
      category: "Water / Restrooms",
      url: "https://gis2.marc2.org/arcgis/rest/services/Recreation/PublicRestrooms/MapServer/0/query?where=1=1&outFields=*&f=geojson",
      sourceNote: "MARC Public Restrooms",
      parse: (feat: GeoJSONFeature) => ({
        name: feat.properties.ParkName
          ? `${feat.properties.ParkName} Restroom`
          : "Public Restroom",
        description: feat.properties.Address || "",
      }),
    },
    {
      key: "bike_hub",
      category: "Ride anchors",
      url: "https://gis2.marc2.org/arcgis/rest/services/Recreation/RideKCBikehubs/MapServer/0/query?where=1=1&outFields=*&f=geojson",
      sourceNote: "MARC RideKC Bike Hubs",
      parse: (feat: GeoJSONFeature) => ({
        name: feat.properties.Name || "RideKC Bike Hub",
        description: feat.properties.PopupInfo ? "RideKC Bike Share Location" : "",
      }),
    },
    {
      key: "food",
      category: "Food / Rest Stop",
      url: "https://gis2.marc2.org/arcgis/rest/services/Temporary/WorldCup/MapServer/1/query?where=1=1&outFields=*&f=geojson",
      sourceNote: "MARC Food POIs",
      parse: (feat: GeoJSONFeature) => ({
        name: feat.properties.name || "Food / Rest Stop",
        description: feat.properties.Address || "",
      }),
    },
  ];

  let totalInserted = 0;

  for (const endpoint of endpoints) {
    try {
      logger.info(`Fetching ${endpoint.key}`, { url: endpoint.url }, "SYNC");
      const resp = await fetch(endpoint.url);
      if (!resp.ok) {
        logger.error(`Failed to fetch ${endpoint.key}`, { status: resp.status }, "SYNC");
        continue;
      }

      const data = (await resp.json()) as GeoJSONFeatureCollection;
      const features = data.features || [];
      logger.info(`Got ${features.length} ${endpoint.key} features`, undefined, "SYNC");

      const rows: GISRow[] = [];
      for (const feat of features) {
        if (!feat.geometry || feat.geometry.type !== "Point") continue;
        const [lon, lat] = feat.geometry.coordinates;
        const parsed = endpoint.parse(feat);
        const id = `marc:gis:${endpoint.key}:${lat.toFixed(5)}:${lon.toFixed(5)}`;
        const slugBase = slugify(parsed.name).slice(0, 40) || endpoint.key;
        rows.push({
          id,
          slug: `${slugBase}-${crypto.randomUUID().slice(0, 8)}`,
          name: parsed.name,
          category: endpoint.category,
          officiality: "official",
          description: parsed.description,
          lat,
          lon,
          geom: JSON.stringify({ type: "Point", coordinates: [lon, lat] }),
          sourceUrl: endpoint.url,
          sourceNote: endpoint.sourceNote,
        });
      }

      const featureStmt = env.DB.prepare(
        "INSERT OR IGNORE INTO features (id, slug, name, feature_type, category, status, visibility, officiality, public_description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
      );
      const sourceStmt = env.DB.prepare(
        "INSERT OR IGNORE INTO feature_sources (id, feature_id, source_url, source_note) VALUES (?, ?, ?, ?)"
      );

      const BATCH = 50;
      for (let i = 0; i < rows.length; i += BATCH) {
        const chunk = rows.slice(i, i + BATCH);
        const batch: any[] = [];
        for (const row of chunk) {
          batch.push(
            featureStmt.bind(
              row.id,
              row.slug,
              row.name,
              "point",
              row.category,
              "active",
              "public",
              row.officiality,
              row.description || null
            )
          );
          batch.push(
            sourceStmt.bind(
              `${row.id}:${endpoint.key}:source`,
              row.id,
              row.sourceUrl,
              row.sourceNote
            )
          );
        }
        await env.DB.batch(batch);
        for (const row of chunk) {
          await upsertGeometry(env, row.id, row.geom);
        }
      }

      totalInserted += rows.length;
      logger.info(`Inserted ${rows.length} ${endpoint.key} items`, undefined, "SYNC");
    } catch (e) {
      logger.error(`Error processing GIS endpoint ${endpoint.key}`, e, "SYNC");
    }
  }

  logger.info("GIS sync complete", { totalInserted }, "SYNC");
  return totalInserted;
}

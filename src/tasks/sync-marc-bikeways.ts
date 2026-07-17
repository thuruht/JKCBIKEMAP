/**
 * sync-marc-bikeways.ts
 *
 * Syncs MARC regional bikeways, MetroGreen corridors, and trail access points
 * into the JKC `features` / `feature_geometries` tables.
 */

import { logger } from "../lib/logger.js";
import type { Env } from "../types.js";

interface ArcGISFeature {
  geometry?: { type: string; coordinates: any };
  properties: Record<string, any>;
}

interface ArcGISResponse {
  features?: ArcGISFeature[];
  exceededTransferLimit?: boolean;
}

const MARC_SERVER = "https://gis2.marc2.org/arcgis/rest/services";

async function fetchArcGISPage(
  url: string,
  offset = 0,
  limit = 1000
): Promise<ArcGISResponse> {
  const sep = url.includes("?") ? "&" : "?";
  const pageUrl = `${url}${sep}resultOffset=${offset}&resultRecordCount=${limit}`;
  const res = await fetch(pageUrl);
  if (!res.ok) throw new Error(`ArcGIS fetch failed: ${res.status} for ${pageUrl}`);
  return (await res.json()) as ArcGISResponse;
}

async function fetchAllPages(
  baseUrl: string,
  pageSize = 1000
): Promise<ArcGISFeature[]> {
  const allFeatures: ArcGISFeature[] = [];
  let offset = 0;
  while (true) {
    const data = await fetchArcGISPage(baseUrl, offset, pageSize);
    const features = data.features || [];
    if (!features.length) break;
    allFeatures.push(...features);
    if (!data.exceededTransferLimit) break;
    offset += features.length;
  }
  return allFeatures;
}

function computeCentroid(geom: { type: string; coordinates: any }): { lat: number; lon: number } {
  if (geom.type === "Point") {
    const [lon, lat] = geom.coordinates;
    return { lat, lon };
  }
  if (geom.type === "MultiLineString") {
    let sumLat = 0,
      sumLon = 0,
      count = 0;
    for (const line of geom.coordinates) {
      for (const [lon, lat] of line) {
        sumLon += lon;
        sumLat += lat;
        count++;
      }
    }
    return count > 0 ? { lat: sumLat / count, lon: sumLon / count } : { lat: 0, lon: 0 };
  }
  let sumLat = 0,
    sumLon = 0,
    count = 0;
  for (const [lon, lat] of geom.coordinates || []) {
    sumLon += lon;
    sumLat += lat;
    count++;
  }
  return count > 0 ? { lat: sumLat / count, lon: sumLon / count } : { lat: 0, lon: 0 };
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

interface MappedFeature {
  id: string;
  slug: string;
  name: string;
  featureType: "point" | "line" | "polygon";
  category: string;
  status: string;
  officiality: string;
  publicDescription: string;
  surfaceNote: string;
  geom: string;
  sourceUrl: string;
  sourceNote: string;
}

async function upsertGeometry(env: Env, featureId: string, geom: string) {
  const update = (await env.DB.prepare(
    "UPDATE feature_geometries SET public_geometry = ? WHERE feature_id = ?"
  )
    .bind(geom, featureId)
    .run()) as any;
  if ((update.meta?.changes ?? 0) === 0) {
    await env.DB.prepare(
      "INSERT INTO feature_geometries (feature_id, public_geometry) VALUES (?, ?)"
    )
      .bind(featureId, geom)
      .run();
  }
}

async function insertRows(env: Env, rows: MappedFeature[]) {
  const featureStmt = env.DB.prepare(
    "INSERT OR IGNORE INTO features (id, slug, name, feature_type, category, status, visibility, officiality, public_description, surface_note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
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
          row.featureType,
          row.category,
          row.status,
          "public",
          row.officiality,
          row.publicDescription || null,
          row.surfaceNote || null
        )
      );
      batch.push(
        sourceStmt.bind(
          `${row.id}:source`,
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
}

function buildBikewayRows(features: ArcGISFeature[]): MappedFeature[] {
  const rows: MappedFeature[] = [];
  for (const feat of features) {
    const p = feat.properties;
    const geom = feat.geometry;
    if (!geom) continue;
    const centroid = computeCentroid(geom);
    if (!centroid.lat || !centroid.lon) continue;

    const name = p.RouteName || p.FacilityType || "Unnamed Bikeway";
    const surface = p.SurfaceType || "";
    const lengthMiles = parseFloat(p.LengthInMiles) || 0;
    const widthFeet = parseFloat(p.WidthInFeet) || null;
    const status = p.Status || "";
    const park = p.ParkName || "";
    const jurisdiction = p.Jurisdiction || "";
    const county = p.County || "";
    const descParts = [
      park ? `Located in ${park}` : "",
      jurisdiction ? `Jurisdiction: ${jurisdiction}` : "",
      county ? `County: ${county}` : "",
      p.OnOffRoad === "Off Road" ? "Off-road facility" : "",
      widthFeet ? `Width: ${widthFeet}ft` : "",
      lengthMiles ? `${lengthMiles.toFixed(1)} miles` : "",
    ].filter(Boolean);
    const description = descParts.join(". ");
    const idBase = `${p.RouteName || "bikeway"}_${p.FacilityType || "unknown"}`;
    const id = `marc:bikeway:${slugify(idBase)}_${centroid.lat.toFixed(5)}_${centroid.lon.toFixed(5)}`;

    rows.push({
      id,
      slug: `${slugify(name).slice(0, 40) || "bikeway"}-${crypto.randomUUID().slice(0, 8)}`,
      name,
      featureType: geom.type === "Point" ? "point" : "line",
      category: "Official Regional Data",
      status: "active",
      officiality: "official",
      publicDescription: description,
      surfaceNote: surface,
      geom: JSON.stringify(geom),
      sourceUrl: `${MARC_SERVER}/Recreation/BikewaysAndTrails/MapServer/10/query?where=1%3D1&outFields=*&returnGeometry=true&f=geojson&outSR=4326`,
      sourceNote: "MARC Regional Bikeways and Trails",
    });
  }
  return rows;
}

function buildMetrogreenRows(features: ArcGISFeature[]): MappedFeature[] {
  const rows: MappedFeature[] = [];
  for (const feat of features) {
    const p = feat.properties;
    const geom = feat.geometry;
    if (!geom) continue;
    const centroid = computeCentroid(geom);
    if (!centroid.lat || !centroid.lon) continue;
    const name = p.Name || p.Label || "MetroGreen Corridor";
    const phase = p.Phase || "";
    const miles = parseFloat(p.Miles) || 0;
    const county = p.County || "";
    const corridor = p.Corridor || "";
    const notes = p.Notes || "";
    const descParts = [
      corridor ? `Corridor: ${corridor}` : "",
      county ? `County: ${county}` : "",
      notes,
      miles ? `${miles.toFixed(1)} miles` : "",
    ].filter(Boolean);
    const description = descParts.join(". ");
    const id = `marc:metrogreen:${slugify(name)}_${centroid.lat.toFixed(5)}_${centroid.lon.toFixed(5)}`;

    rows.push({
      id,
      slug: `${slugify(name).slice(0, 40) || "metrogreen"}-${crypto.randomUUID().slice(0, 8)}`,
      name,
      featureType: geom.type === "Point" ? "point" : "line",
      category: "Planned / in progress",
      status: "planned",
      officiality: "planned",
      publicDescription: description,
      surfaceNote: "",
      geom: JSON.stringify(geom),
      sourceUrl: `${MARC_SERVER}/Recreation/Metrogreen_Corridors/MapServer/0/query?where=1%3D1&outFields=*&returnGeometry=true&f=geojson&outSR=4326`,
      sourceNote: "MARC MetroGreen Corridors",
    });
  }
  return rows;
}

function buildTrailAccessRows(features: ArcGISFeature[]): MappedFeature[] {
  const rows: MappedFeature[] = [];
  for (const feat of features) {
    const p = feat.properties;
    const lat = p.Latitude ?? feat.geometry?.coordinates?.[1];
    const lon = p.Longitude ?? feat.geometry?.coordinates?.[0];
    if (!lat || !lon) continue;
    const name = p.TrailName || "Trail Access Point";
    const address = p.Address || "";
    const county = p.County || "";
    const descParts = [address, county ? `County: ${county}` : ""].filter(Boolean);
    const description = descParts.join(". ");
    const id = `marc:trail_access:${slugify(name)}_${Number(lat).toFixed(5)}_${Number(lon).toFixed(5)}`;
    const pointGeom = feat.geometry
      ? JSON.stringify(feat.geometry)
      : JSON.stringify({ type: "Point", coordinates: [lon, lat] });

    rows.push({
      id,
      slug: `${slugify(name).slice(0, 40) || "trail-access"}-${crypto.randomUUID().slice(0, 8)}`,
      name,
      featureType: "point",
      category: "Ride anchors",
      status: "active",
      officiality: "official",
      publicDescription: description,
      surfaceNote: "",
      geom: pointGeom,
      sourceUrl: `${MARC_SERVER}/Recreation/Trail_Address/MapServer/0/query?where=1%3D1&outFields=*&returnGeometry=true&f=geojson&outSR=4326`,
      sourceNote: "MARC Trail Access Points",
    });
  }
  return rows;
}

export async function syncMarcBikeways(env: Env): Promise<{
  bikeways: number;
  metrogreen: number;
  trailAccess: number;
}> {
  logger.info("Starting MARC bikeway sync", undefined, "SYNC");
  const result = { bikeways: 0, metrogreen: 0, trailAccess: 0 };

  try {
    const base = `${MARC_SERVER}/Recreation/BikewaysAndTrails/MapServer/10/query?where=1%3D1&outFields=RouteName,FacilityType,FacilitySubType,SurfaceType,Status,LengthInMiles,WidthInFeet,County,Jurisdiction,ParkName,OnOffRoad,City,RegionalBikewayPlan,MetroGreen&returnGeometry=true&f=geojson&outSR=4326`;
    const features = await fetchAllPages(base, 5000);
    const rows = buildBikewayRows(features);
    await insertRows(env, rows);
    result.bikeways = rows.length;
    logger.info(`Inserted ${rows.length} bikeways`, undefined, "SYNC");
  } catch (e) {
    logger.error("BikewaysAndTrails sync failed", e, "SYNC");
  }

  try {
    const base = `${MARC_SERVER}/Recreation/Metrogreen_Corridors/MapServer/0/query?where=1%3D1&outFields=Name,Label,Phase,Miles,County,Corridor,Notes&returnGeometry=true&f=geojson&outSR=4326`;
    const features = await fetchAllPages(base, 1000);
    const rows = buildMetrogreenRows(features);
    await insertRows(env, rows);
    result.metrogreen = rows.length;
    logger.info(`Inserted ${rows.length} metrogreen corridors`, undefined, "SYNC");
  } catch (e) {
    logger.error("Metrogreen sync failed", e, "SYNC");
  }

  try {
    const base = `${MARC_SERVER}/Recreation/Trail_Address/MapServer/0/query?where=1%3D1&outFields=TrailName,Address,County,Latitude,Longitude&returnGeometry=true&f=geojson&outSR=4326`;
    const features = await fetchAllPages(base, 1000);
    const rows = buildTrailAccessRows(features);
    await insertRows(env, rows);
    result.trailAccess = rows.length;
    logger.info(`Inserted ${rows.length} trail access points`, undefined, "SYNC");
  } catch (e) {
    logger.error("Trail_Address sync failed", e, "SYNC");
  }

  logger.info("MARC bikeway sync complete", result, "SYNC");
  return result;
}

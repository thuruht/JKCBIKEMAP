/**
 * sync-osm.ts
 *
 * Fetches trail / path / construction data from OpenStreetMap via Overpass
 * and imports it into the JKC `features` / `feature_geometries` tables.
 * Railway features are skipped because JKC already has a rail tile overlay.
 */

import { logger } from "../lib/logger.js";
import type { Env } from "../types.js";

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const USER_AGENT = "JojoKCMap/1.0 (contact: admin@jojomap.kcmo.xyz)";
const BBOX = "38.8,-95.0,39.4,-94.2";

const TRAIL_QUERIES = `
  way["highway"="cycleway"](${BBOX});
  way["highway"="path"]["bicycle"="yes"](${BBOX});
  way["highway"="path"]["route"="bicycle"](${BBOX});
  way["highway"="track"]["bicycle"="yes"](${BBOX});
  way["highway"="footway"]["bicycle"="yes"](${BBOX});
  way["highway"="footbridge"](${BBOX});
  way["bridge"="yes"]["highway"="path"](${BBOX});
  way["bridge"="yes"]["highway"="cycleway"](${BBOX});
  way["bridge"="yes"]["highway"="footway"]["bicycle"="yes"](${BBOX});
  way["highway"="construction"]["construction"="cycleway"](${BBOX});
  way["highway"="construction"]["construction"="path"](${BBOX});
  way["highway"="construction"]["construction"="footbridge"](${BBOX});
  relation["route"="bicycle"](${BBOX});
`;

interface OsmRow {
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

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function buildOsmGeom(e: any): { type: string; coordinates: any } | null {
  const t = e.tags || {};
  if (e.type === "node") {
    return { type: "Point", coordinates: [e.lon, e.lat] };
  }
  if (e.geometry && Array.isArray(e.geometry) && e.geometry.length >= 2) {
    const coords = e.geometry.map((n: any) => [n.lon, n.lat]);
    return { type: "LineString", coordinates: coords };
  }
  const lat = e.center?.lat ?? e.lat;
  const lon = e.center?.lon ?? e.lon;
  if (!lat || !lon) return null;
  return { type: "Point", coordinates: [lon, lat] };
}

function inferFeatureType(geom: { type: string }): OsmRow["featureType"] {
  switch (geom.type) {
    case "Point":
      return "point";
    case "Polygon":
      return "polygon";
    default:
      return "line";
  }
}

function classifyOsm(e: any): { category: string; status: string; officiality: string } {
  const t = e.tags || {};

  if (t.highway === "construction") {
    return { category: "Planned / in progress", status: "planned", officiality: "planned" };
  }

  const isBridge =
    t.highway === "footbridge" ||
    (t.bridge === "yes" && ["path", "footway", "cycleway"].includes(t.highway));
  if (isBridge) {
    return { category: "Walking / mixed-use bridges", status: "active", officiality: "official" };
  }

  if (t.highway === "cycleway" || (e.type === "relation" && t.route === "bicycle") || t.highway === "path") {
    return { category: "Trail spines", status: "active", officiality: "official" };
  }

  if (t.highway === "footway" || t.highway === "track") {
    return { category: "Surface / connector notes", status: "active", officiality: "official" };
  }

  return { category: "Surface / connector notes", status: "active", officiality: "official" };
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

export async function syncOsmData(env: Env, types = "trail"): Promise<number> {
  logger.info("Starting OSM data sync", { bbox: BBOX, types }, "SYNC");

  const typeList = types.split(",").map((s) => s.trim());
  const queries: string[] = [];
  if (typeList.includes("trail")) queries.push(TRAIL_QUERIES);
  if (!queries.length) {
    logger.warn("No valid types for OSM sync", { types }, "SYNC");
    return 0;
  }

  const query = `[out:json][timeout:120];(${queries.join("")});out center 500;`;
  const res = await fetch(OVERPASS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": USER_AGENT,
    },
    body: new URLSearchParams({ data: query }),
  });

  if (!res.ok) {
    logger.error("Overpass API failed", { status: res.status }, "SYNC");
    return 0;
  }

  const data = (await res.json()) as { elements?: any[] };
  const elements = data.elements || [];

  const seen = new Set<string>();
  const unique: any[] = [];
  for (const e of elements) {
    if (!e) continue;
    const t = e.tags || {};
    if (t.railway) continue; // Skip rail features
    const lat = e.center?.lat ?? e.lat;
    const lon = e.center?.lon ?? e.lon;
    if (!lat || !lon) continue;
    const key = `${e.type}:${e.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(e);
  }

  if (!unique.length) {
    logger.info("No new OSM features found", undefined, "SYNC");
    return 0;
  }

  const rows: OsmRow[] = [];
  for (const e of unique) {
    const t = e.tags || {};
    const geomObj = buildOsmGeom(e);
    if (!geomObj) continue;
    const { category, status, officiality } = classifyOsm(e);
    const name = t.name || t.ref || t.operator || `Unnamed ${t.highway || "feature"}`;

    const descParts: string[] = [];
    if (t.surface) descParts.push(`Surface: ${t.surface}.`);
    if (t.tracktype) descParts.push(`Track type: ${t.tracktype}.`);
    if (t.bridge === "yes") descParts.push("Bridge.");
    if (t.description) descParts.push(t.description);
    const publicDescription = descParts.join(" ").slice(0, 512);

    const id = `osm:${e.type}:${e.id}`;
    rows.push({
      id,
      slug: `${slugify(name).slice(0, 40) || "osm"}-${crypto.randomUUID().slice(0, 8)}`,
      name,
      featureType: inferFeatureType(geomObj),
      category,
      status,
      officiality,
      publicDescription,
      surfaceNote: t.surface || t.tracktype || "",
      geom: JSON.stringify(geomObj),
      sourceUrl: `https://www.openstreetmap.org/${e.type}/${e.id}`,
      sourceNote: "OpenStreetMap via Overpass API",
    });
  }

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
      batch.push(sourceStmt.bind(`${row.id}:source`, row.id, row.sourceUrl, row.sourceNote));
    }
    await env.DB.batch(batch);
    for (const row of chunk) {
      await upsertGeometry(env, row.id, row.geom);
    }
  }

  logger.info(
    "OSM sync complete",
    { found: elements.length, deduplicated: unique.length, inserted: rows.length },
    "SYNC"
  );
  return rows.length;
}

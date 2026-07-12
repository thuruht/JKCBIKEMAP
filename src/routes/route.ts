/**
 * POST /api/route
 *
 * Valhalla-compatible route endpoint. Fallback chain:
 *   1. FOSSGIS public Valhalla
 *   2. BRouter
 * Results cached in KV (ROUTE_CACHE) for 24h.
 *
 * Adapted from bikeroutes.org — Valhalla container path removed because
 * the container image is not present in this repo.
 */

import { Hono } from "hono";
import { logger } from "../lib/logger.js";
import type { Env } from "../types.js";

export const routeRoutes = new Hono<{ Bindings: Env }>();

const BROUTER_URL = "https://brouter.de/brouter";
const UA = "JKC Bike Map/1.0 (admin@jojomap.kcmo.xyz)";

async function sha256(data: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(data)
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function validateCoordinates(locations: any[]): boolean {
  if (!locations || locations.length < 2) return false;
  return locations.every(
    (loc) =>
      typeof loc.lat === "number" &&
      typeof loc.lon === "number" &&
      (loc.lat !== 0 || loc.lon !== 0)
  );
}

function mapToBRouterProfile(body: any): string {
  const opts = body?.costing_options?.bicycle;
  if (!opts) return "trekking";
  const roads = opts.use_roads ?? 0.5;
  const hills = opts.use_hills ?? 0.5;
  if (roads < 0.3 && hills > 0.3) return "safety";
  if (roads > 0.6) return "fastbike";
  return "trekking";
}

function brouterToValhalla(gj: any, locations: any[]): any {
  const f = gj.features?.[0];
  if (!f) throw new Error("BRouter returned no features");
  const coords = f.geometry.coordinates;
  if (!coords?.length) throw new Error("BRouter returned empty geometry");
  const p = f.properties || {};
  const distKm = (parseFloat(p["track-length"]) || 0) / 1000;
  const timeS = parseFloat(p["total-time"]) || (distKm * 3600) / 16;
  const lastIdx = coords.length - 1;

  return {
    trip: {
      legs: [
        {
          shape: coords,
          summary: { length: distKm, time: timeS },
          maneuvers: [
            {
              type: 1,
              begin_shape_index: 0,
              street_names: [locations[0]?.label || "Start"],
              length: 0,
              time: 0,
              instruction: "Start riding",
            },
            {
              type: 4,
              begin_shape_index: lastIdx,
              street_names: [
                locations[locations.length - 1]?.label || "Destination",
              ],
              length: 0,
              time: 0,
              instruction: "Arrive at destination",
            },
          ],
        },
      ],
      summary: { has_high_scenery: false },
    },
  };
}

routeRoutes.post("/", async (c) => {
  const body = await c.req.text();

  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch {
    return c.json({ error: "Invalid JSON payload" }, 400);
  }

  if (!validateCoordinates(parsed.locations)) {
    return c.json(
      {
        error: "Invalid coordinates",
        message: "Locations must contain valid lat/lon (0,0 is not permitted).",
      },
      400
    );
  }

  const cacheKey = `route:${await sha256(body)}`;

  // 1. KV cache
  const cached = await c.env.ROUTE_CACHE.get(cacheKey, "json");
  if (cached) {
    return c.json(cached, 200, {
      "X-Cache": "HIT",
      "X-Route-Source": "cache",
    });
  }

  let routeData;
  let source: string;

  // 2. FOSSGIS Valhalla fallback
  try {
    const fossgisResp = await fetch("https://valhalla1.openstreetmap.de/route", {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": UA },
      body: JSON.stringify({
        ...parsed,
        shape_format: "geojson",
        directions_options: { units: "kilometers", language: "en-US" },
      }),
    });

    if (!fossgisResp.ok) {
      const errBody = await fossgisResp.text();
      throw new Error(`FOSSGIS ${fossgisResp.status}: ${errBody.slice(0, 500)}`);
    }
    routeData = await fossgisResp.json();
    source = "fossgis";
  } catch (fossgisError) {
    logger.warn("FOSSGIS routing failed, trying BRouter", fossgisError, "ROUTING");

    // 3. BRouter tertiary fallback
    try {
      const profile = mapToBRouterProfile(parsed);
      const lonlats = parsed.locations
        .map((loc: any) => `${loc.lon.toFixed(6)},${loc.lat.toFixed(6)}`)
        .join("|");
      const url = `${BROUTER_URL}?lonlats=${lonlats}&profile=${profile}&alternativeidx=0&format=geojson`;

      const brouterResp = await fetch(url, { headers: { "User-Agent": UA } });
      if (!brouterResp.ok) {
        const errBody = await brouterResp.text();
        throw new Error(`BRouter ${brouterResp.status}: ${errBody.slice(0, 500)}`);
      }
      const gj = await brouterResp.json();
      routeData = brouterToValhalla(gj, parsed.locations);
      source = "brouter";
    } catch (brouterError) {
      logger.error("All routing engines failed", brouterError, "ROUTING");
      return c.json(
        {
          error: "Routing failed",
          message: "All routing engines are unavailable. Try again shortly.",
        },
        503
      );
    }
  }

  // 4. Cache & return
  c.executionCtx.waitUntil(
    c.env.ROUTE_CACHE.put(cacheKey, JSON.stringify(routeData), {
      expirationTtl: 86400,
    })
  );

  return c.json(routeData, 200, {
    "X-Cache": "MISS",
    "X-Route-Source": source,
  });
});

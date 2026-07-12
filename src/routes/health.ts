/**
 * GET /api/health
 *
 * Quick health check for the bindings this Worker actually uses.
 */

import { Hono } from "hono";
import type { Env } from "../types.js";

export const healthRoutes = new Hono<{ Bindings: Env }>();

healthRoutes.get("/", async (c) => {
  const checks: Record<string, string> = {};

  try {
    await c.env.DB.prepare("SELECT 1").first();
    checks.d1 = "ok";
  } catch {
    checks.d1 = "error";
  }

  try {
    await c.env.KV.get("__health");
    checks.kv = "ok";
  } catch {
    checks.kv = "error";
  }

  try {
    await c.env.ROUTE_CACHE.get("__health");
    checks.route_cache = "ok";
  } catch {
    checks.route_cache = "error";
  }

  try {
    await c.env.AVATARS_BUCKET.head("__health");
    checks.r2_avatars = "ok";
  } catch {
    // head on missing key is fine
    checks.r2_avatars = "ok";
  }

  const allOk = Object.values(checks).every((v) => v !== "error");

  return c.json(
    {
      status: allOk ? "healthy" : "degraded",
      checks,
      version: "1.1.0",
      timestamp: new Date().toISOString(),
    },
    allOk ? 200 : 503
  );
});

import { D1Database, Fetcher } from "@cloudflare/workers-types";

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  ADMIN_TOKEN?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // API Routes
    if (url.pathname.startsWith("/api/")) {
      return handleApiRequest(request, env, url);
    }

    // Temporary Import Route (Protected by ADMIN_TOKEN)
    if (url.pathname === "/admin/import-marc") {
      const authHeader = request.headers.get("Authorization");
      if (env.ADMIN_TOKEN && authHeader !== `Bearer ${env.ADMIN_TOKEN}`) {
        return new Response("Unauthorized", { status: 401 });
      }
      return handleMarcImport(env);
    }

    // Serve static assets from the public/ directory
    return env.ASSETS.fetch(request);
  },
};

async function handleMarcImport(env: Env): Promise<Response> {
  const MARC_URL = 'https://marc2.org/arcgis/rest/services/MetroGreen/FeatureServer/0/query?where=PhaseSimple=%27Existing%27&outFields=*&f=geojson';
  
  try {
    const resp = await fetch(MARC_URL);
    if (!resp.ok) return new Response("Failed to fetch MARC data", { status: 500 });
    
    const data = await resp.json() as any;
    let count = 0;

    for (const feature of data.features) {
      const props = feature.properties;
      const geom = feature.geometry;
      
      const name = props.Name || 'Unnamed Trail Segment';
      const slug = 'marc-' + crypto.randomUUID();
      const category = 'Official Regional Data';
      const description = `Source: MARC Regional Trails. Jurisdiction: ${props.Jurisdiction || 'Unknown'}. Type: ${props.FacilityType || 'Unknown'}.`;

      const id = crypto.randomUUID();
      await env.DB.prepare(`
        INSERT INTO features (id, slug, name, feature_type, category, status, visibility, officiality, public_description, surface_note)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(id, slug, name, 'line', category, 'active', 'public', 'official', description, props.SurfaceType || 'Unknown').run();

      await env.DB.prepare(`
        INSERT INTO feature_geometries (feature_id, public_geometry)
        VALUES (?, ?)
      `).bind(id, JSON.stringify(geom)).run();
      
      count++;
      if (count > 300) break; // Increased limit
    }

    return new Response(`Imported ${count} features`, { status: 200 });
  } catch (err: any) {
    return new Response(`Error: ${err.message}`, { status: 500 });
  }
}

async function handleApiRequest(request: Request, env: Env, url: URL): Promise<Response> {
  const method = request.method;
  const path = url.pathname.replace("/api/", "");

  const authHeader = request.headers.get("Authorization");
  const isAdmin = env.ADMIN_TOKEN && authHeader === `Bearer ${env.ADMIN_TOKEN}`;

  // Basic Auth for mutations
  if (method !== "GET" && !isAdmin) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  try {
    if (method === "GET" && path === "features") {
      const { results } = await env.DB.prepare(`
        SELECT f.*, g.public_geometry, g.admin_geometry
        FROM features f
        LEFT JOIN feature_geometries g ON f.id = g.feature_id
        WHERE f.visibility != 'private' OR ? = 1
      `).bind(isAdmin ? 1 : 0).all();
      
      const features = results.map(f => {
        const isSensitive = f.visibility === 'sensitive';
        // Use admin geometry if admin and available, otherwise public
        let geometry = f.public_geometry;
        if (isAdmin && f.admin_geometry) {
          geometry = f.admin_geometry;
        }

        return {
          ...f,
          // Remove admin_geometry from public output
          admin_geometry: isAdmin ? f.admin_geometry : undefined,
          geometry: geometry ? JSON.parse(geometry as string) : null,
          // Hide admin note from public
          admin_note: isAdmin ? f.admin_note : undefined
        };
      });
      
      return jsonResponse(features);
    }

    if (method === "POST" && path === "features") {
      const body = await request.json() as any;
      const id = crypto.randomUUID();
      const slug = body.slug || body.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const deleteToken = body.poster_email ? crypto.randomUUID() : null;

      await env.DB.prepare(`
        INSERT INTO features (
          id, slug, name, feature_type, category, status, visibility, officiality, 
          public_description, admin_note, surface_note, risk_note, weather_sensitivity, source_confidence,
          longevity, poster_email, delete_token
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        id, slug, body.name, body.feature_type, body.category, body.status, 
        body.visibility || 'public', body.officiality || 'official',
        body.public_description, body.admin_note, body.surface_note, 
        body.risk_note, body.weather_sensitivity, body.source_confidence,
        body.longevity || 'permanent', body.poster_email, deleteToken
      ).run();

      if (body.geometry) {
        const geomField = body.visibility === 'sensitive' ? 'admin_geometry' : 'public_geometry';
        await env.DB.prepare(
          `INSERT INTO feature_geometries (feature_id, ${geomField}) VALUES (?, ?)`
        ).bind(id, JSON.stringify(body.geometry)).run();
        
        // If sensitive, also provide a placeholder public geometry if not provided
        if (body.visibility === 'sensitive' && body.public_geometry) {
          await env.DB.prepare(
            "UPDATE feature_geometries SET public_geometry = ? WHERE feature_id = ?"
          ).bind(JSON.stringify(body.public_geometry), id).run();
        }
      }

      // Create initial revision
      const revisionId = crypto.randomUUID();
      await env.DB.prepare(`
        INSERT INTO feature_revisions (id, feature_id, actor, new_state)
        VALUES (?, ?, ?, ?)
      `).bind(revisionId, id, "admin", JSON.stringify(body)).run();

      return jsonResponse({ id, delete_token: deleteToken, success: true });
    }

    if (method === "PUT" && path.startsWith("features/")) {
      const id = path.replace("features/", "");
      const body = await request.json() as any;

      const current = await env.DB.prepare("SELECT * FROM features WHERE id = ?").bind(id).first();
      if (!current) return jsonResponse({ error: "Feature not found" }, 404);

      await env.DB.prepare(`
        UPDATE features SET 
          name = ?, feature_type = ?, category = ?, status = ?, visibility = ?, officiality = ?, 
          public_description = ?, admin_note = ?, surface_note = ?, risk_note = ?, 
          weather_sensitivity = ?, source_confidence = ?, longevity = ?, poster_email = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(
        body.name, body.feature_type, body.category, body.status, 
        body.visibility || 'public', body.officiality || 'official',
        body.public_description, body.admin_note, body.surface_note, 
        body.risk_note, body.weather_sensitivity, body.source_confidence,
        body.longevity || 'permanent', body.poster_email, id
      ).run();

      if (body.geometry) {
        const isSensitive = body.visibility === 'sensitive';
        if (isSensitive) {
          await env.DB.prepare(
            "UPDATE feature_geometries SET admin_geometry = ?, public_geometry = ? WHERE feature_id = ?"
          ).bind(JSON.stringify(body.geometry), JSON.stringify(body.public_geometry || null), id).run();
        } else {
          await env.DB.prepare(
            "UPDATE feature_geometries SET public_geometry = ?, admin_geometry = NULL WHERE feature_id = ?"
          ).bind(JSON.stringify(body.geometry), id).run();
        }
      }

      const revisionId = crypto.randomUUID();
      await env.DB.prepare(`
        INSERT INTO feature_revisions (id, feature_id, actor, previous_state, new_state)
        VALUES (?, ?, ?, ?, ?)
      `).bind(revisionId, id, "admin", JSON.stringify(current), JSON.stringify(body)).run();

      return jsonResponse({ success: true });
    }

    if (method === "DELETE" && path.startsWith("features/")) {
      const id = path.replace("features/", "");
      const token = url.searchParams.get("token");

      if (isAdmin) {
        await env.DB.prepare("DELETE FROM features WHERE id = ?").bind(id).run();
        return jsonResponse({ success: true });
      }

      if (token) {
        const feature = await env.DB.prepare("SELECT delete_token FROM features WHERE id = ?").bind(id).first();
        if (feature && feature.delete_token === token) {
          await env.DB.prepare("DELETE FROM features WHERE id = ?").bind(id).run();
          return jsonResponse({ success: true });
        }
      }

      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    if (method === "GET" && path.includes("/revisions")) {
      const featureId = path.split("/")[1];
      const { results } = await env.DB.prepare(`
        SELECT * FROM feature_revisions WHERE feature_id = ? ORDER BY created_at DESC
      `).bind(featureId).all();
      return jsonResponse(results);
    }

    if (method === "GET" && path === "search") {
      const q = url.searchParams.get("q") || "";
      const { results } = await env.DB.prepare(`
        SELECT * FROM features 
        WHERE (name LIKE ? OR category LIKE ? OR status LIKE ? OR public_description LIKE ?)
        AND (visibility != 'private' OR ? = 1)
      `).bind(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, isAdmin ? 1 : 0).all();
      return jsonResponse(results);
    }

    if (method === "GET" && path === "reports") {
      const { results } = await env.DB.prepare("SELECT * FROM reports").all();
      return jsonResponse(results);
    }

    if (method === "POST" && path === "reports") {
      const body = await request.json() as any;
      const id = crypto.randomUUID();
      const deleteToken = body.poster_email ? crypto.randomUUID() : null;

      await env.DB.prepare(
        "INSERT INTO reports (id, feature_id, report_type, description, longevity, poster_email, delete_token) VALUES (?, ?, ?, ?, ?, ?, ?)"
      ).bind(id, body.feature_id, body.report_type, body.description, body.longevity || 'temporary', body.poster_email, deleteToken).run();
      
      return jsonResponse({ id, delete_token: deleteToken, success: true });
    }

    return new Response("API Route Not Found", { status: 404 });
  } catch (error: any) {
    return jsonResponse({ error: error.message }, 500);
  }
}

function jsonResponse(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    },
  });
}

import { D1Database, Fetcher } from "@cloudflare/workers-types";

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  KV: KVNamespace; // Cloudflare KV for user preferences
  SEND_EMAIL: any; // Cloudflare Email Sending Beta
  ADMIN_TOKEN?: string;
  APP_URL?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Auth Routes
    if (url.pathname.startsWith("/auth/")) {
      return handleAuthRequest(request, env, url);
    }

    // API Routes
    if (url.pathname.startsWith("/api/")) {
      return handleApiRequest(request, env, url);
    }

    // Admin Routes
    if (url.pathname === "/admin/import-marc") {
      const authHeader = request.headers.get("Authorization");
      if (env.ADMIN_TOKEN && authHeader !== `Bearer ${env.ADMIN_TOKEN}`) {
        return new Response("Unauthorized", { status: 401 });
      }
      return handleMarcImport(env);
    }

    // Serve static assets with CSP
    const response = await env.ASSETS.fetch(request);
    const newHeaders = new Headers(response.headers);
    // Relaxed CSP to allow internal scripts, Leaflet, GSAP, and Cloudflare Analytics
    const csp = "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdnjs.cloudflare.com https://unpkg.com https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https://*.tile.openstreetmap.org https://*.basemaps.cartocdn.com https://unpkg.com https://tiles.stadiamaps.com https://*.tile.opentopomap.org https://*.vis.earthdata.nasa.gov https://*.arcgisonline.com https://*.tile-cyclosm.openstreetmap.fr https://mt1.google.com https://*.tile.thunderforest.com https://*.tile.openstreetmap.fr https://tile.osm.ch https://tile.memomaps.de https://*.tiles.openrailwaymap.org https://tile.waymarkedtrails.org; connect-src 'self' https://overpass-api.de https://overpass.osm.ch https://nominatim.openstreetmap.org https://cloudflareinsights.com https://*.cloudflareinsights.com;";
    newHeaders.set("Content-Security-Policy", csp);
    
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders
    });
  },
};

async function handleAuthRequest(request: Request, env: Env, url: URL): Promise<Response> {
  const method = request.method;
  const path = url.pathname.replace("/auth/", "");

  if (method === "POST" && path === "login") {
    const { email } = await request.json() as { email: string };
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 mins
    
    await env.DB.prepare("INSERT INTO auth_tokens (token, email, expires_at) VALUES (?, ?, ?)")
      .bind(token, email, expiresAt).run();

    const loginUrl = `${env.APP_URL || url.origin}/auth/verify?token=${token}`;
    
    if (true) { // Use MailChannels for better reliability on Workers
      try {
        const resp = await fetch("https://api.mailchannels.net/tx/v1/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            personalizations: [{ to: [{ email }] }],
            from: { email: "no-reply@jojomap.kcmo.xyz", name: "Jojo's KC Bike Map" },
            subject: "Your Magic Login Link",
            content: [
              { type: "text/plain", value: `Click here to login: ${loginUrl}` },
              { type: "text/html", value: `<p>Click here to login: <a href="${loginUrl}">${loginUrl}</a></p>` }
            ]
          })
        });
        
        if (resp.ok) {
          console.log(`Magic Link sent to ${email} via MailChannels`);
        } else {
          const errorText = await resp.text();
          throw new Error(`MailChannels failed: ${errorText}`);
        }
      } catch (err: any) {
        console.error("Email Sending failed:", err.message);
        // Fallback log for dev visibility
        console.log(`EMERGENCY ACCESS LINK: ${loginUrl}`);
      }
    } else {
      console.log(`MAGIC LINK (No Email Binding): ${loginUrl}`);
    }

    return jsonResponse({ success: true });
  }

  if (method === "GET" && path === "verify") {
    const token = url.searchParams.get("token");
    if (!token) return new Response("Missing token", { status: 400 });

    const auth = await env.DB.prepare("SELECT * FROM auth_tokens WHERE token = ? AND expires_at > CURRENT_TIMESTAMP")
      .bind(token).first() as { email: string } | null;

    if (!auth) return new Response("Invalid or expired token", { status: 401 });

    let user = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(auth.email).first() as { id: string } | null;
    if (!user) {
      const userId = crypto.randomUUID();
      await env.DB.prepare("INSERT INTO users (id, email, verified_at) VALUES (?, ?, CURRENT_TIMESTAMP)")
        .bind(userId, auth.email).run();
      user = { id: userId };
    }

    const sessionToken = crypto.randomUUID();
    const sessionExpires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    await env.DB.prepare("INSERT INTO sessions (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)")
      .bind(crypto.randomUUID(), user.id, sessionToken, sessionExpires).run();

    await env.DB.prepare("DELETE FROM auth_tokens WHERE token = ?").bind(token).run();

    return new Response(null, {
      status: 302,
      headers: {
        "Location": "/",
        "Set-Cookie": `session=${sessionToken}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${30 * 24 * 60 * 60}`
      }
    });
  }

  return new Response("Not Found", { status: 404 });
}

async function handleMarcImport(env: Env): Promise<Response> {
  const MARC_URL = 'https://maps.marc.org/arcgis/rest/services/Recreation/BikewaysAndTrails/MapServer/10/query?where=1%3D1&outFields=*&f=geojson';

  try {
    console.log("Fetching MARC data from:", MARC_URL);
    const resp = await fetch(MARC_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Cloudflare Worker)' }
    });
    
    if (!resp.ok) {
      const errText = await resp.text();
      return new Response(`MARC API Error ${resp.status}: ${errText.slice(0, 100)}`, { status: 500 });
    }
    
    const data = await resp.json() as any;

    if (!data.features || !Array.isArray(data.features)) {
      return new Response("MARC Data missing features array", { status: 500 });
    }

    const limit = 200; // Total features to import
    const batchSize = 50; // Features per D1 transaction
    const featuresToProcess = data.features.slice(0, limit);
    let importedCount = 0;

    for (let i = 0; i < featuresToProcess.length; i += batchSize) {
      const chunk = featuresToProcess.slice(i, i + batchSize);
      const statements: any[] = [];

      for (const feature of chunk) {
        const props = feature.properties || {};
        const geom = feature.geometry;
        if (!geom) continue;

        const name = props.RouteName || props.Name || props.TrailName || 'Unnamed MARC Trail';
        const jurisdiction = props.Jurisdiction || props.City || 'Regional';
        const facility = props.FacilityType || props.Type || 'Trail';
        const surface = props.SurfaceType || props.Surface || 'Unknown';
        
        const slug = 'marc-' + crypto.randomUUID();
        const id = crypto.randomUUID();

        statements.push(env.DB.prepare(`
          INSERT OR IGNORE INTO features (id, slug, name, feature_type, category, status, visibility, officiality, public_description, surface_note)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(id, slug, name, 'line', 'Official Regional Data', 'active', 'public', 'official',
          `Jurisdiction: ${jurisdiction}. Type: ${facility}.`,
          surface));

        statements.push(env.DB.prepare("INSERT OR IGNORE INTO feature_geometries (feature_id, public_geometry) VALUES (?, ?)")
          .bind(id, JSON.stringify(geom)));
      }

      if (statements.length > 0) {
        try {
          await env.DB.batch(statements);
          importedCount += chunk.length;
        } catch (batchErr: any) {
          console.error("Batch Import Error:", batchErr.message);
          throw new Error(`D1 Batch failed: ${batchErr.message}`);
        }
      }
    }

    return new Response(`Successfully imported ${importedCount} MARC features in chunks.`, { status: 200 });
  } catch (err: any) {
    console.error("Critical Import Error:", err.message);
    return new Response(`Critical Error: ${err.message}\n${err.stack}`, { status: 500 });
  }
}

async function handleApiRequest(request: Request, env: Env, url: URL): Promise<Response> {
  try {
    const method = request.method;
    const path = url.pathname.replace("/api/", "");

    const cookieHeader = request.headers.get("Cookie") || "";
    const sessionToken = cookieHeader.split(";").find(c => c.trim().startsWith("session="))?.split("=")[1];
    const authHeader = request.headers.get("Authorization") || "";
    
    let user: any = null;
    let isAdmin = false;

    // 1. Check for Session Cookie
    if (sessionToken) {
      const session = await env.DB.prepare(`
        SELECT s.*, u.email, u.role, u.reputation_score
        FROM sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.token = ? AND s.expires_at > CURRENT_TIMESTAMP
      `).bind(sessionToken).first();
      
      if (session) {
        user = session;
        isAdmin = session.role === 'admin';
      }
    }

    // 2. Check for ADMIN_TOKEN master key
    if (!isAdmin && env.ADMIN_TOKEN && authHeader.trim() === `Bearer ${env.ADMIN_TOKEN}`) {
      isAdmin = true;
    }

    if (method === "GET" && path === "me") {
      if (!user) return jsonResponse({ authenticated: false });
      
      const badges = await env.DB.prepare(`
        SELECT b.* FROM badges b
        JOIN user_badges ub ON b.id = ub.badge_id
        WHERE ub.user_id = ?
      `).bind(user.user_id).all();

      const prefsRaw = await env.KV.get(`prefs:${user.user_id}`);
      const preferences = prefsRaw ? JSON.parse(prefsRaw) : {};

      return jsonResponse({
        authenticated: true,
        user: {
          email: user.email,
          role: user.role,
          reputation_score: user.reputation_score
        },
        badges: badges.results,
        preferences
      });
    }

    if (method === "POST" && path === "me/preferences") {
      if (!user) return new Response("Unauthorized", { status: 401 });
      const body = await request.json();
      await env.KV.put(`prefs:${user.user_id}`, JSON.stringify(body));
      return jsonResponse({ success: true });
    }

    if (method === "GET" && path === "amenities") {
      const bbox = url.searchParams.get("bbox");
      if (!bbox) return new Response("Missing bbox", { status: 400 });
      
      const query = `[out:json][timeout:25];(node["amenity"~"drinking_water|bicycle_repair_station"](${bbox});node["shop"="bicycle"](${bbox}););out;`;
      
      let resp = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`, {
        headers: { 'User-Agent': 'JojoKCMap/1.0 (Cloudflare Worker; contact: admin@jojomap.kcmo.xyz)' }
      });

      if (!resp.ok) {
        console.warn(`Primary Overpass failed (${resp.status}), trying fallback...`);
        resp = await fetch(`https://overpass.osm.ch/api/interpreter?data=${encodeURIComponent(query)}`, {
          headers: { 'User-Agent': 'JojoKCMap/1.0 (Cloudflare Worker)' }
        });
      }
      
      if (!resp.ok) {
        const text = await resp.text();
        return new Response(`Amenities Error: ${text.slice(0, 100)}`, { status: resp.status });
      }
      
      return jsonResponse(await resp.json());
    }

    if (method === "GET" && path === "features") {
      const isHighRep = isAdmin || (user && (user.reputation_score >= 50 || user.role === 'contributor'));

      const { results } = await env.DB.prepare(`
        SELECT f.*, g.public_geometry, g.admin_geometry
        FROM features f
        LEFT JOIN feature_geometries g ON f.id = g.feature_id
        WHERE f.visibility != 'private' OR ? = 1
      `).bind(isAdmin ? 1 : 0).all();
      
      return jsonResponse(results.map(f => {
        const isSensitive = f.visibility === 'sensitive';
        const hasFullAccess = isAdmin || isHighRep;
        
        let geometry = f.public_geometry;
        if (hasFullAccess && f.admin_geometry) {
          geometry = f.admin_geometry;
        }

        let parsedGeom = null;
        try {
          parsedGeom = geometry ? JSON.parse(geometry as string) : null;
        } catch (pe) {
          console.error(`Geom parse failed for ${f.id}:`, pe);
        }

        return {
          ...f,
          admin_geometry: isAdmin ? f.admin_geometry : undefined,
          geometry: parsedGeom,
          public_description: (isSensitive && !hasFullAccess) ? "Detailed knowledge restricted to established contributors." : f.public_description,
          admin_note: isAdmin ? f.admin_note : undefined,
          surface_note: (isSensitive && !hasFullAccess) ? null : f.surface_note
        };
      }));
    }

    if (method === "POST" && path === "features") {
      const body = await request.json() as any;
      if (!body.name) return new Response("Name is required", { status: 400 });
      
      const id = crypto.randomUUID();
      const slug = body.slug || body.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + Math.random().toString(36).slice(2, 5);
      const deleteToken = (user || isAdmin) ? null : (body.poster_email ? crypto.randomUUID() : null);

      await env.DB.prepare(`
        INSERT INTO features (id, slug, name, feature_type, category, status, visibility, officiality, public_description, surface_note, risk_note, weather_sensitivity, source_confidence, longevity, poster_email, delete_token, owner_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(id, slug, body.name || 'Unnamed', body.feature_type || 'point', body.category || 'Local Knowledge', body.status || 'active', 
        body.visibility || 'public', body.officiality || 'unofficial', body.public_description || null, body.surface_note || null,
        body.risk_note || null, body.weather_sensitivity || 'none', body.source_confidence || 'medium', body.longevity || 'permanent', 
        body.poster_email || null, deleteToken, user?.user_id || null).run();

      await env.DB.prepare("INSERT INTO feature_geometries (feature_id, public_geometry) VALUES (?, ?)")
        .bind(id, JSON.stringify(body.geometry || null)).run();

      if (body.sources) {
        for (const s of body.sources) {
          await env.DB.prepare("INSERT INTO feature_sources (id, feature_id, source_url, source_note) VALUES (?, ?, ?, ?)")
            .bind(crypto.randomUUID(), id, s.url || null, s.note || null).run();
        }
      }

      return jsonResponse({ success: true, id, delete_token: deleteToken });
    }

    if (method === "PUT" && path.startsWith("features/")) {
      const id = path.split("/")[1];
      const body = await request.json() as any;
      
      const feature = await env.DB.prepare("SELECT owner_id FROM features WHERE id = ?").bind(id).first() as { owner_id: string } | null;
      if (!isAdmin && feature?.owner_id !== user?.user_id) {
        return new Response("Unauthorized", { status: 401 });
      }

      await env.DB.prepare(`
        UPDATE features SET 
          name = ?, category = ?, status = ?, visibility = ?, officiality = ?, 
          public_description = ?, surface_note = ?, risk_note = ?, weather_sensitivity = ?, 
          source_confidence = ?, longevity = ?, poster_email = ?
        WHERE id = ?
      `).bind(body.name || 'Unnamed', body.category || 'Local Knowledge', body.status || 'active', body.visibility || 'public', body.officiality || 'unofficial', 
        body.public_description || null, body.surface_note || null, body.risk_note || null, body.weather_sensitivity || 'none', 
        body.source_confidence || 'medium', body.longevity || 'permanent', body.poster_email || null, id).run();

      if (body.geometry) {
        await env.DB.prepare("UPDATE feature_geometries SET public_geometry = ? WHERE feature_id = ?")
          .bind(JSON.stringify(body.geometry), id).run();
      }

      if (body.sources) {
        await env.DB.prepare("DELETE FROM feature_sources WHERE feature_id = ?").bind(id).run();
        for (const s of body.sources) {
          await env.DB.prepare("INSERT INTO feature_sources (id, feature_id, source_url, source_note) VALUES (?, ?, ?, ?)")
            .bind(crypto.randomUUID(), id, s.url || null, s.note || null).run();
        }
      }

      return jsonResponse({ success: true });
    }

    if (method === "GET" && path.endsWith("/details")) {
      const id = path.split("/")[1];
      const sources = await env.DB.prepare("SELECT * FROM feature_sources WHERE feature_id = ?").bind(id).all();
      const reports = await env.DB.prepare("SELECT * FROM reports WHERE feature_id = ? ORDER BY created_at DESC").bind(id).all();
      const comments = await env.DB.prepare("SELECT * FROM comments WHERE feature_id = ? ORDER BY created_at DESC").bind(id).all();
      return jsonResponse({ sources: sources.results || [], reports: reports.results || [], comments: comments.results || [] });
    }

    return new Response("Not Found", { status: 404 });
  } catch (err: any) {
    console.error("API Request Error:", err.message, err.stack);
    return new Response(`Server Error: ${err.message}\n${err.stack}`, { status: 500 });
  }
}

function jsonResponse(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 
      "Content-Type": "application/json", 
      "Access-Control-Allow-Origin": "*",
    },
  });
}
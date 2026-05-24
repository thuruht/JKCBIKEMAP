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
    newHeaders.set("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://unpkg.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https://*.tile.openstreetmap.org https://*.basemaps.cartocdn.com https://unpkg.com https://tiles.stadiamaps.com https://*.tile.opentopomap.org https://*.vis.earthdata.nasa.gov https://*.arcgisonline.com https://*.tile-cyclosm.openstreetmap.fr https://mt1.google.com https://*.tile.thunderforest.com https://*.tile.openstreetmap.fr https://tile.osm.ch https://tile.memomaps.de https://*.tiles.openrailwaymap.org https://tile.waymarkedtrails.org; connect-src 'self' https://overpass-api.de;");
    
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
    if (!email) return jsonResponse({ error: "Email required" }, 400);

    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    await env.DB.prepare("INSERT INTO auth_tokens (token, email, expires_at) VALUES (?, ?, ?)")
      .bind(token, email, expiresAt).run();

    const loginUrl = `${env.APP_URL || url.origin}/auth/verify?token=${token}`;

    if (env.SEND_EMAIL) {
      try {
        await env.SEND_EMAIL.send({
          to: [{ email }],
          from: { email: "no-reply@jojomap.kcmo.xyz", name: "Jojo's KC Bike Map" },
          subject: "Your Magic Login Link",
          content: [
            { type: "text/plain", value: `Click here to login: ${loginUrl}` },
            { type: "text/html", value: `<p>Click here to login: <a href="${loginUrl}">${loginUrl}</a></p>` }
          ]
        });
        console.log(`Magic Link sent to ${email} via Native API`);
      } catch (err: any) {
        console.error("Native Email Sending failed critically:", err.message);
        // Fallback log for dev visibility if email is blocked
        console.log(`EMERGENCY ACCESS LINK: ${loginUrl}`);
      }
    } else {
      console.log(`MAGIC LINK (No Email Binding): ${loginUrl}`);
    }

    return jsonResponse({ success: true, message: "Magic link sent" });
  }

  if (method === "GET" && path === "verify") {
    const token = url.searchParams.get("token");
    if (!token) return new Response("Missing token", { status: 400 });

    const auth = await env.DB.prepare("SELECT * FROM auth_tokens WHERE token = ? AND expires_at > CURRENT_TIMESTAMP")
      .bind(token).first() as { email: string } | null;

    if (!auth) return new Response("Invalid or expired token", { status: 401 });

    let user = await env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(auth.email).first() as { id: string } | null;
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
  const MARC_URL = 'https://marc2.org/arcgis/rest/services/MetroGreen/FeatureServer/0/query?where=PhaseSimple=%27Existing%27&outFields=*&f=geojson';
  
  try {
    console.log("Fetching MARC data from:", MARC_URL);
    const resp = await fetch(MARC_URL);
    if (!resp.ok) return new Response(`Failed to fetch MARC data: ${resp.status}`, { status: 500 });
    const data = await resp.json() as any;
    
    if (!data.features) {
      console.error("MARC Data missing features array:", data);
      return new Response("MARC Data missing features", { status: 500 });
    }

    let count = 0;
    for (const feature of data.features) {
      const props = feature.properties;
      const geom = feature.geometry;
      const name = props.Name || 'Unnamed Trail';
      const slug = 'marc-' + crypto.randomUUID();
      const id = crypto.randomUUID();
      
      try {
        await env.DB.prepare(`
          INSERT OR IGNORE INTO features (id, slug, name, feature_type, category, status, visibility, officiality, public_description, surface_note)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(id, slug, name, 'line', 'Official Regional Data', 'active', 'public', 'official', 
          `Jurisdiction: ${props.Jurisdiction || 'Unknown'}. Type: ${props.FacilityType || 'Unknown'}.`, 
          props.SurfaceType || 'Unknown').run();

        await env.DB.prepare("INSERT OR IGNORE INTO feature_geometries (feature_id, public_geometry) VALUES (?, ?)")
          .bind(id, JSON.stringify(geom)).run();
        
        count++;
      } catch (dbErr: any) {
        console.error(`DB Error on feature ${name}:`, dbErr.message);
      }

      if (count >= 300) break;
    }
    return new Response(`Imported ${count} features`, { status: 200 });
  } catch (err: any) {
    console.error("Critical Import Error:", err.message);
    return new Response(`Critical Error: ${err.message}`, { status: 500 });
  }
}

async function handleApiRequest(request: Request, env: Env, url: URL): Promise<Response> {
  const method = request.method;
  const path = url.pathname.replace("/api/", "");

  const cookieHeader = request.headers.get("Cookie") || "";
  const sessionToken = cookieHeader.match(/session=([^;]+)/)?.[1];
  
  let user: { id: string, email: string, role: string } | null = null;
  if (sessionToken) {
    user = await env.DB.prepare(`
      SELECT u.* FROM users u 
      JOIN sessions s ON u.id = s.user_id 
      WHERE s.token = ? AND s.expires_at > CURRENT_TIMESTAMP
    `).bind(sessionToken).first() as any;
  }

  const authHeader = request.headers.get("Authorization");
  const isAdmin = (env.ADMIN_TOKEN && authHeader === `Bearer ${env.ADMIN_TOKEN}`) || (user && user.role === 'admin');

  if (method !== "GET" && !user && !isAdmin) {
    return jsonResponse({ error: "Authentication required" }, 401);
  }

  if (method === "GET" && path === "me") {
    if (!user) return jsonResponse({ authenticated: false }, 401);
    const prefs = await env.KV.get(`prefs:${user.id}`);
    
    // Fetch level and badges
    const userStats = await env.DB.prepare("SELECT reputation_score, contributor_level FROM users WHERE id = ?").bind(user.id).first() as any;
    const { results: badges } = await env.DB.prepare(`
      SELECT b.* FROM badges b 
      JOIN user_badges ub ON b.id = ub.badge_id 
      WHERE ub.user_id = ?
    `).bind(user.id).all();

    return jsonResponse({ 
      authenticated: true, 
      user: { ...user, ...userStats }, 
      badges: badges || [],
      preferences: prefs ? JSON.parse(prefs) : {} 
    });
  }

  if (method === "POST" && path === "me/preferences") {
    if (!user) return jsonResponse({ error: "Authentication required" }, 401);
    const body = await request.json() as any;
    await env.KV.put(`prefs:${user.id}`, JSON.stringify(body));
    return jsonResponse({ success: true });
  }

  if (method === "GET" && path === "amenities") {
    const bbox = url.searchParams.get("bbox");
    if (!bbox) return jsonResponse({ error: "BBOX required" }, 400);
    
    const [s, w, n, e] = bbox.split(",");
    const query = `[out:json][timeout:25];(node["amenity"~"drinking_water|bicycle_repair_station"](${s},${w},${n},${e});node["service:bicycle:repair"="yes"](${s},${w},${n},${e});node["shop"="bicycle"](${s},${w},${n},${e}););out body;`;
    
    const overpassUrl = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;
    const resp = await fetch(overpassUrl, {
      headers: { "User-Agent": "JojoKCBikeMap/1.0" }
    });
    
    if (!resp.ok) {
      const text = await resp.text();
      return new Response(text, { status: resp.status });
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
      
      // Access Control: Discretion logic
      // Guests and Level 1 see generalized data for sensitive features
      const hasFullAccess = isAdmin || isHighRep;
      
      let geometry = f.public_geometry;
      if (hasFullAccess && f.admin_geometry) {
        geometry = f.admin_geometry;
      }

      return {
        ...f,
        admin_geometry: isAdmin ? f.admin_geometry : undefined,
        geometry: geometry ? JSON.parse(geometry as string) : null,
        // Restrict sensitive metadata to high-rep users
        public_description: (isSensitive && !hasFullAccess) ? "Detailed knowledge restricted to established contributors." : f.public_description,
        admin_note: isAdmin ? f.admin_note : undefined,
        surface_note: (isSensitive && !hasFullAccess) ? null : f.surface_note
      };
    }));
  }

  if (method === "POST" && path === "features") {
    const body = await request.json() as any;
    const id = crypto.randomUUID();
    const slug = body.slug || body.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const deleteToken = (user || isAdmin) ? null : (body.poster_email ? crypto.randomUUID() : null);

    await env.DB.prepare(`
      INSERT INTO features (id, slug, name, feature_type, category, status, visibility, officiality, public_description, surface_note, risk_note, weather_sensitivity, source_confidence, longevity, poster_email, delete_token, owner_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, slug, body.name, body.feature_type, body.category, body.status, 
      body.visibility || 'public', body.officiality || 'official', body.public_description, body.surface_note,
      body.risk_note, body.weather_sensitivity, body.source_confidence,
      body.longevity || 'permanent', body.poster_email, deleteToken, user?.id || null).run();

    if (body.geometry) {
      const field = body.visibility === 'sensitive' ? 'admin_geometry' : 'public_geometry';
      await env.DB.prepare(`INSERT INTO feature_geometries (feature_id, ${field}) VALUES (?, ?)`).bind(id, JSON.stringify(body.geometry)).run();
    }

    if (body.sources && Array.isArray(body.sources)) {
      for (const s of body.sources) {
        await env.DB.prepare("INSERT INTO feature_sources (id, feature_id, source_url, source_note) VALUES (?, ?, ?, ?)")
          .bind(crypto.randomUUID(), id, s.url, s.note).run();
      }
    }

    // Reward points and badges
    if (user) {
      await env.DB.prepare("UPDATE users SET reputation_score = reputation_score + 10 WHERE id = ?").bind(user.id).run();
      if (body.category === 'Pedestrian or walking bridges') {
        await env.DB.prepare("INSERT OR IGNORE INTO user_badges (user_id, badge_id) VALUES (?, 'bridge-hunter')").bind(user.id, 'bridge-hunter').run();
      }
    }

    return jsonResponse({ id, delete_token: deleteToken, success: true });
  }

  if (method === "PUT" && path.startsWith("features/")) {
    const id = path.replace("features/", "");
    if (!isAdmin) return jsonResponse({ error: "Unauthorized" }, 403);
    
    const body = await request.json() as any;
    
    // 1. Fetch current state for revision
    const oldState = await env.DB.prepare(`
      SELECT f.*, g.public_geometry, g.admin_geometry 
      FROM features f LEFT JOIN feature_geometries g ON f.id = g.feature_id 
      WHERE f.id = ?
    `).bind(id).first() as any;

    if (!oldState) return jsonResponse({ error: "Feature not found" }, 404);

    // 2. Save revision
    await env.DB.prepare(`
      INSERT INTO feature_revisions (id, feature_id, actor, changed_fields, previous_state, new_state) 
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(), 
      id, 
      user?.email || 'admin', 
      '[]',
      JSON.stringify(oldState), 
      JSON.stringify(body)
    ).run();

    // 3. Update feature
    const slug = body.slug || body.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    await env.DB.prepare(`
      UPDATE features SET 
        slug = ?, name = ?, feature_type = ?, category = ?, status = ?, 
        visibility = ?, officiality = ?, public_description = ?, surface_note = ?, 
        risk_note = ?, weather_sensitivity = ?, source_confidence = ?,
        longevity = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(
      slug, body.name, body.feature_type, body.category, body.status,
      body.visibility || 'public', body.officiality || 'official', body.public_description, body.surface_note,
      body.risk_note, body.weather_sensitivity, body.source_confidence,
      body.longevity || 'permanent', id
    ).run();

    // 4. Update geometry
    if (body.geometry) {
      const field = body.visibility === 'sensitive' ? 'admin_geometry' : 'public_geometry';
      const nullField = body.visibility === 'sensitive' ? 'public_geometry' : 'admin_geometry';
      await env.DB.prepare(`
        UPDATE feature_geometries 
        SET ${field} = ?, ${nullField} = NULL 
        WHERE feature_id = ?
      `).bind(JSON.stringify(body.geometry), id).run();
    }

    // 5. Update sources
    if (body.sources && Array.isArray(body.sources)) {
      await env.DB.prepare("DELETE FROM feature_sources WHERE feature_id = ?").bind(id).run();
      for (const s of body.sources) {
        await env.DB.prepare("INSERT INTO feature_sources (id, feature_id, source_url, source_note) VALUES (?, ?, ?, ?)")
          .bind(crypto.randomUUID(), id, s.url, s.note).run();
      }
    }

    return jsonResponse({ success: true });
  }

  if (method === "GET" && path.match(/^features\/([^\/]+)\/details$/)) {
    const id = path.split("/")[1];
    const { results: comments } = await env.DB.prepare("SELECT * FROM comments WHERE feature_id = ? ORDER BY created_at DESC").bind(id).all();
    const { results: reports } = await env.DB.prepare("SELECT * FROM reports WHERE feature_id = ? ORDER BY created_at DESC").bind(id).all();
    const { results: sources } = await env.DB.prepare("SELECT * FROM feature_sources WHERE feature_id = ?").bind(id).all();
    return jsonResponse({ comments: comments || [], reports: reports || [], sources: sources || [] });
  }

  if (method === "POST" && path.match(/^features\/([^\/]+)\/comments$/)) {
    if (!user) return jsonResponse({ error: "Authentication required" }, 401);
    const id = path.split("/")[1];
    const body = await request.json() as { body: string };
    const commentId = crypto.randomUUID();
    
    await env.DB.prepare(
      "INSERT INTO comments (id, feature_id, user_id, author_name, body) VALUES (?, ?, ?, ?, ?)"
    ).bind(commentId, id, user.id, user.email.split('@')[0], body.body).run();

    // Small rep bump for commenting
    await env.DB.prepare("UPDATE users SET reputation_score = reputation_score + 1 WHERE id = ?").bind(user.id).run();

    return jsonResponse({ success: true, id: commentId });
  }

  if (method === "POST" && path === "reports") {
    const body = await request.json() as any;
    const id = crypto.randomUUID();
    const deleteToken = (user || isAdmin) ? null : (body.poster_email ? crypto.randomUUID() : null);

    await env.DB.prepare(
      "INSERT INTO reports (id, feature_id, report_type, description, longevity, poster_email, delete_token, owner_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(id, body.feature_id, body.report_type, body.description, body.longevity || 'temporary', body.poster_email, deleteToken, user?.id || null).run();

    // Reward points and badges
    if (user) {
      await env.DB.prepare("UPDATE users SET reputation_score = reputation_score + 5 WHERE id = ?").bind(user.id).run();
      await env.DB.prepare("INSERT OR IGNORE INTO user_badges (user_id, badge_id) VALUES (?, 'mud-finder')").bind(user.id, 'mud-finder').run();
    }

    return jsonResponse({ id, delete_token: deleteToken, success: true });
  }

  if (method === "POST" && path === "checkpoints") {
    if (!user) return jsonResponse({ error: "Authentication required" }, 401);
    const body = await request.json() as { feature_id: string, type: string };

    const id = crypto.randomUUID();
    await env.DB.prepare("INSERT INTO checkpoints (id, contributor_id, feature_id, check_in_type) VALUES (?, ?, ?, ?)")
      .bind(id, user.id, body.feature_id, body.type || 'passage').run();

    // Update feature verification date
    await env.DB.prepare("UPDATE features SET last_verified_at = CURRENT_TIMESTAMP WHERE id = ?").bind(body.feature_id).run();

    // Reward points
    await env.DB.prepare("UPDATE users SET reputation_score = reputation_score + 2 WHERE id = ?").bind(user.id).run();

    // Check for geography badges
    let badgeUnlocked = null;
    const feature = await env.DB.prepare("SELECT category FROM features WHERE id = ?").bind(body.feature_id).first() as any;

    if (feature && feature.category === 'Pedestrian or walking bridges') {
      const { count } = await env.DB.prepare("SELECT COUNT(*) as count FROM user_badges WHERE user_id = ? AND badge_id = 'river-crosser'").bind(user.id).first() as any;
      if (count === 0) {
        await env.DB.prepare("INSERT INTO user_badges (user_id, badge_id) VALUES (?, 'river-crosser')").bind(user.id, 'river-crosser').run();
        badgeUnlocked = 'River Crosser';
      }
    }

    return jsonResponse({ success: true, badge_unlocked: badgeUnlocked });
  }
  if (method === "DELETE" && path.startsWith("features/")) {
    const id = path.replace("features/", "");
    const token = url.searchParams.get("token");

    if (isAdmin) {
      await env.DB.prepare("DELETE FROM features WHERE id = ?").bind(id).run();
      return jsonResponse({ success: true });
    }

    const feature = await env.DB.prepare("SELECT delete_token, owner_id FROM features WHERE id = ?").bind(id).first() as any;
    if (feature && ((token && feature.delete_token === token) || (user && feature.owner_id === user.id))) {
      await env.DB.prepare("DELETE FROM features WHERE id = ?").bind(id).run();
      return jsonResponse({ success: true });
    }

    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  return new Response("Not Found", { status: 404 });
}

function jsonResponse(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 
      "Content-Type": "application/json", 
      "Access-Control-Allow-Origin": "*",
      "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://unpkg.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https://*.tile.openstreetmap.org https://*.basemaps.cartocdn.com https://unpkg.com https://tiles.stadiamaps.com https://*.tile.opentopomap.org; connect-src 'self' https://overpass-api.de;"
    },
  });
}

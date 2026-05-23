# Jojo's KC Bike Map — Project Spec

Jojo's KC Bike Map is a Kansas City metro web map focused on **real rider intelligence**, not just official bike infrastructure. It should model official trails, parks, sidewalks, pedestrian bridges, planned connectors, condition-sensitive segments, and restrained handling of informal or legally gray-area route knowledge. The application is intended for deployment on Cloudflare Workers at `jojomap.kcmo.xyz`, using Cloudflare static asset hosting plus Worker APIs in one deployment unit.[cite:236][cite:230]

## Product goals

The product should feel like a living rider map of Kansas City rather than a tourism brochure. It should support official trail spines, neighborhood anchors, parks, barrier-crossing links, and a careful layer of informal route intelligence that makes the map uniquely useful in practice.[cite:236]

Primary goals:

- Editable by the owner in-browser.
- Public map UX with strong search, filtering, jump navigation, and layer toggles.
- Support relational data, source tracking, and versioned history.
- Preserve sensitive route knowledge without loudly publicizing vulnerable shortcuts.
- Be architected for future social features such as reports, comments, saved routes, and moderation.[cite:224][cite:226]

## Cloudflare architecture

Cloudflare Workers can serve static assets and Worker logic as a single deployable unit, making them a good fit for a map app that combines a frontend with APIs.[cite:236] A custom domain can be attached directly to a Worker, and Cloudflare will provision the DNS and certificates for the Worker domain routing model.[cite:230]

Recommended stack:

- **Frontend**: static app served by Workers static assets.[cite:236]
- **API**: Worker endpoints for map reads, edits, authentication hooks, search, and reporting.[cite:224][cite:227]
- **Relational data**: Cloudflare D1 as the primary database because it provides serverless SQL with SQLite semantics and Worker bindings.[cite:226][cite:227]
- **Versioned records / snapshots**: D1 for revision metadata plus R2 for optional exported snapshots, backups, or GeoJSON bundles.[cite:226][cite:238]
- **Fast cache / derived search helpers**: KV for globally distributed read-oriented cache entries where eventual consistency is acceptable.[cite:229]
- **Strongly consistent collaborative or per-feature coordination later**: Durable Objects for features like live editing locks, collaborative sessions, or moderation queues that benefit from serialized access.[cite:235][cite:232]

## Why D1 is the core database

The project needs relational querying and search across features, categories, statuses, sources, reports, and revisions. D1 is Cloudflare's managed serverless SQL database with Worker access, which makes it the most natural base for structured map content and admin editing workflows.[cite:226][cite:227]

D1 also supports point-in-time recovery through Time Travel, with up to 30 days on paid plans and 7 days on free plans, which is useful for recovery after bad edits or accidental deletes.[cite:225] Current limits include 10 GB maximum database size on Workers Paid, 500 MB on Free, and 1000 read subrequests per Worker invocation on paid plans, which is more than enough for a v1/v2 rider map if queries are designed sensibly.[cite:225]

## Data model

The system should separate geometry, metadata, versions, and reports.

### Core entities

| Entity | Purpose |
|---|---|
| `features` | Canonical record for any map feature: point, line, polygon, or abstract corridor. |
| `feature_geometries` | Geometry records, ideally GeoJSON or GeoJSON-compatible JSON blobs. |
| `feature_categories` | Category definitions such as trail spines, neighborhoods, parks, ped bridges, planned projects. |
| `feature_statuses` | Status taxonomy: planned, under construction, nearly usable, open, open but sketchy, closed, seasonal. |
| `feature_sources` | URLs, citations, source notes, confidence, verification dates. |
| `feature_revisions` | Immutable revision history for each edit. |
| `feature_visibility` | Visibility and sensitivity controls for public/admin rendering. |
| `reports` | Field reports: mud, flooding, closure, debris, cops, gate open, connector rideable, etc. |
| `users` | Owner/admin and future authenticated users. |
| `comments` | Social discussion on features or reports. |
| `saved_items` | Saved features, routes, or watchlists. |

### Feature shape

Suggested canonical fields:

- `id`
- `slug`
- `name`
- `feature_type` (`point`, `line`, `polygon`, `zone`, `corridor`)
- `category_id`
- `status_id`
- `visibility` (`public`, `informal`, `sensitive`, `private`)
- `officiality` (`official`, `informal`, `unofficial`, `planned`)
- `geometry_current_id`
- `description`
- `surface_note`
- `risk_note`
- `weather_sensitivity`
- `source_confidence`
- `last_verified_at`
- `created_at`, `updated_at`

### Versioning model

Every edit should create a new immutable revision row in `feature_revisions`, including prior geometry and metadata. D1 handles the relational side, while exported snapshots can be written to R2 as timestamped JSON or GeoJSON files for human-readable rollback and external GIS workflows.[cite:226][cite:238]

Versioning should support:

- edit history per feature;
- diffable metadata and geometry changes;
- rollback to any prior revision;
- import/export snapshots;
- source-linked revisions (for example, “geometry updated from project PDF”).

## Search model

The app needs practical search, not just pan-and-zoom. That means searching by:

- feature name;
- corridor or park name;
- neighborhood;
- category;
- project status;
- surface condition;
- source confidence;
- sensitivity level;
- free-text notes and reports.

A pragmatic v1 plan is SQL text search patterns in D1 plus denormalized searchable text fields; later this can evolve to an indexed search strategy if needed.[cite:226][cite:227]

## GIS and OSM considerations

GeoJSON should be the initial editable/interchange format because it is easy to render on the web, import/export, and extend into later GIS tooling.[cite:217][cite:220][cite:223] The application should support importing and exporting GeoJSON, and should be structured so future GPX/KML import is straightforward.[cite:220][cite:223]

OpenStreetMap is a strong fit for basemap and contextual data, but OSM attribution must be visibly included where users interact with the map. The OpenStreetMap Foundation's attribution guidance expects clear attribution such as “© OpenStreetMap contributors,” linked appropriately and displayed in a way users can actually see.[cite:209][cite:213]

## Sensitive / gray-area knowledge policy

This is one of the most important product differentiators. The app should preserve useful informal route knowledge without loudly disclosing every legally gray-area access point.

Recommended policy:

- `official`: safe to show precisely and publicly.
- `informal`: okay to show, but wording should stay restrained.
- `sensitive`: generalized publicly; precise details owner/admin only.
- `private`: never public.

Public-safe behavior:

- generalized geometry for sensitive items;
- public labels like “informal connector” instead of explicit breach language;
- owner-only exact notes for things like fence gaps or semi-hidden cuts;
- optional “public-safe description” separate from full admin note.

Guiding product principle: **map what riders actually use, but disclose sensitive access with restraint.**

## UI and interaction design

The application should be map-first and compact. The sidebar should merge legend and navigation, but layer visibility should remain separate from jump navigation so users can navigate features without necessarily toggling whole categories off and on.

Required sidebar capabilities:

- legend;
- layer toggles;
- expandable category groups;
- jump-to-feature controls;
- search and filtering;
- status and sensitivity filters;
- owner/editor shortcuts.

Popup/detail requirements:

- name;
- category;
- description;
- status;
- surface/condition note;
- sensitivity badge when appropriate;
- source links;
- confidence level;
- last updated;
- recent reports.

## Editing model

The owner needs in-browser editing without mandatory GIS-heavy tooling in v1. Form-based editing is acceptable initially if it is reliable.

V1 editor requirements:

- create/edit/delete points and lines;
- edit coordinates as arrays or form fields;
- assign category, status, visibility, and confidence;
- attach source URLs and notes;
- publish/unpublish;
- preview public-safe vs admin-only rendering;
- import/export GeoJSON.

Later editor enhancements:

- drag point editing;
- polyline drawing/editing on the map;
- geometry snapping;
- revision diff UI;
- bulk import and review workflows.

## Social features roadmap

The architecture should anticipate but not necessarily fully implement in v1:

- comments on features;
- field reports on conditions;
- saved routes / saved features;
- public/private journals or ride notes;
- moderation queue;
- reactions or trust signals on reports;
- notifications or watchlists for planned connectors and status changes.

Durable Objects become interesting later if collaborative editing, live discussion rooms, or serialized moderation queues are needed.[cite:235][cite:232]

## Suggested file structure

```text
jojos-kc-bike-map/
├── src/
│   ├── worker/
│   │   ├── index.ts
│   │   ├── routes/
│   │   │   ├── features.ts
│   │   │   ├── reports.ts
│   │   │   ├── search.ts
│   │   │   ├── auth.ts
│   │   │   └── admin.ts
│   │   ├── db/
│   │   │   ├── schema.sql
│   │   │   ├── migrations/
│   │   │   └── queries/
│   │   └── lib/
│   ├── client/
│   │   ├── main.ts
│   │   ├── app/
│   │   ├── components/
│   │   ├── map/
│   │   ├── sidebar/
│   │   ├── editor/
│   │   └── styles/
│   └── shared/
│       ├── types.ts
│       ├── feature-schema.ts
│       └── constants.ts
├── public/
│   └── seed/
│       ├── features.geojson
│       ├── categories.json
│       └── sources.json
├── docs/
│   ├── project-spec.md
│   ├── implementation-plan.md
│   ├── data-model.md
│   └── sensitivity-policy.md
├── wrangler.toml
├── package.json
└── README.md
```

This structure keeps map data, UI, Worker routes, and shared schemas separated, which is critical given how brittle single-file inline-map editing becomes over time.[cite:236]

## Deployment notes

Cloudflare Workers static assets allow the frontend assets and Worker code to deploy together.[cite:236] The custom domain `jojomap.kcmo.xyz` can be attached directly to the Worker via the Workers custom domain flow in Cloudflare's dashboard.[cite:230]

## Implementation phases

### Phase 1

- scaffold Worker + static client;
- seed data from current map;
- render public map;
- category toggles, jump navigation, search;
- D1 schema and read API;
- owner-only basic auth or token gate;
- form-based feature editing;
- revision history per feature.

### Phase 2

- source management and confidence workflows;
- public/private rendering for sensitive features;
- project status tracking;
- reports and watchlists;
- import/export GeoJSON;
- admin revision rollback;
- basic comments.

### Phase 3

- collaborative editing hints or locks;
- richer moderation;
- better GIS editing UX;
- route-building tools;
- analytics and usage summaries;
- stronger search/indexing if needed.

## Build guidance

Prefer simplicity, editability, and durability over cleverness. The application should be easy for a single technically skilled owner to maintain, but structured so it can grow into a more social, map-heavy system later.[cite:226][cite:236]

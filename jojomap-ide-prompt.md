# IDE Build Prompt — Jojo's KC Bike Map

Build a production-ready web app called **Jojo's KC Bike Map** for deployment on Cloudflare Workers at `jojomap.kcmo.xyz`.

The app is a Kansas City metro bike map centered on real rider intelligence, not just official bike infrastructure. It must support official trails, parks, sidewalks, pedestrian bridges, planned connectors, condition-sensitive segments, and carefully handled informal or legally gray-area route knowledge.

## Product identity

This is not a tourism map and not a generic bike map. It should feel like a serious local rider's living map of Kansas City: official trails, weird connectors, sidewalks, ped bridges, parks, under-construction opportunities, floodplain cautions, and route knowledge that matters in real life.

A core differentiator is **informal route intelligence**, but the product must not loudly disclose sensitive access details. Build support for public-safe generalized geometry and admin-only precise details.

## Geographic frame

Use a KC metro diamond anchored by:

- Gladstone
- Blue Springs
- Grandview
- Overland Park

Seed the app with the current Jojo map concepts:

- Trail spines
- Ride anchors
- Neighborhoods
- Boundary anchors
- Key parks
- Ped bridges / sidewalks
- Planned / in progress
- Surface / connector notes

## Required architecture

Use Cloudflare Workers with static assets plus Worker API routes in one deployment unit.[cite:236]
Use Cloudflare D1 as the primary relational database because the product needs relational data, structured search, and version-aware editing.[cite:226][cite:227]
Use R2 for optional snapshot exports, backups, or versioned GeoJSON bundles.[cite:238]
Use KV only for cache-like or derived read-oriented data where eventual consistency is acceptable.[cite:229]
Design the system so Durable Objects can be added later for strong-consistency collaborative features or moderation workflows.[cite:235][cite:232]

## Data requirements

Implement a normalized data model with entities for:

- features
- feature geometries
- categories
- statuses
- sources
- revisions
- reports
- users
- comments
- saved items

Each feature should support:

- point, line, polygon, zone, or corridor geometry
- category
- status
- officiality
- visibility / sensitivity
- description
- surface note
- weather sensitivity
- source confidence
- last verified date
- source links
- revision history

## Versioning requirements

Versioning is mandatory.

Implement immutable revision history for feature edits, including geometry and metadata changes. Support rollback. Design exports so snapshots can be written as versioned JSON or GeoJSON. D1 should hold revision metadata and current state; R2 can hold exported snapshots or bundles.[cite:225][cite:226][cite:238]

## Search requirements

Search is mandatory and must work across relational data, not just simple client-side labels.

Support search by:

- name
- category
- neighborhood
- park
- status
- surface condition
- sensitivity level
- source confidence
- free-text notes
- reports

## Gray-area / sensitive route handling

This is critical.

Support four visibility modes:

- official
- informal
- sensitive
- private/admin-only

Sensitive or gray-area features must support:

- generalized public geometry
- exact admin geometry
- public-safe label/description
- admin-only internal note
- role-based rendering

Do not make the product feel sanitized, but do make it feel discreet.

Guiding principle: **map what riders actually use, but disclose sensitive access with restraint.**

## GIS / mapping requirements

Use GeoJSON as the initial editable/interchange format for custom features because it is web-native and easy to move into later GIS workflows.[cite:217][cite:220][cite:223]
Support import/export of GeoJSON.
Keep map data separate from UI code.
Design the schema so GPX/KML import can be added later.

Use a basemap strategy compatible with OpenStreetMap and include proper visible attribution such as “© OpenStreetMap contributors,” linked as required by OSM attribution guidelines.[cite:209][cite:213]

## Frontend requirements

Use TypeScript.
Use a maintainable frontend structure, not one monolithic HTML file.
Use Leaflet or MapLibre or similar for rendering.
Provide dark mode.

Sidebar must include:

- legend
- layer toggles
- expandable category groups
- jump-to-feature controls
- search/filter
- status filter
- sensitivity filter

Important: layer visibility controls and navigation/jump controls must be separate concerns.

Map popups or detail panels should show:

- name
- category
- description
- status
- surface / condition note
- source links
- confidence
- last updated
- sensitivity / visibility badge when relevant
- recent reports if any

## Editing requirements

The owner must be able to edit data in-browser.

V1 editing can be form-based if reliable. but, need to be able to draw routes on the map, lines that is, and select points on the map, for inclusion as :
- Trail spines
- Ride anchors
- Neighborhoods
- Boundary anchors
- Key parks
- Ped bridges / sidewalks
- Planned / in progress
- Surface / connector notes
etc.

Support:

- create/edit/delete points and lines 
- edit coordinate arrays
- assign category, status, visibility, officiality, confidence
- attach source URLs and notes
- publish/unpublish
- preview public-safe vs admin-only output
- import/export GeoJSON

Geometry editing can be basic in v1; do not overcomplicate if simpler editing is more maintainable.

## Social feature scaffolding

Prepare architecture and schema for future:

- comments
- field reports
- saved routes or saved features
- moderation queue
- watchlists for planned connectors
- trust or verification hints on reports

These do not all need to be fully implemented in v1, but the architecture must anticipate them cleanly.

## Deployment requirements

Deploy via Cloudflare Workers with static assets.[cite:236]
Use Wrangler config with D1 binding(s) and future-ready storage binding structure.[cite:224][cite:227]
Document setup for custom domain `jojomap.kcmo.xyz` and 'map.distorted.work' using Workers custom domains.[cite:230]

## Deliverables

Produce:

1. Full project scaffold.
2. Clear file structure.
3. D1 schema and starter migrations.
4. Seed data converted from the current Jojo map. (index.html) needs double checking as some of the map points (example: blue banks park) are not at all in the correct location on the map - confirm the actual coordinates of locations and correct as needed. 
5. Worker API routes for features, search, reports, and admin editing.
6. Static frontend with map, sidebar, legend, toggles, search, and detail views. also investigate why random map tiles are replaced with message about requiring referrer. fix.
7. Import/export GeoJSON support.
8. Revision history support.
9. README with Wrangler deploy instructions and custom domain notes.
10. Additional docs for data model, sensitivity policy, and implementation phases. if docs exists then check for accurate and mod if needs

## Build philosophy

Prefer clarity, editability, and future extensibility over cleverness. Build this so one technically capable owner can actually maintain it, while leaving room for richer GIS and social features soon to be added.

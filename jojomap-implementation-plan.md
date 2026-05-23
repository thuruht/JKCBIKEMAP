# Jojo's KC Bike Map — Implementation Plan

## Phase 1 — foundation

- Scaffold Cloudflare Worker + static frontend asset pipeline.[cite:236]
- Create D1 database and Worker bindings.[cite:224][cite:227]
- Define schema for features, categories, statuses, sources, revisions, and reports.[cite:226]
- Seed current map data into normalized records.
- Build public map, category toggles, jump controls, and popup/detail panels.
- Add basic owner auth guard and form-based editing.
- Implement revision creation on every edit.

## Phase 2 — better data and safer disclosure

- Add sensitivity and visibility policies.
- Add separate public-safe and admin-only representations for sensitive features.
- Add source confidence workflows and source-link editing.
- Add GeoJSON import/export.[cite:220][cite:223]
- Add search across names, categories, statuses, and notes.
- Add project status workflows for planned and under-construction connectors.

## Phase 3 — reports and community scaffolding

- Add field reports.
- Add comments and watchlists.
- Add moderation queue.
- Add saved features/routes.
- Add notifications for project status changes.
- Consider Durable Objects if serialized moderation or collaborative editing becomes important.[cite:235][cite:232]

## Phase 4 — GIS and performance refinement

- Improve geometry editing UX.
- Add GPX/KML import later.
- Add richer search/indexing if simple SQL search becomes limiting.
- Add exported snapshot pipeline to R2 for versioned bundles.[cite:238]
- Consider more advanced tile or vector strategies if the dataset grows substantially.

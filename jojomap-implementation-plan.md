# Jojo's KC Bike Map — Implementation Plan

## Phase 1 — Foundation (Completed)
- [x] Scaffold Cloudflare Worker + static frontend asset pipeline.
- [x] Create D1 database and Worker bindings.
- [x] Define schema for features, categories, statuses, sources, revisions, and reports.
- [x] Seed current map data into normalized records.
- [x] Build public map, category toggles, jump controls, and popup/detail panels.
- [x] Add basic owner auth guard and form-based editing.
- [x] Implement revision creation on every edit.

## Phase 2 — Better Data & Safer Disclosure (Completed)
- [x] Add sensitivity and visibility policies.
- [x] Add separate public-safe and admin-only representations for sensitive features.
- [x] Add source confidence workflows and source-link editing.
- [x] Add GeoJSON import/export.
- [x] Add search across names, categories, statuses, and notes.
- [x] Add project status workflows for planned and under-construction connectors.

## Phase 3 — Reports & Community Scaffolding (In Progress)
- [x] Add field reports (Backend/Frontend).
- [x] Encrypted Chat (Durable Objects + PartyServer).
- [x] Resilient Profile API (fallback to email prefix).
- [ ] Comments system.
- [ ] Moderation queue.
- [ ] Saved features/routes.
- [ ] Notifications for project status changes.

## Phase 4 — GIS & Performance Refinement (Future)
- [ ] Improve geometry editing UX.
- [ ] Add GPX/KML import.
- [ ] Automated PDF Data Extraction (OCR + Contour Matching for MARC/City PDFs).
- [ ] Richer search/indexing.
- [ ] Exported snapshot pipeline to R2.
- [ ] Advanced tile or vector strategies.

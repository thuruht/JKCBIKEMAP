# JOJO's KC Bike Map — Engineering Standards & Project Context

## Technical Architecture
- **Backend:** Cloudflare Workers (TypeScript) with D1 Database.
- **Frontend:** Vanilla JavaScript (ES Modules), Leaflet.js for mapping, GSAP for animations.
- **Styling:** CSS Variables and centralized `public/styles/main.css`. **Avoid inline styles.**
- **Real-time:** Durable Objects via `partyserver` (located in `jojomap-chat/`).
- **Deployment:** Managed via Wrangler (Worker for map, separate project for chat).

## Core Conventions
- **Routing:** Use `/rider/*` for vanity profile URLs; backend serves `index.html` for SPA routing.
- **API Aliases:** `/api/rider/*` is an alias for `/api/profiles/*`.
- **Database Lookups:** Profile lookups should be resilient (check username, email prefix, and ID).
- **CSS:** Use utility classes (e.g., `.hidden`, `.flex`, `.text-muted`) and component classes (e.g., `.badge-item`) in `main.css`.
- **Security:** 
    - CSP is strictly managed in `src/index.ts`. Explicitly allow only necessary `wss:` and `https:` origins.
    - CORS: Use `jsonResponse(data, status, request)` to ensure correct `Access-Control-Allow-Origin` based on the request's origin.
    - Mutations: All state-mutating requests (POST, PUT, DELETE) must use their respective HTTP methods; never use GET for mutations.
    - RBAC: Always use `hasPermission(role, permission)` for server-side gating.

## Recent Architectural Changes
- **SPA Routing Support:** Backend now handles `/rider/*` wildcard paths to support direct profile links.
- **WebSocket Hardening:** Standardized PartyServer connection paths and secured via explicit CSP entries.
- **Durable Object SQL:** Standardized on `exec().toArray()` for reads and `exec()` with parameters for writes as per spec.
- **Component Refactor:** Migrated dynamic HTML templates (profiles, badges, chat) from inline styles to CSS classes.
- **Field Reporting System:** Fully implemented backend/frontend for community condition reporting.

# Jojo's KC Bike Map

A production-ready web app for Kansas City metro bike mapping, centered on real rider intelligence.

## Tech Stack

- **Frontend:** Static HTML/JS with Leaflet (served by Cloudflare Workers)
- **API:** Cloudflare Workers (TypeScript)
- **Database:** Cloudflare D1 (Relational SQL)
- **Deployment:** Cloudflare Workers + D1

## Getting Started

### Prerequisites

- Node.js & npm
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/)
- Cloudflare Account

### Local Development

1.  Install dependencies:
    ```bash
    npm install
    ```

2.  Initialize the local database:
    ```bash
    npx wrangler d1 migrations apply jkcbikemap_db --local
    ```

3.  Run the development server:
    ```bash
    npx wrangler dev
    ```

### Deployment

1.  Create a D1 database:
    ```bash
    npx wrangler d1 create jkcbikemap_db
    ```

2.  Update `wrangler.toml` with the `database_id` from the output above.

3.  Apply migrations to production:
    ```bash
    npx wrangler d1 migrations apply jkcbikemap_db --remote
    ```

4.  Deploy the worker:
    ```bash
    npx wrangler deploy
    ```

## Custom Domains

The following domains are configured in `wrangler.toml`:
- `jojomap.kcmo.xyz`
- `map.distorted.work`

To make these active, you must:
1.  Ensure the domains are added as "Custom Domains" in your Cloudflare Worker dashboard.
2.  Ensure DNS records are correctly pointing to the Cloudflare Worker.

## Security & Admin

### Setting the Admin Token

Admin actions (adding/editing features) require an `ADMIN_TOKEN`. Set this as a secret in Cloudflare:

```bash
npx wrangler secret put ADMIN_TOKEN
```

Then enter this token when prompted by the "Login as Admin" button in the app.

## Features

- **Corridor-based mapping:** Focuses on rider intelligence and connections.
- **Dynamic API:** Fetches features, search results, and reports from D1.
- **"Crypt" Aesthetic:** GSAP-animated grid and UI polish for a high-fidelity feel.
- **Enhanced Reporting:** Dual-longevity system with 48-hour decay for temporary alerts.
- **Regional Integration:** Built-in pipeline for MARC Regional Trails and OSM Amenities.
- **Secure Self-Management:** Unique tokens allow community members to delete their own reports.
- **Sensitivity Policy:** Support for public-safe vs. admin-only geometry and descriptions.
- **Local Search:** Filter features by name, category, or description.

## Data Model

The app uses a normalized schema:
- `features`: Core metadata and current state.
- `feature_geometries`: GeoJSON geometries (public and admin).
- `feature_revisions`: Immutable history of edits.
- `reports`: User-submitted field reports.

## License

ISC

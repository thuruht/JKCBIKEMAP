# Jojo's KC Bike Map

A production-ready web app for Kansas City metro bike mapping, centered on local rider knowledge.

## Tech Stack

- **Frontend:** Static HTML/JS with Leaflet (served via Cloudflare Workers Assets)
- **Animations:** GSAP (locally hosted)
- **API:** Cloudflare Workers (TypeScript)
- **Database:** Cloudflare D1 (Relational SQL)
- **Storage:** Cloudflare KV (User preferences)
- **Authentication:** Cloudflare Workers Email Sending (Native Beta)
- **Deployment:** Cloudflare Workers + D1 + KV

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

### User Roles & RBAC

The system uses email-based Role-Based Access Control:
- **Public**: Unauthenticated users. View only.
- **User**: Authenticated via Magic Link. Can submit knowledge.
- **Contributor**: High-rep users (XP ≥ 50). Can view sensitive map details.
- **Moderator**: Community safety role. Can edit public fields and hide content.
- **Admin**: Full platform control. Can assign roles and import data.

Initial admins are seeded via migration `0009_rbac_system.sql`. Access is granted by logging in with a registered admin email.

## Features

- **Corridor-based mapping:** Focuses on rider knowledge and connections.
- **Dynamic API:** Fetches features, search results, and reports from D1.
- **"Crypt" Aesthetic:** GSAP-animated grid and UI polish for a high-fidelity feel.
- **Enhanced Reporting:** Dual-longevity system with 48-hour decay for temporary alerts.
- **Regional Integration:** Built-in pipeline for MARC Regional Trails and OSM Amenities.
- **Secure Self-Management:** Unique tokens allow community members to delete their own reports.
- **Sensitivity Policy:** Support for public-safe vs. admin-only geometry and descriptions.
- **Local Search:** Filter features by name, category, or description.

## Data Model

The app uses a hardened, production-ready schema:
- `features`: Core metadata, current state, longevity, and ownership.
- `feature_geometries`: Separated GeoJSON geometries (public and sensitive).
- `feature_revisions`: Immutable history of every edit.
- `reports`: Community condition reports with 48-hour decay logic.
- `users`: Verified identities via Magic Link.
- `sessions`: Secure HttpOnly session management.
- `auth_tokens`: Single-use verification tokens.

## License

ISC

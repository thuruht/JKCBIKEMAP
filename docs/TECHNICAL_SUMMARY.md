# Jojo's KC Bike Map — Technical Summary & Feature Guide

## Project Identity
A high-fidelity rider intelligence tool for the Kansas City metro. Unlike generic maps, this project prioritizes **actual rideability**, informal connectors, and real-time community conditions.

## Key Features

### 1. "Crypt" Aesthetic & UI
- **Animated Grid:** A high-contrast, pulsing background grid combined with a GSAP-powered vertical "scanline" effect.
- **GSAP Polish:** Smooth slide-in transitions for the Info Card and staggered "pop-in" animations for sidebar tiles.
- **Rider-First Design:** Large hit areas for mobile/glove-friendly navigation and high-contrast typography (`Instrument Serif`).
- **#RRGGBBAA Standard:** All colors across CSS and JavaScript use the strict 8-digit hex format for precision and consistency.

### 2. Community Intelligence (Field Reports)
- **Dual Longevity:**
    - **Temporary Alerts:** (e.g., Mud, Flooding) Fade out over 48 hours using **Time-based Decay** logic to keep data fresh.
    - **Permanent Infrastructure:** (e.g., Missing Sidewalk) Stays visible until resolved.
- **Secure Delete-by-Poster:** 
    - Riders who provide an email receive a unique **Delete Token**.
    - Allows community members to remove their own reports without needing an admin account or logging in.
- **Privacy First:** Automatic redaction of IP addresses and emails from public-facing descriptions.

### 3. Integrated Regional Data
- **MARC Integration:** Direct import pipeline from the Mid-America Regional Council (MARC) Regional Trails ArcGIS API.
- **Layer Toggles:** Users can toggle between **Rider Intel**, **Official Regional Data**, **Field Reports**, and **Rider Amenities**.
- **Amenities Layer (OSM):** Live Overpass API integration to fetch water fountains, repair stations, and bike shops based on the current map view.

## Architecture (Cloudflare Stack)

- **Worker API:** TypeScript-based backend handling features, search, auth, and preferences.
- **D1 Database:** Relational SQL (SQLite) for structured feature data, users, and sessions.
- **KV Storage:** Used for high-speed retrieval of user-specific preferences (e.g., preferred basemap style).
- **Static Assets:** High-performance frontend hosting via Cloudflare Workers Assets.
- **Localized Dependencies:** Leaflet and GSAP are hosted locally in `/vendor/` to remove reliance on external CDNs.
- **Basemap Variety:** Defaults to **CartoDB Dark Matter**, with high-performance options for Voyager, OSM, and Terrain. Persists user choice to KV.

## Admin System
- **Integrated Login:** Dedicated authentication view in the sidebar replaces browser alerts.
- **Magic Link Auth:** Passwordless login system using Cloudflare Email Sending (Beta).
- **Persistent Sessions:** Admin and User states are persisted locally and validated server-side.
- **Admin Marker Dragging:** Admins can drag point markers directly on the map to fine-tune coordinates. Changes save instantly.
- **Tools:** In-browser tools for adding/editing points and lines, dragging markers, and a one-click MARC data update.


## Data Model Updates
- Added `longevity`, `poster_email`, and `delete_token` to the `features` table.
- Implemented `feature_geometries` for separating public and sensitive (admin-only) paths.
- Every edit triggers an entry in `feature_revisions` for full rollback capability.

# Production Plan: Nimea Interactive Map & Wiki

This document outlines the development plan for the Nimea project, based on our refined vision. We will track progress here.

## Phase 1: Visual Foundation & Core Structure

- [x] Establish the visual theme: parchment background, medieval fonts, and basic layout.
- [x] Set up the Eleventy project structure (`package.json`, `.eleventy.js`).
- [x] Create initial wiki and map placeholder pages.

## Phase 2: Wiki Content & DM Editor

- [x] Integrate Decap CMS to create the `/admin` panel for wiki editing.
- [x] Configure CMS collections for all wiki chapters (Locations, Characters, etc.).
- [x] Include a `public: true/false` toggle in the editor for GM-only content.
- [x] Set up a local Git backend for testing the CMS.

## Phase 3: Interactive Map & DM Editor

- [ ] Build the core Leaflet map with the base image and overlays.
- [ ] Implement the in-map DM mode (`?dm=1`) for adding/editing markers.
- [ ] Implement tools to "paint" terrain data (difficult, blocked).
- [ ] Create "Export" functionality to save `markers.json` and `terrain.geojson`.
- [ ] Include a `public: true/false` toggle for map markers.

## Phase 4: Integration & Interactivity

- [ ] Connect the wiki and the map with a "Show on map" button (`/map?focus=<map_id>`).
- [ ] Implement A* pathfinding using the terrain data from the map editor.
- [ ] Build the route planning UI to display distance and travel time.

## Phase 5: Polish & Final Features

- [ ] Implement the automatic "backlinks" feature for wiki pages.
- [ ] Integrate a static search engine (e.g., Pagefind) for the wiki.
- [ ] Final styling touches: faded image borders, iconography, and responsive design.

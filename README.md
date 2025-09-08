# Nimea Wiki and Interactive Map

A zero-backend wiki and interactive map for the fantasy realm of Nimea. Built with Eleventy, Decap CMS, and Leaflet.js.

Live Site: https://nimea-wiki.netlify.app/

---

## Features

- Wiki with categories for Characters, Locations, Nations & Factions, Gods & Religions, Magic & Powers
- Visual CMS (Decap) for editing content through the browser
- Full-screen Leaflet map with pan/zoom, overlays, and info-rich markers
- Route planning (player mode) with distance and travel-time estimates
- Shareable route links (copy a URL that reconstructs the same markers & waypoints)
 - Route editing & data maintenance tools (internal-only)
- Terrain-aware A* pathfinding that respects road/difficult/unpassable costs
- Automatic wiki integration: markers can link to relevant wiki pages (optional custom slug)

Single source of truth (no drift):
- Both TR (`/map`) and EN (`/en/map`) load the same data from `map/data`.
- Both languages reuse the same map modules in `map/js/*`.
- Only EN-specific files are localized strings (`en/map/js/i18n.js`) and DM UI text (`en/map/js/dm-*.js`).

---

## Why I Built It

I wanted a light, self-hostable worldbuilding stack where both the wiki and the map are versioned, editable through a browser, and deployable as a static site. This avoids server costs while keeping collaboration simple.

---

## Live Demo / Install

- Live: https://nimea-wiki.netlify.app/

Local setup:
1. Clone: `git clone https://github.com/BDenizKoca/nimea.git && cd nimea`
2. Install: `npm install`
3. Develop: `npm start` (serves Eleventy with live reload)
4. Build: `npm run build` (outputs to `_site/`)

Notes:
- The EN map page references shared scripts: `/map/js/*` and shared data `/map/data/*`.
- DM editor supports bilingual fields (TR/EN) for marker name, summary, and faction. Top-level fields remain as fallback.

---

## Usage

Public map usage:
- Plan routes, inspect markers, view overlays.
- Use the share button in a built route's summary to copy a link that reconstructs the same path.

### Route Sharing

After building a route (at least 2 stops) a button appears in the route summary:

- TR: `Rota Bağlantısını Kopyala`
- EN: `Copy Route Link`

Clicking it copies a URL like:
```
https://example.com/map/?r=v1|m:aurelium;m:camkale;w:1834,992;m:thornhold
```

Format (versioned for future changes):
`v1|` then a `;`-separated list of items.

Items:
- `m:<markerId>` – a map marker by its id
- `w:<x>,<y>` – an ad‑hoc waypoint (internal pixel coords rounded)

Unknown / removed markers are skipped with a small toast warning. Waypoints are recreated in place. If markers have the same IDs across languages the same link works on `/map/` and `/en/map/`.

No compression yet (links stay readable); can migrate to a `v2` format later if needed.

---

## Tech Stack

- Eleventy (11ty) for static-site generation
- Decap CMS for content editing and Git-based publishing
- Leaflet.js and Leaflet-Geoman for mapping and editing
- Netlify for hosting, identity, and build pipelines

---

## Future Plans

- Additional wiki templates and cross-linking
- Richer marker types and iconography
- Import/export tools for bulk content
- Optional multilingual wiki content

---

## Connect With Me  
Email: [b.denizkoca@gmail.com](mailto:b.denizkoca@gmail.com)  
GitHub: [@BDenizKoca](https://github.com/BDenizKoca)  

---

## License  
MIT License – You can use, modify, and distribute freely with attribution.  

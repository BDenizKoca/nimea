# Nimea Wiki and Interactive Map

A zero-backend wiki and interactive map for the fantasy realm of Nimea. Built with Eleventy, Decap CMS, and Leaflet.js.

Live Site: https://nimea-wiki.netlify.app/

---

## Features

- Wiki with categories for Characters, Locations, Nations & Factions, Gods & Religions, Magic & Powers
- Visual CMS (Decap) for editing content through the browser
- Full-screen Leaflet map with pan/zoom, overlays, and info-rich markers
- Route planning (player mode) with distance and travel-time estimates
- DM Mode (`?dm`) for batch edits to markers and terrain, with export/publish controls
- Terrain-aware A* pathfinding that respects road/difficult/unpassable costs
- Automatic wiki integration: markers can link to relevant wiki pages (optional custom slug)

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

---

## Usage

Wiki editing (hosted):
- Visit `/admin/` on the deployed site and log in to edit content via CMS.

Map usage:
- Player mode (default): plan routes, inspect markers, view overlays.
- DM mode: open `/map/?dm`, sign in, then draw markers or paint terrain. Use “İndir” to download data or “Yayınla” to commit changes to the repo (Netlify Identity + Git Gateway).

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

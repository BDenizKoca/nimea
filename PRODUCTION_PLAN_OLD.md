# Nimea Production Plan# Nimea Interactive Map & Wiki – Production Plan & Comprehensive Design Doc



## Current Status: 🟡 In DevelopmentThis document merges the original production phases with the full design specification, data contracts, and roadmap for the Nimea interactive map + wiki platform. It is the single source of truth for scope, architecture, and acceptance criteria.



**Last Updated**: September 1, 2025---



## ✅ Completed Features## 0. Project Tracker (Summary)



### Wiki System**Status:** 🟡 Started  

- [x] Eleventy static site generator setup**Type:** Dev, Worldbuilding, Tool  

- [x] Decap CMS integration with Git Gateway authentication**Summary:** Zero-backend interactive world map for Nimea with blockable terrain, layered overlays, named locations, and route planning in custom units.  

- [x] Content collections: Characters, Locations, Nations & Factions, Gods & Religions, Magic & Powers**Current State:** Functional prototype (Leaflet + Geoman + EasyStar + Turf). Will lock to a single full-page map with fixed scale; add overlays, DM editing, named markers + popups, multi-stop route planning.  

- [x] Dynamic collection pages with automatic content updates**Next Step:** Implement fixed-scale config (175 px = 100 km), overlay toggles, marker schema + popups, DM paint tools for terrain costs, and sidebars.  

- [x] Comprehensive image system:**Success Metric:** Public URL: players can pan/zoom, toggle overlays, click locations → right info sidebar, add to route, see left route panel compute km & travel time (walk 30, wagon 50, horse 60 km/day). DM mode supports editing markers and painting terrain costs.  

  - [x] Cover images for all content types

  - [x] Portrait images for characters and gods---

  - [x] Inline images with CSS classes for alignment and sizing

  - [x] Custom CMS image insertion popup with preview## 1. Vision & Design Principles

  - [x] Click-to-edit image functionality in CMS

- [x] Responsive design with medieval theme**Vision:** A fast, elegant, GM-friendly map that fills the screen, respects Nimea aesthetics, and yields reliable travel estimates with DM-editable terrain rules.

- [x] Netlify deployment with automatic builds

**Principles:**

### Development Infrastructure* Single artifact – one fullpage map image (`map.png`).

- [x] Clean codebase structure* Fixed explicit scale – **175 px = 100 km** (≈ 0.5714286 km/px). No calibration UI in player mode.

- [x] Streamlined dependencies (only Eleventy)* Layered overlays – transparent PNGs for regions & political borders with toggles.

- [x] GitHub repository with version control* DM-first editing – add/edit locations, paint terrain (desired / undesired / impossible).

- [x] Documentation (README, Images Guide)* Player clarity – click location → right sidebar detail & gallery → Add to route.

* Own your data – JSON + GeoJSON stored under `/data` versioned in git.

## 🚧 In Progress* Zero backend – static hosting only.



### CMS Enhancement---

- [ ] **Image click functionality debugging** - Need to resolve image helper popup not appearing on click

- [ ] **Sync scroll verification** - Ensure sync scroll button works properly in CMS interface## 2. Users & Core Use Cases



## 📋 Remaining Tasks**Users:** Dungeon Master (DM) and Players.



### Priority 1: Core Map System**Player Flow:** Open map → toggle overlays → click location → right sidebar (info + images) → Add to route → left sidebar shows legs, total km & travel days for walking (30), wagon (50), horse (60).

- [ ] **Interactive Map Implementation**

  - [ ] Leaflet.js integration with custom coordinate system (CRS.Simple)**DM Flow:** Enter DM mode (`?dm=1` + passcode) → add/edit locations (coords, images, visibility) → paint terrain: desired (road), undesired (difficult), impossible (blocked) → export/save data (`markers.json`, `terrain.geojson`).

  - [ ] Base map image loading and display (`map.png`)

  - [ ] Fixed scale configuration (175 px = 100 km)---

  - [ ] Pan and zoom functionality

## 3. Scope

- [ ] **Map Overlays**

  - [ ] Toggle controls for regions overlay (`overlays/regions.png`)### 3.1 MVP (Must)

  - [ ] Toggle controls for borders overlay (`overlays/borders.png`)* Single fullpage map; pan/zoom (Leaflet CRS.Simple).

  - [ ] Overlay management system* Fixed scale: 175 px = 100 km (`kmPerPixel = 0.5714285714`).

* Overlay toggles: Regions (`overlays/regions.png`), Borders (`overlays/borders.png`).

- [ ] **Location Markers*** DM Mode: add/edit named locations (id, name, coords, summary, images, public flag); paint terrain (road / difficult / blocked); export `markers.json`, `terrain.geojson`.

  - [ ] Load markers from generated `data/markers.json`* Player Mode: right sidebar for location; Add to route; left sidebar route summary (multi-stop sequential order) with distances and travel time (profiles 30/50/60 km/day).

  - [ ] Display location markers on map* Pathfinding (A*) honoring terrain costs (desired < normal < difficult; blocked impassable).

  - [ ] Marker click to open information sidebar* Static hosting (GitHub Pages / Cloudflare / Netlify).

  - [ ] Auto-generation of markers from wiki location entries

### 3.2 Should (Post-MVP)

### Priority 2: Map Interactivity* Reorder & remove route stops.

- [ ] **Route Planning System*** Marker search & faction/type filter.

  - [ ] "Add to Route" functionality from location pages* Bridges/ferries as controlled low-cost crossings.

  - [ ] Multi-stop route planning interface

  - [ ] Route visualization on map### 3.3 Could (Nice to Have)

* Print view / PNG export of current view.

- [ ] **Pathfinding & Travel Calculations*** Styled icon set matching Nimea symbology.

  - [ ] A* pathfinding algorithm implementation

  - [ ] Terrain cost system (roads, difficult terrain, blocked areas)### 3.4 Non-Goals (Now)

  - [ ] Travel time calculations for different methods:* Multi-map support, true GIS/projections, accounts/multiuser sync, fog of war.

    - [ ] Walking (30 km/day)

    - [ ] Wagon (50 km/day)---

    - [ ] Horse (60 km/day)

  - [ ] Distance calculations in kilometers## 4. UX Design



### Priority 3: Map Editing (DM Mode)**Layout:**

- [ ] **DM Authentication*** Center: Fullpage map.

  - [ ] Password-protected DM mode (`?dm=1` + passcode)* Top-right: Overlay toggles (Regions, Borders).

  - [ ] DM toolbar and editing interface* Right Sidebar: Location detail (name, summary, images, wiki link, Add to route button).

* Left Sidebar: Route planner (list of stops, per-leg km, cumulative km, days by profile).

- [ ] **Location Management*** DM Toolbar (only in DM mode): add/edit marker, terrain paint modes (road/difficult/blocked), export.

  - [ ] Add new location markers

  - [ ] Edit existing location properties**Accessibility:** Keyboard-focusable controls, ESC closes sidebars, sufficient contrast. 

  - [ ] Delete location markers

  - [ ] Export updated `markers.json`**Mobile:** Pinch zoom, collapsible sidebars, large touch targets.



- [ ] **Terrain Editing**---

  - [ ] Drawing tools for terrain types:

    - [ ] Roads (preferred paths)## 5. Data & Units

    - [ ] Difficult terrain (higher cost)

    - [ ] Blocked areas (impassable)* Scale: `kmPerPixel = 100/175 ≈ 0.5714285714`.

  - [ ] Terrain visualization on map* Profiles: walking 30 km/day, wagon 50, horse 60.

  - [ ] Export terrain data as `terrain.geojson`* Units displayed: km & days (1 decimal day precision desired).

* Coordinates: Pixel space of `map.png` (Leaflet CRS.Simple).

### Priority 4: Wiki-Map Integration

- [ ] **Deep Linking**### 5.1 Markers Data Model (`data/markers.json`)

  - [ ] "Show on Map" buttons on location pages```json

  - [ ] URL parameter support (`/map?focus=location-id`){

  - [ ] Map marker links back to wiki pages	"markers": [

		{

- [ ] **Data Synchronization**			"id": "varkas",

  - [ ] Automatic marker generation from wiki locations			"name": "Varkas",

  - [ ] Consistent data between wiki and map			"x": 1234,

  - [ ] Location coordinate management			"y": 987,

			"type": "city",

### Priority 5: Polish & Advanced Features			"faction": "Kuruntar",

- [ ] **Search & Navigation**			"summary": "Başkent, yıkık bir kutsal şehrin üzerine inşa edildi.",

  - [ ] Search functionality for locations			"images": ["/images/varkas_1.jpg", "/images/varkas_2.jpg"],

  - [ ] Filter markers by type/faction			"public": true

  - [ ] Breadcrumb navigation		}

	]

- [ ] **Mobile Optimization**}

  - [ ] Touch-friendly map controls```

  - [ ] Responsive sidebar layouts

  - [ ] Mobile route planning interface### 5.2 Terrain Data Model (`data/terrain.geojson`)

* `kind`: `road` (desired), `difficult` (undesired), `blocked` (impassable). Optional future: `bridge`, `ferry`.

- [ ] **Visual Polish*** LineStrings (roads/rivers), Polygons (areas: oceans, mountains, walls).

  - [ ] Custom map icons for different location types```json

  - [ ] Medieval-themed UI elements{

  - [ ] Loading states and animations	"type": "FeatureCollection",

  - [ ] Print/export functionality	"features": [

		{ "type": "Feature", "properties": {"kind": "road"}, "geometry": {"type": "LineString", "coordinates": [[100,900],[400,900]]}},

## 🎯 Next Milestones		{ "type": "Feature", "properties": {"kind": "blocked"}, "geometry": {"type": "Polygon", "coordinates": [[[200,200],[500,200],[500,500],[200,500],[200,200]]]}}

	]

### Milestone 1: Basic Interactive Map (Target: 1-2 weeks)}

- Interactive map with pan/zoom```

- Location markers from wiki data

- Basic overlay toggles### 5.3 Config (`data/config.json`)

- Map-wiki linking```json

{ "kmPerPixel": 0.5714285714, "overlays": { "regions": "overlays/regions.png", "borders": "overlays/borders.png" } }

### Milestone 2: Route Planning (Target: 2-3 weeks)```

- Multi-stop route planning

- Distance and travel time calculations---

- Basic pathfinding

## 6. Architecture & Tech Choices

### Milestone 3: DM Tools (Target: 3-4 weeks)

- DM mode with editing capabilities* **Leaflet (CRS.Simple)** – base map & image overlays.

- Terrain editing tools* **Leaflet.Geoman** – DM drawing/editing (markers + terrain geometries).

- Data export functionality* **EasyStar.js** – A* pathfinding with variable tile costs.

* **Turf.js** – spatial predicates (point-in-polygon, buffering).

### Milestone 4: Full Integration (Target: 4-5 weeks)* **Vanilla JS + CSS** – lightweight, frameworkless UI.

- Complete wiki-map integration* **Eleventy + Decap CMS** – wiki build, content editing, automatic marker generation.

- Mobile optimization

- Performance optimization**File Structure (Contract):**

- Final polish```

/map           # Leaflet runtime app

## 🔧 Technical Considerations/wiki          # Eleventy wiki

/data          # Shared artifacts

### File Structure Needed	config.json

```	markers.json      # generated by wiki build

/map/               # Interactive map application	terrain.geojson   # exported by map DM mode

├── index.html      # Main map interface/images        # uploaded via Decap

├── map.js          # Map functionality/admin         # Decap CMS

├── style.css       # Map-specific stylesmap.png

└── map.png         # Base map image```



/data/              # Shared data files---

├── config.json     # Map configuration

├── markers.json    # Generated from wiki## 7. Pathfinding Design

└── terrain.geojson # DM-created terrain data

**Grid:** Cell size default 24 px (tunable 24–48). Derive columns/rows from map image dimensions.

/overlays/          # Map overlay images

├── regions.png     # Regional boundaries**Cost Derivation (per cell center):**

└── borders.png     # Political borders1. Base cost = 1.0.

```2. Inside any `blocked` polygon → impassable.

3. Within buffer of `difficult` geometry → cost × 3.0.

### Dependencies to Add4. Within buffer of `road` line → cost × 0.5.

- **Leaflet.js** - Interactive mapping5. Bridges/ferries (future): enforce traversable corridor cost 0.75–1.0 across water.

- **Leaflet.Geoman** - Drawing tools for DM mode6. Precedence: blocked > bridge/ferry > road > difficult. Clamp final numeric cost to [0.25, 5.0].

- **EasyStar.js** - A* pathfinding algorithm

- **Turf.js** - Spatial calculations**EasyStar Mapping:** tile IDs: road=2 (0.5), normal=1 (1.0), difficult=3 (3.0), blocked=9 (not acceptable). Allow diagonals, no corner cutting.



### Data Flow**Output:** Cell path → pixel coordinates → polyline overlay. Distance (pixels) × `kmPerPixel` → km, then km / daily profile speed → days.

1. Wiki content → Eleventy build → `markers.json`

2. DM edits terrain → Export → `terrain.geojson`**Performance:** Larger cell size for speed; simplify stored geometries; potential Web Worker for A* (post-MVP); cache grid unless terrain changes.

3. Map reads all data files → Renders interactive experience

---

## 🚀 Success Criteria

## 8. Persistence Strategy

The project will be considered complete when:

- [ ] Users can browse the wiki and see all content properly* `data/config.json` – scale & overlay references.

- [ ] Users can view the interactive map with all locations* `data/markers.json` – generated from wiki (never hand-edited).

- [ ] Users can plan routes and get accurate travel times* `data/terrain.geojson` – DM exports (committed to repo).

- [ ] DMs can edit locations and terrain through the interface* Player mode: read-only consumption of all three.

- [ ] The system works seamlessly on desktop and mobile

- [ ] All data stays in sync between wiki and map---



## 📝 Notes## 9. Hosting & Deployment



- Focus on getting core map functionality working before advanced features* Static host (GitHub Pages / Cloudflare / Netlify).

- Ensure all data export/import works correctly for persistence* DM editing local / passcode gate (low security). Real auth out of scope.

- Test thoroughly on different devices and browsers* Single stable URL (one map asset).

- Consider performance with large maps and many markers

- Document DM workflows clearly for ease of use---

## 10. Risks & Mitigations

| Risk | Trigger | Mitigation |
|------|---------|------------|
| Image size / perf | Large `map.png` slows mobile | Keep ≤ 8k long edge, maybe WebP alt |
| Path grid cost | Huge grid slow A* | Tune cell size, cache grid, worker (later) |
| Drift wiki ↔ map | Manual edits to markers | Always generate `markers.json` in build |
| Editing security | Passcode leaks | Accept low risk, upgrade later if needed |
| User painting errors | Mis-labeled terrain | Provide legends, allow delete/undo via Geoman |
| Backlinks missing | Inconsistent links | Enforce relative links, build crawler |

---

## 11. Testing Plan (Functional Checklist)
1. Map loads fullpage; overlays toggle.
2. Add 3 markers; right sidebar content & gallery show.
3. Add 2+ route points; left sidebar lists legs, totals, profile days.
4. Add blocked wall; path cannot cross.
5. Add road line; path prefers it (shorter cost/time vs baseline).
6. Export/import markers & terrain; round-trip preserves data.
7. `?focus=<id>` centers & opens marker.
8. Mobile Safari usability (sidebars & gestures).

---

## 12. Roadmap Overview

**MVP v0.1:** Fullpage map, fixed scale, overlay toggles, markers + right sidebar with images + Add to route, left route sidebar w/ km & days, DM mode (markers + terrain painting), A* with costs, export/import data, deploy.

**v0.2 (Definite):** Reorder/remove stops, marker search/filter, bridges/ferries crossing features, preload data, legend + basic icon set.

**v0.3:** Print/PNG export, visual polish (icons, styling), performance (grid caching, optional worker), minor UX refinements.

---

## 13. 7-Day Action Plan (Bootstrapping)
Day 1: Create repo / commit prototype / README.
Day 2: Add `map.png` and initial blocked polygons (oceans, perimeter).
Day 3: Hardcode scale in config; test 3 routes; tune cell size.
Day 4: Implement preload of terrain if file exists; overlay toggles.
Day 5: Marker support & minimal legend.
Day 6: Deploy to GitHub Pages; mobile verification.
Day 7: Usage guide + 2 min demo GIF.

---

## 14. MVP Task Sheet

| ID | Task | Owner | Status | Est. | Acceptance Criteria |
|----|------|-------|--------|------|---------------------|
| MVP-1 | Fullpage layout + map.png load | Deniz | Todo | 45m | Map fills viewport, pans/zooms |
| MVP-2 | Fixed scale from config | Deniz | Todo | 15m | `kmPerPixel=0.5714286` used globally |
| MVP-3 | Overlay toggles (regions/borders) | Deniz | Todo | 30m | PNG overlays toggle on/off |
| MVP-4 | Markers load/render from JSON | Deniz | Todo | 45m | Click opens right sidebar with info/images |
| MVP-5 | Right sidebar UI + gallery | Deniz | Todo | 1h | Scrollable panel with images & wiki link |
| MVP-6 | Add to route → left sidebar | Deniz | Todo | 45m | Adds stop & opens route panel |
| MVP-7 | Route calc with costs (A*) | Deniz | Todo | 2h | Prefers roads, avoids difficult, blocks blocked |
| MVP-8 | Profiles/time calc (30/50/60) | Deniz | Todo | 20m | Accurate per profile output |
| MVP-9 | DM mode gate + toolbar | Deniz | Todo | 40m | `?dm=1` + passcode reveals tools |
| MVP-10 | DM add/edit markers (+export) | Deniz | Todo | 1h | Export `markers.json` |
| MVP-11 | DM terrain paint tools (+export) | Deniz | Todo | 1.5h | Export `terrain.geojson` |
| MVP-12 | Deploy static | Deniz | Todo | 30m | Public URL mobile & desktop |

### Post-MVP (v0.2–v0.3)
| ID | Task | Owner | Status | Est. | Acceptance Criteria |
|----|------|-------|--------|------|---------------------|
| P-1 | Reorder route stops & remove | Deniz | Todo | 1h | Drag reorder & remove stop recalculates |
| P-2 | Marker search + faction/type filter | Deniz | Todo | 1h | Filters list & map markers |
| P-3 | Bridges/ferries crossings | Deniz | Todo | 1.5h | Low-cost legal river crossings |
| P-4 | Legend + icon set | Deniz | Todo | 1h | Clear symbol meanings |
| P-5 | Preload data at startup | Deniz | Todo | 1h | Existing files render automatically |

---

## 15. Definition of Done (MVP)
* Public URL with working interactive map.
* ≥3 blocked regions saved to `data/terrain.geojson` (or dedicated blocked areas section).
* Route between 2 cities: km & days correct via fixed scale.
* README explains usage & scale assumptions.
* Mobile pinch-zoom & sidebars validated.

---

## 16. Wiki MVP – Detailed Spec

**Information Architecture:**
* Home `/wiki` – search, chapter tiles, recent entries.
* Chapters: locations, characters, nations, gods, magic, events, adventures.
* Entries: `/wiki/<chapter>/<slug>/` with breadcrumbs & related.
* Map deep link: `/map?focus=<map_id>`.

**Collections & Core Fields (All):** `slug, name, summary, cover, images[], tags[], body, status (draft/published)`.

**Special Fields:**
* Locations & Regions: `map_id` (default slug), `map_coords {x,y}`, `public`, `type` (city, ruin, region, landmark).
* Characters: `affiliations[]`, `locations[]`, `age`, `role`.
* Nations & Factions: `capital`, `leaders[]`, `domains[]`.
* Gods & Religion: `domains[]`, `symbols[]`, `cult_sites[]`.
* Magic & Powers: `category`, `risk`, `cost`.
* Events: `year`, `era`, `locations[]`.
* Adventures: `locations[]`, `level`, `session_estimate`, `hooks[]`.

**Backlinks Strategy:** Crawl content & relational arrays to build backlinks list per entry; render at bottom.

**Search:** Static index (Pagefind or Lunr) across name, summary, tags, headings, body.

**Data Exchange:**
* Build emits `data/markers.json` from published location & region entries with coords: shape `[id, name, x, y, type, summary, wiki, public]`.
* Map consumes markers + `config.json` + `terrain.geojson`.

**Wiki Acceptance Checks:**
1. Locations index lists cards with cover, name, summary.
2. Entry shows breadcrumbs, images, related, backlinks.
3. Show on map → `/map?focus=<map_id>` centers marker.
4. Build emits marker entry to `data/markers.json`.
5. Search finds title or tag.
6. Draft entries excluded from indexes & markers.

---

## 17. Contracts & Invariants (Agent Hand‑Off)

**Problem Statement:** Build single-repo static site with `/map` (Leaflet) + `/wiki` (Eleventy). Decap CMS manages wiki. Wiki generates markers. Terrain edited only in map DM mode. No backend/auth beyond DM toggle.

**Non-Negotiable Invariants:**
* One map `map.png`.
* Fixed scale `kmPerPixel = 100/175` (no runtime calibration UI for players).
* Locations single source = wiki; `markers.json` generated only at build.
* Terrain exported only from DM mode.
* No multi-map, no accounts, no GIS projections.

**Build Pipeline (Eleventy):**
* Generate chapter indexes & entry pages.
* Crawl markdown for backlinks (slugs, relational arrays, inline links).
* Emit `/data/markers.json` from location entries.
* Generate static search index.

**Map Runtime Contract:**
* Read config for `kmPerPixel` + overlays.
* Load markers; respect `?focus=<map_id>` to center & open.
* A* routing honors terrain categories & costs.
* Left sidebar lists route legs with km & days (profiles 30/50/60).

**Acceptance Tests (Expanded):**
1. `/wiki/locations/varkas/` renders with backlinks.
2. `markers.json` contains `varkas` w/ coords & wiki URL.
3. `/map?focus=varkas` opens marker sidebar.
4. Overlay toggles do not shift layout.
5. Two stops produce correct km/day metrics.
6. Blocked polygon disallows crossing.
7. Road feature shortens cost/time vs baseline.
8. DM terrain export updates player view after commit.
9. Search finds “Varkas”.
10. Mobile Safari full usability.

**Out of Scope:** Multi-map, real-time collaboration, authentication, fog of war.

**Risks Recap:** Drift (solve via build generation), image path breakage (Decap media config), performance (limit dimensions, cost caching).

---

## 18. Open Questions
* Player-only build with redacted hidden regions?
* Max committed map resolution for stable mobile (target ≤ 8k).
* Icon hierarchy for city vs ruin vs special sites.

---

## 19. Future Terrain Costs (Notes)
* Potential raster classification or richer vector semantics.
* Cost grid: blocked vs forest/hill vs road bonus; extend EasyStar or custom A* allowing profile multipliers.
* Bridge/ferry semantics to allow controlled water crossings.

---

## 20. Historical Phase Checklist (Original)
_Retained for continuity; newer roadmap supersedes granular planning but status preserved._

### Phase 1: Visual Foundation & Core Structure
* [x] Establish visual theme (parchment, medieval fonts, basic layout).
* [x] Set up Eleventy project structure (`package.json`, `.eleventy.js`).
* [x] Create initial wiki & map placeholder pages.

### Phase 2: Wiki Content & DM Editor
* [x] Integrate Decap CMS for `/admin` panel.
* [x] Configure CMS collections (Locations, Characters, etc.).
* [x] Add `public: true/false` toggle for GM-only content.
* [x] Local Git backend for CMS testing.

### Phase 3: Interactive Map & DM Editor
* [x] Core Leaflet map with base image & overlays.
* [ ] In-map DM mode (`?dm=1`) for adding/editing markers.
* [ ] Terrain paint tools (difficult / blocked / road).
* [ ] Export functionality for `markers.json`, `terrain.geojson`.
* [ ] `public: true/false` toggle for map markers.

### Phase 4: Integration & Interactivity
* [ ] Wiki ↔ map integration “Show on map” (`/map?focus=<map_id>`).
* [x] A* pathfinding using terrain data.
* [ ] Route planning UI (distance, travel time).

### Phase 5: Polish & Final Features
* [ ] Automatic backlinks for wiki pages.
* [ ] Static search engine (Pagefind) for wiki.
* [ ] Final styling polish (faded borders, iconography, responsive design).

---

## 21. Changelog
* Integrated comprehensive design spec (date: 2025-09-01) merging original production plan with detailed architecture, data contracts, and roadmap.

---

End of document.

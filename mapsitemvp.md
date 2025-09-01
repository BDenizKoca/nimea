
# Big picture

* **One static site** that serves two experiences:

  * **/map** — your full-page interactive map with markers, routes, and overlays.
  * **/wiki** — a lightweight, chaptered wiki with entries for **Characters, Locations, Factions, Gods & Religions, Artifacts, Events**.
* **Single repo, static hosting** (GitHub Pages or Cloudflare Pages). No databases, no accounts.

# Tech stack

* **Eleventy (11ty)** as the static site generator for the wiki pages and global navigation.
* **Leaflet** app lives at **/map** and reads JSON files from `/data` (markers, terrain, config).
* **Shared data contract**:

  * `data/markers.json` is the source of truth for map pins.
  * Each wiki entry for a place sets `map_id` so the page can deep-link to the map.

# Information architecture

```
/map                    # interactive map UI
/wiki                   # wiki home (search + chapter links)
/wiki/locations/        # locations index (cards)
/wiki/locations/varkas/ # a location entry
/wiki/characters/...
/wiki/factions/...
/wiki/gods/...
/wiki/artifacts/...
/wiki/events/...
```

# Content model (front matter)

Each entry is a Markdown file with structured front matter. Minimal fields:

```yaml
slug: varkas
chapter: locations
name: Varkas
summary: "Başkent, yıkık bir kutsal şehrin üzerine inşa edildi."
tags: [Kuruntar, city]
images:
  - /images/varkas_1.jpg
  - /images/varkas_2.jpg
map_id: varkas            # must match markers.json
map_coords: { x: 1234, y: 987 }  # optional override
related:
  factions: [kuruntar]
  people: [skribas-seravel]
```

# Backlinks and relations

* **Auto-backlinks at build time**: during the Eleventy build, scan all entries and compile a reverse index from `slug`, `map_id`, and `related` to render a small **“Also appears in…”** panel on each page.
* **Related cards**: show `related` entries as small cards at the bottom.

# “Show on map” integration

* On any geo-tied page, render a button: **Show on map**.
* Link format: `/map?focus=varkas` where `focus` matches the marker `id`.
* The map page reads the query, pans to that marker, opens its sidebar, and highlights it.

# Markers data contract (map ↔ wiki)

In `data/markers.json`:

```json
{
  "markers": [
    {
      "id": "varkas",
      "name": "Varkas",
      "x": 1234,
      "y": 987,
      "type": "city",
      "wiki": "/wiki/locations/varkas/",
      "summary": "Başkent, yıkık bir kutsal şehrin üzerine inşa edildi.",
      "public": true
    }
  ]
}
```

* The **wiki** field ensures on-map popups can link back to the entry.
* The **map\_id** in the wiki ensures the entry can jump to the map.

# Navigation and UX

* **Wiki home**: chapter tiles + search.
* **Chapter index**: card grid filtered by tag and type.
* **Entry page**:

  * Header: title, tags, short summary.
  * **Image gallery** (lightbox).
  * Body: Markdown content.
  * Row of actions: **Show on map**, **Copy map link**, optional **Add to route** (if you want route prefill).
  * Related and backlinks sections.
* **Map page**:

  * Right sidebar shows the selected marker with name, summary, images, and **Open wiki entry**.
  * Left sidebar is your route planner.

# Search

* Static search index:

  * **Lunr.js** or **Pagefind** built at compile time.
  * Index title, summary, tags, and body.
  * Search lives on wiki home and chapter pages.

# Visual design

* Typography: clear serif for body, compact sans for UI.
* Subtle parchment backdrop for wiki, consistent with the map’s manuscript vibe.
* Iconography aligned with Nimea (spiral for Kırık, sunburst for Aevitan, mask for Vespilo).
* Mobile: single column pages, large tap targets, gallery becomes vertical.

# Editorial workflow

* Add a new entry: drop a `.md` with front matter into the right chapter folder.
* Add images to `/images/...`, reference in front matter.
* If it’s a **Location**, add or update its marker in `data/markers.json` and reuse the same `id` as `map_id`.
* Commit, push, publish. All backlinks and lists regenerate automatically.

# Optional niceties

* **Route prefill from wiki**: a “Plan trip here” button could add the location to a `route` param like `/map?route=varkas;turzak`.
* **Player vs GM visibility**: a `public: false` field in markers and wiki entries to toggle visibility in player builds later.
* **Image credit and alt text** fields in front matter for accessibility and citation.

# MVP slice for the wiki

* Chapters: **Locations, Characters, Factions, Gods**.
* Seed entries: Varkas, Turzak, Custodis, Göçyarık, Skribas Seravel, Aevitan.
* Backlinks generator, search, and **Show on map** button.
* Cards with one image and summary on chapter indexes.



-----

### **Nimea Interactive Map

  * **Summary:** A zero-backend, single-page interactive world map for Nimea. Features include layered overlays, named locations, DM-editable terrain costs, and route planning in custom units.
  * **Tech Stack:** Leaflet.js (CRS.Simple), Leaflet.Geoman, EasyStar.js, Turf.js, Vanilla JS/CSS.

-----

### **1. Vision & Core Principles 🎯**

Create a fast, elegant, full-screen map that provides reliable travel estimates based on DM-editable terrain rules.

  * **Single Artifact:** The app is built around a single map image (`map.png`).
  * **Fixed Scale:** The scale is hardcoded to **175 px = 100 km** (\~0.571 km/px).
  * **Layered Overlays:** Transparent PNGs for regions and political borders can be toggled.
  * **DM-First Editing:** A password-protected DM mode provides tools to edit all world data.
  * **Own Your Data:** All map data is stored in version-controlled JSON/GeoJSON files.
  * **Zero Backend:** The entire application is a static site, requiring no server-side processing.

-----

### **2. Core Use Cases 🗺️**

  * **Player Flow:**

    1.  Open the map and pan/zoom.
    2.  Toggle region/political overlays.
    3.  Click a location to open a right sidebar with lore and images.
    4.  Click "Add to Route." A left sidebar appears showing the route.
    5.  Add more stops. The route updates with total distance (km) and travel time estimates for **Walk (30 km/day)**, **Wagon (50 km/day)**, and **Horse (60 km/day)**.

  * **DM Flow (Desktop First):**

    1.  Access DM mode via a URL parameter (`?dm=1`) and a simple passcode.
    2.  Use the DM toolbar to **add or edit locations**, including text and images.
    3.  Use paint tools to **define terrain costs** (Roads, Difficult Terrain, Blocked Areas).
    4.  Click "Export" buttons to download the updated `markers.json` and `terrain.geojson` files.
    5.  Commit the downloaded files to the project's git repository to persist the changes.

-----

### **3. Scope & Roadmap 📋**

#### **MVP (v0.1 - Must Haves)**

  * **MVP-1: Base Map:** Full-screen Leaflet map that can be panned and zoomed.
  * **MVP-2: Overlays:** Top-right toggles for `regions.png` and `borders.png`.
  * **MVP-3: Markers:** Load markers from `markers.json` and display them on the map.
  * **MVP-4: Info Sidebar (Right):** Clicking a marker opens a sidebar with its name, summary, and image gallery.
  * **MVP-5: Route Planner (Left):** "Add to Route" button populates a multi-stop route planner.
  * **MVP-6: Pathfinding:** A\* routing calculates the shortest path respecting terrain costs.
  * **MVP-7: Travel Estimates:** The route planner displays total distance (km) and travel time for all three profiles (Walk, Wagon, Horse).
  * **MVP-8: DM Mode:** Gated by `?dm=1` and a passcode, revealing editing tools.
  * **MVP-9: DM Marker Editing:** Tools to add, move, and edit location data.
  * **MVP-10: DM Terrain Painting:** Geoman tools to draw polygons/lines for `road`, `difficult`, and `blocked` terrain.
  * **MVP-11: Data Export:** "Export" buttons to save updated marker and terrain data as local files.
  * **MVP-12: Deployment:** Deployed to a public static hosting provider (e.g., GitHub Pages).

#### **Post-MVP (v0.2+)**

  * **P-1: Route Management:** Reorder route stops via drag-and-drop; remove individual stops.
  * **P-2: Marker Filtering:** Search box and filters for marker name, type, or faction.
  * **P-3: Advanced Terrain:** Add support for bridges and ferries as low-cost corridors over blocked areas.
  * **P-4: UI Polish:** A simple legend, custom Nimea-themed map icons, and general visual improvements.

-----

### **4. Key Challenge: Performance ⚡**

**Pathfinding Grid Calculation:** Generating the pathfinding cost grid on-the-fly for a \~25 million pixel map will be too slow in the browser.
      * **Solution:** **Pre-compute the grid.** Create a separate Node.js script that reads the map dimensions and `terrain.geojson` and outputs a pre-calculated `cost_grid.json`. The web app will simply download this file on startup, ensuring a fast and responsive user experience.

-----

### **5. Data & File Structure 📂**

All data is persisted by committing exported files to the git repository.

```
/nimea-interactive-map
├── index.html
├── map.png          # Optimized map image
├── /data
│   ├── config.json
│   ├── markers.json
│   ├── terrain.geojson
│   └── cost_grid.json # Pre-computed pathfinding grid
├── /overlays
│   ├── regions.png
│   └── borders.png
└── /images
    └── ... (location images)
```

  * **`markers.json`:** An array of marker objects with properties like `id`, `name`, `x`, `y`, `summary`, `images`, etc.
  * **`terrain.geojson`:** A FeatureCollection of Polygons and LineStrings. Each feature has a `properties: {"kind": "road" | "difficult" | "blocked"}`.
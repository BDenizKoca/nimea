# Nimea Interactive Map & Wiki - Production Plan

**Last Updated:** September 1, 2025  
**Current Status:** 🟡 Wiki Complete, Map Implementation Phase

---

## 🎯 Project Overview

**Vision:** A zero-backend static site combining an interactive map with a comprehensive wiki for the fantasy realm of Nimea. Players can explore locations, plan routes, and browse lore while DMs can edit content and terrain.

**Core Architecture:**
- **Wiki:** Eleventy + Decap CMS for content management
- **Map:** Leaflet with custom coordinate system for interactive mapping
- **Data:** JSON/GeoJSON files for markers and terrain
- **Hosting:** Netlify with automatic deployment

---

## ✅ Completed Features

### Wiki System (100% Complete)
- [x] Eleventy static site generator with content collections
- [x] Decap CMS integration with Git Gateway authentication  
- [x] Content types: Characters, Locations, Nations, Gods, Magic, Player Characters
- [x] Dynamic collection pages with automatic updates
- [x] Comprehensive image system with alignment/sizing tools
- [x] Responsive medieval-themed design
- [x] Netlify deployment with automatic builds

### Development Infrastructure (100% Complete)
- [x] Clean repository structure and version control
- [x] Streamlined dependencies (Eleventy only for wiki)
- [x] Documentation (README, Images Guide)
- [x] Image workflow with custom CMS enhancements

### Map Foundation (60% Complete)
- [x] Basic Leaflet map structure in `/map/`
- [x] Fixed scale configuration (175px = 100km)
- [x] Map image and overlay file structure
- [x] Data models defined (`config.json`, `markers.json`, `terrain.geojson`)
- [ ] Functional map interactions (loading, markers, routing)

---

## 🚧 Current Development Phase: Interactive Map Implementation

### Priority 1: Core Map Functionality (Next 1-2 weeks)

**MVP-1: Basic Map Display**
- [ ] Load and display base map image (`map.png`)
- [ ] Implement pan and zoom with proper bounds
- [ ] Add overlay toggle controls (regions, borders)
- [ ] Load configuration from `data/config.json`

**MVP-2: Location System**
- [ ] Load markers from `data/markers.json`
- [ ] Display location markers on map
- [ ] Implement marker click → info sidebar
- [ ] Auto-generate markers from wiki location content

**MVP-3: Route Planning**
- [ ] "Add to Route" functionality
- [ ] Multi-stop route visualization
- [ ] Distance calculations using fixed scale
- [ ] Travel time estimates (walking 30km/day, wagon 50km/day, horse 60km/day)

**MVP-4: Basic Pathfinding**
- [ ] A* pathfinding algorithm implementation
- [ ] Terrain cost system (roads, difficult, blocked)
- [ ] Route optimization based on terrain

---

## 🎯 Milestone Roadmap

### Milestone 1: Functional Map (Target: 2 weeks)
**Deliverables:**
- Interactive map with pan/zoom
- Location markers from wiki data  
- Basic route planning with distance/time calculations
- Overlay toggles working

**Acceptance Criteria:**
- Map loads and displays correctly on desktop/mobile
- Can click locations and see information
- Can plan basic routes with travel estimates
- Overlays toggle without breaking layout

### Milestone 2: DM Tools (Target: 3-4 weeks)
**Deliverables:**
- Password-protected DM mode (`?dm=1`)
- Location editing (add/edit/delete markers)
- Terrain painting tools (roads, difficult, blocked)
- Data export functionality

**Acceptance Criteria:**
- DM can add new locations with coordinates
- Terrain editing affects pathfinding
- Changes can be exported and committed to repo

### Milestone 3: Integration & Polish (Target: 5-6 weeks)
**Deliverables:**
- Wiki ↔ map deep linking
- Search and filtering
- Mobile optimization
- Performance improvements

**Acceptance Criteria:**
- "Show on Map" buttons work from wiki pages
- URL parameters support (`/map?focus=location-id`)
- Mobile experience is fully functional
- Performance is acceptable on various devices

---

## 🏗️ Technical Architecture

### Data Model

**Fixed Scale:** 175px = 100km (`kmPerPixel = 0.5714285714`)

**File Structure:**
```
/map/               # Interactive map application
├── index.html      # Main map interface
├── map.js          # Map functionality (TO IMPLEMENT)
├── style.css       # Map-specific styles
└── map.png         # Base map image

/data/              # Shared data files
├── config.json     # Map configuration
├── markers.json    # Generated from wiki locations
└── terrain.geojson # DM-created terrain data

/overlays/          # Map overlay images
├── regions.png     # Regional boundaries  
└── borders.png     # Political borders
```

**Markers Data Model (`data/markers.json`):**
```json
{
  "markers": [
    {
      "id": "varkas",
      "name": "Varkas", 
      "x": 1234,
      "y": 987,
      "type": "city",
      "faction": "Kuruntar",
      "summary": "Capital city built on ancient ruins",
      "images": ["/images/varkas_1.jpg"],
      "public": true
    }
  ]
}
```

**Terrain Data Model (`data/terrain.geojson`):**
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {"kind": "road"},
      "geometry": {"type": "LineString", "coordinates": [[100,900],[400,900]]}
    },
    {
      "type": "Feature", 
      "properties": {"kind": "blocked"},
      "geometry": {"type": "Polygon", "coordinates": [[[200,200],[500,200],[500,500],[200,500],[200,200]]]}
    }
  ]
}
```

### Dependencies to Add
- **Leaflet.js** - Interactive mapping
- **Leaflet.Geoman** - Drawing tools for DM mode  
- **EasyStar.js** - A* pathfinding algorithm
- **Turf.js** - Spatial calculations

### Pathfinding Design
- **Grid:** 24px cells (tunable 24-48px)
- **Costs:** road=0.5x, normal=1.0x, difficult=3.0x, blocked=impossible
- **Output:** Distance in km, travel time by profile

---

## 🚀 Success Criteria

The project will be considered MVP-complete when:

- [ ] Interactive map loads and displays all wiki locations
- [ ] Users can plan multi-stop routes with accurate travel times
- [ ] DMs can edit locations and terrain through the interface
- [ ] All data stays synchronized between wiki and map
- [ ] System works seamlessly on desktop and mobile
- [ ] Public deployment is stable and performant

---

## ⚠️ Known Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Map image performance on mobile | High | Keep ≤8k pixels, use WebP format |
| Complex pathfinding slow on large grids | Medium | Tune cell size, cache grid, consider Web Worker |
| Data drift between wiki and map | High | Always generate markers.json in build process |
| DM editing security | Low | Accept passcode-only security for MVP |

---

## 📋 Development Priorities

### **Next Sprint (Week 1-2):**
1. **Implement basic map functionality** - Load map.png, pan/zoom, overlays
2. **Add location markers** - Load from markers.json, display with popups  
3. **Basic route planning** - Add stops, show distance/time
4. **Auto-generate markers** - From wiki location entries

### **Following Sprint (Week 3-4):**
1. **Implement pathfinding** - A* algorithm with terrain costs
2. **DM mode basics** - Authentication, marker editing
3. **Terrain editing** - Drawing tools for roads/blocked areas
4. **Data export** - Save changes back to repository

### **Final Sprint (Week 5-6):**
1. **Wiki integration** - Deep linking, "Show on Map" buttons
2. **Mobile optimization** - Touch controls, responsive layout
3. **Performance** - Optimize for various devices
4. **Polish** - Icons, animations, error handling

---

## 📝 Implementation Notes

- **Start with map.js implementation** - Currently empty, needs core functionality
- **Use existing data structure** - Config.json and markers.json already defined
- **Leverage wiki content** - Auto-generate markers from location entries
- **Focus on user experience** - Prioritize smooth interactions over complex features
- **Test early and often** - Validate on mobile devices throughout development

---

## 🔄 Development Workflow

1. **Feature Development:** Create branch → implement → test → review
2. **Data Changes:** Update via wiki CMS → auto-generate markers.json  
3. **Terrain Changes:** Edit in DM mode → export → commit to repository
4. **Deployment:** Automatic via Netlify on push to main branch

---

**Note:** This plan reflects the current reality and provides a clear path forward. The wiki system is complete and functional. The focus now is entirely on implementing the interactive map functionality.
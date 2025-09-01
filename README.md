# Nimea Wiki & Interactive Map

A zero-backend wiki and interactive map for the fantasy realm of Nimea. Built with Eleventy, Decap CMS, and Leaflet.js.

🌐 **Live Site**: https://nimea-wiki.netlify.app/

## Features

### Wiki
- **Content Management**: Edit content through a user-friendly CMS interface
- **Multiple Categories**: Characters, Locations, Nations & Factions, Gods & Religions, Magic & Powers
- **Rich Images**: Cover images, portrait images, and inline images with custom styling
- **Responsive Design**: Works on desktop and mobile devices

### Interactive Map
- **Full-screen map** with pan and zoom
- **Layered overlays** for regions and political borders
- **Location markers** with detailed information
- **Route planning** (player mode) with distance & travel time summaries (direct-distance simplified)
- **DM Editing Mode** (?dm) for batch world edits (markers & terrain) with explicit publish/export controls
- **Terrain system**: road (fast), river (slow), difficult (slow), ocean + blocked (impassable)
- **A* pathfinding scaffold** prepared for future activated use (grid respects terrain costs)
- **Wiki integration**: auto-links to relevant pages; optional custom wiki slug per marker

## Getting Started

### For Content Editors

1. Visit https://nimea-wiki.netlify.app/admin/
2. Login with your GitHub account
3. Create and edit wiki content through the visual interface
4. Images are automatically uploaded and managed

### For Developers

```bash
# Clone the repository
git clone https://github.com/BDenizKoca/nimea.git
cd nimea

# Install dependencies
npm install

# Start development server
npm start

# Build for production
npm run build
```

## Architecture

- **Eleventy**: Static site generator for the wiki
- **Decap CMS**: Content management system with Git Gateway
- **Leaflet.js**: Interactive mapping with custom coordinate system
- **Leaflet-Geoman**: Drawing & editing tools for DM mode
- **Netlify**: Hosting and deployment with automatic builds
- **Netlify Identity + Git Gateway**: Auth + direct commits for live CMS / map data publishing
  
### Modes

| Aspect            | Player Mode (default) | DM Mode (?dm) |
|-------------------|-----------------------|---------------|
| Routing UI        | Visible                | Hidden        |
| Editing Controls  | Disabled               | Enabled (draw, edit, delete) |
| Auto Saving       | N/A (read-only)        | No (batch dirty tracking) |
| Publish Workflow  | N/A                    | Manual Export / Authenticated Publish |
| Wiki Slug Field   | Hidden                 | Visible in marker form |

### Terrain Kinds & Costs

| Kind      | Cost Multiplier | Notes                                     |
|-----------|-----------------|-------------------------------------------|
| road      | 0.5x            | Overrides other non-blocked terrain       |
| river     | 3x              | Treated as difficult (dashed blue line)   |
| difficult | 3x              | Hindering terrain                         |
| ocean     | Impassable      | Filled deep blue                          |
| blocked   | Impassable      | Red, used for walls/cliffs/etc            |

Pathfinding grid precedence: (1) impassable (ocean/blocked) → (2) road → (3) river/difficult → (4) normal.

### DM Publish Workflow

1. Open map with `?dm` query (e.g. `/map/?dm`).
2. Login (👤) to enable live publishing, or stay offline and use export.
3. Draw markers / terrain. Each change sets a dirty flag (UNSAVED badge shown).
4. Click 💾 to download `markers.json` / `terrain.geojson` locally (offline backup).
5. Click ⬆️ (when authenticated) to commit changes & trigger Netlify rebuild.

### Wiki Slug Override

In DM marker creation form you can specify an optional Wiki Slug. If present, the info panel link targets `/wiki/<slug>/`. If omitted, the system infers a location page for settlement/landmark types.

## File Structure

```
/
├── wiki/              # Wiki content (markdown files)
├── map/               # Interactive map application
├── admin/             # CMS configuration
├── images/            # Uploaded media files
├── css/               # Stylesheets
├── data/              # Map data (markers, terrain)
├── _includes/         # Eleventy templates
└── netlify.toml       # Deployment configuration
```

## Deployment

The site automatically deploys to Netlify when changes are pushed to the main branch. No manual deployment needed.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test locally with `npm start`
5. Submit a pull request

## License

MIT License - see LICENSE file for details.
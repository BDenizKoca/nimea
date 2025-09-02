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
- **Terrain system**: `road` (fast travel), `difficult` (slow travel), and `unpassable` (blocks travel).
- **A* pathfinding** that respects the terrain costs for accurate travel time calculation.
- **Wiki integration**: auto-links to relevant pages; optional custom wiki slug per marker

## Getting Started

### For Content Editors

1. Visit https://nimea-wiki.netlify.app/admin/
2. Login with your GitHub account
3. Create and edit wiki content through the visual interface.
4. To edit the map, go to `https://nimea-wiki.netlify.app/map/?dm` and login.

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

- **Eleventy**: Static site generator for the wiki.
- **Decap CMS**: Content management system with Git Gateway.
- **Leaflet.js**: Interactive mapping with a custom coordinate system.
- **Leaflet-Geoman**: Drawing & editing tools for DM mode.
- **Netlify**: Hosting and deployment with automatic builds.
- **Netlify Identity + Git Gateway**: Authentication and direct Git commits for live CMS and map data publishing.
  
### Modes

| Aspect            | Player Mode (default) | DM Mode (`?dm`) |
|-------------------|-----------------------|---------------|
| Routing UI        | Visible                | Hidden        |
| Editing Controls  | Disabled               | Enabled (draw, edit, delete) |
| Terrain/Overlays  | Hidden                 | Visible & Editable |
| Publish Workflow  | N/A                    | Manual Export / Authenticated Publish |

### Terrain Kinds & Costs

The pathfinding system uses a grid that respects the following terrain types, which can be painted in DM mode.

| Kind       | Cost Multiplier | Notes                                     |
|------------|-----------------|-------------------------------------------|
| `road`       | 0.5x            | Speeds up travel. Represented by lines.   |
| `difficult`  | 3x              | Slows down travel. Represented by polygons. |
| `unpassable` | Impassable      | Blocks travel completely. Represented by polygons. |

### DM Publish Workflow

1. Open the map with the `?dm` query parameter (e.g., `/map/?dm`).
2. Login via the `👤` button to enable live publishing to the repository.
3. Use the Geoman toolbar to draw markers or the custom terrain tools to paint terrain.
4. Each change sets a "dirty" flag, indicated by an "UNSAVED" badge.
5. Click `💾` to download `markers.json` and `terrain.geojson` locally as a backup.
6. Click `⬆️` (when authenticated) to commit your changes directly to the repository and trigger a site rebuild.

### Wiki Slug Override

In the DM marker creation form, you can specify an optional "Wiki Slug". If present, the info panel link will target `/wiki/<slug>/`. If omitted, the system infers a location page for settlement/landmark types.

## File Structure

```
/
├── wiki/              # Wiki content (markdown files)
├── map/               # Interactive map application
│   ├── js/            # Modularized JavaScript files (routing, UI, DM, etc.)
│   └── data/          # Default map data (markers.json, terrain.geojson)
├── admin/             # CMS configuration
├── images/            # Uploaded media files
├── css/               # Stylesheets
├── _data/             # Eleventy data files
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
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
- **Route planning** with distance and travel time calculations
- **A* pathfinding** that respects terrain costs

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
- **Netlify**: Hosting and deployment with automatic builds

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
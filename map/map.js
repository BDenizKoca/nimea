document.addEventListener('DOMContentLoaded', () => {
    const mapElement = document.getElementById('map');
    if (!mapElement) {
        console.error("Map container #map not found.");
        return;
    }

    // --- CONFIG & STATE ---
    const config = {
        kmPerPixel: 100 / 115, // 0.8695652174 (115 pixels = 100 km)
        profiles: {
            walk: { speed: 30, cost: 1.0 },
            wagon: { speed: 50, cost: 0.8 },
            horse: { speed: 60, cost: 0.7 },
        },
    };

    const state = {
        isDmMode: new URLSearchParams(window.location.search).has('dm'),
        focusMarker: new URLSearchParams(window.location.search).get('focus'),
        markers: [],
        terrain: { type: 'FeatureCollection', features: [] },
        route: [],
        routeLegs: [],
        routePolylines: [],
        overlays: {},
        isLiveCMS: false, // Will be set to true when authenticated for live saving
        routePolyline: null, // active rendered route
        dirty: { markers: false, terrain: false }, // track unsaved edits in DM session
    };

    // --- Global Bridge ---
    // Modules will attach themselves to this bridge.
    window.__nimea = {
        config,
        state,
        // map instance, modules, and functions will be attached here
    };

    // --- MAP INITIALIZATION ---
    const map = L.map('map', {
        crs: L.CRS.Simple,
        minZoom: -2,
        maxZoom: 4,          // Allow more zoom levels
        zoomControl: false,
        attributionControl: false,
    });
    window.__nimea.map = map; // Make map instance available on the bridge

    // Create a dedicated pane for route so it stays above overlays & terrain
    if (!map.getPane('routePane')) {
        const routePane = map.createPane('routePane');
        routePane.style.zIndex = 650; // Above overlays (default 400-600 range) but below markers (700)
    }

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Store the original map bounds for overlays
    let originalMapBounds = null;

    // --- LOAD MAP IMAGE & DATA ---
    const mapImageUrl = 'map.webp';
    const img = new Image();
    img.onload = () => {
        const { width, height } = img;
        const bounds = [[0, 0], [height, width]];
        originalMapBounds = bounds; // Store the original bounds
        L.imageOverlay(mapImageUrl, bounds).addTo(map);
        
        // Use setView with a higher zoom level to fill the screen better
        const centerY = height / 2;
        const centerX = width / 2;
        
        // Adjust initial zoom based on screen width
        const isMobile = window.innerWidth <= 700;
        const initialZoom = isMobile ? -0.5 : 0.5; // Zoom out more on mobile
        
        map.setView([centerY, centerX], initialZoom);
        
        loadInitialData();
    };
    img.onerror = () => console.error("Failed to load map image.");
    img.src = mapImageUrl;

    async function loadInitialData() {
        try {
            // Load markers
            let markersData = { markers: [] };
            try {
                const markersRes = await fetch('data/markers.json');
                if (markersRes.ok) {
                    markersData = await markersRes.json();
                }
            } catch (error) {
                console.warn('Could not load markers.json, using empty array');
            }

            // Load terrain
            let terrainData = { type: 'FeatureCollection', features: [] };
            try {
                const terrainRes = await fetch('data/terrain.geojson');
                if (terrainRes.ok) {
                    terrainData = await terrainRes.json();
                }
            } catch (error) {
                console.warn('Could not load terrain.geojson, using empty features');
            }

            // Load config
            let remoteConfig = {};
            try {
                const configRes = await fetch('data/config.json');
                if (configRes.ok) {
                    remoteConfig = await configRes.json();
                }
            } catch (error) {
                console.warn('Could not load config.json, using defaults');
            }

            Object.assign(config, remoteConfig);
            state.markers = markersData.markers || [];
            state.terrain = terrainData;

            // --- Data Migration ---
            // Ensure all terrain features have a unique internal ID for editing.
            if (state.isDmMode && state.terrain && state.terrain.features) {
                let migrationMade = false;
                state.terrain.features.forEach((feature, index) => {
                    if (!feature.properties) {
                        feature.properties = {};
                    }
                    if (!feature.properties._internal_id) {
                        feature.properties._internal_id = `terrain_${Date.now()}_${index}`;
                        migrationMade = true;
                    }
                });
                if (migrationMade) {
                    console.log('Performed one-time migration for terrain feature IDs.');
                    markDirty('terrain');
                    // The "UNSAVED" badge will appear, prompting the user to save the migrated IDs.
                }
            }

            console.log('Loaded data:', {
                markers: state.markers.length,
                terrain: state.terrain.features.length,
                config: remoteConfig
            });

            // Initialize modules
            if (window.__nimea_routing_init) window.__nimea_routing_init(window.__nimea);
            if (window.__nimea_dm_init) window.__nimea_dm_init(window.__nimea);
            if (window.__nimea_ui_init) window.__nimea_ui_init(window.__nimea);
            if (window.__nimea_markers_init) window.__nimea_markers_init(window.__nimea);
            if (window.__nimea_terrain_init) window.__nimea_terrain_init(window.__nimea);

            // Add necessary functions to the bridge for modules to use
            window.__nimea.generateWikiLink = generateWikiLink;
            window.__nimea.generateIdFromName = generateIdFromName;
            window.__nimea.openInfoSidebar = openInfoSidebar;
            window.__nimea.markDirty = markDirty;

            // Initial render calls
            if (window.__nimea.markersModule) {
                window.__nimea.markersModule.renderMarkers();
            }
            // Terrain is now handled by its own module and only rendered in DM mode
            setupOverlays();
            await setupDmMode();

            // Hide route UI in DM mode
            if (state.isDmMode) {
                const routeSidebar = document.getElementById('route-sidebar');
                if (routeSidebar) {
                    routeSidebar.style.display = 'none';
                }
            }

        } catch (error) {
            console.error("Error loading initial data:", error);
        }
    }

    // --- Core Functions ---
    function markDirty(type) {
        if (state.isDmMode) {
            state.dirty[type] = true;
            const publishButton = document.getElementById('publish-button');
            if (publishButton) {
                publishButton.classList.add('dirty');
            }
        }
    }

    function generateWikiLink(markerData) {
        // 1. Explicit slug override
        if (markerData.wikiSlug) {
            return `/wiki/${markerData.wikiSlug.replace(/^\/wiki\//,'').replace(/\/+/g,'/')}/`;
        }
        // 2. Infer by type (extendable)
        if (markerData.type && ['city','town','village','fortress','ruin','landmark','dungeon'].includes(markerData.type)) {
            return `/wiki/locations-regions/${markerData.id}/`;
        }
        return null;
    }

    function generateIdFromName(name) {
        if (!name) return '';
        return name.toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
    }

    // --- Module Delegations ---
    function renderMarkers() {
        if (window.__nimea.markersModule) {
            window.__nimea.markersModule.renderMarkers();
        } else {
            console.error("Markers module not initialized.");
        }
    }

    // --- SIDEBARS (delegated to uiModule) ---
    function openInfoSidebar(data) {
        if (window.__nimea.uiModule) {
            window.__nimea.uiModule.openInfoSidebar(data);
        } else {
            console.error("UI module not initialized.");
        }
    }

    function addToRoute(marker) {
        if (window.__nimea.routingModule) {
            window.__nimea.routingModule.addToRoute(marker);
        } else {
            console.error("Routing module not initialized.");
        }
    }

    async function setupDmMode() {
        if (window.__nimea.dmModule) {
            await window.__nimea.dmModule.setupDmMode();
        } else {
            console.error("DM module not initialized.");
        }
    }

    // --- Setup Functions ---
    function setupOverlays() {
        console.log('Setting up overlays:', config.overlays, 'bounds:', originalMapBounds);
        if (config.overlays && originalMapBounds) {
            if (config.overlays.regions) {
                console.log('Adding regions overlay:', config.overlays.regions);
                const regionsPath = `../${config.overlays.regions}`;
                console.log('Regions overlay path:', regionsPath);
                state.overlays.regions = L.imageOverlay(regionsPath, originalMapBounds, { opacity: 0.7 });
            }
            if (config.overlays.borders) {
                console.log('Adding borders overlay:', config.overlays.borders);
                const bordersPath = `../${config.overlays.borders}`;
                console.log('Borders overlay path:', bordersPath);
                state.overlays.borders = L.imageOverlay(bordersPath, originalMapBounds, { opacity: 0.8 });
            }
        }
        // Apply current mode (default none) after overlays are created
        if (window.__nimea.uiModule) {
            window.__nimea.uiModule.applyOverlayMode(state.currentOverlayMode || 'none');
        }
    }
});
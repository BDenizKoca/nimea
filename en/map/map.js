document.addEventListener('DOMContentLoaded', () => {
    const mapElement = document.getElementById('map');
    if (!mapElement) {
        console.error("Map container #map not found.");
        return;
    }

    // --- CONFIG & STATE ---
    const config = {
        kmPerPixel: 50 / 115, // 0.4347826087 (115 pixels = 50 km)
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
        minZoom: -3,         // Allow more zoom out for very wide screens
        maxZoom: 4,          // Allow more zoom levels
        zoomControl: false,
        attributionControl: false,
        tap: false           // Disable Leaflet's built-in tap handler which can be problematic
    });
    window.__nimea.map = map; // Make map instance available on the bridge
    
    // Add meta viewport check to force iOS to work properly
    if (!document.querySelector('meta[name="viewport"]')) {
        console.warn("No viewport meta tag found, adding one for proper mobile touch handling");
        const meta = document.createElement('meta');
        meta.name = 'viewport';
        meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
        document.head.appendChild(meta);
    }

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
        
        // Use fitBounds to show the entire map initially, with different padding for mobile vs desktop
        const isMobile = window.innerWidth <= 700;
        const padding = isMobile ? [20, 20] : [50, 50]; // Less padding on mobile for more map visibility
        
        map.fitBounds(bounds, { 
            padding: padding,
            maxZoom: isMobile ? 1 : 2 // Limit max zoom on initial fit
        });

        // Add right-click context menu for waypoint creation - streamlined with no double confirmation
        map.on('contextmenu', (e) => {
            if (!window.__nimea.state.isDmMode && window.__nimea.routingModule) {
                const { lat, lng } = e.latlng;
                // Single confirmation - create waypoint and add to route automatically
                if (confirm('Create waypoint and add to route?')) {
                    const waypoint = window.__nimea.routingModule.createWaypoint(lat, lng);
                    if (waypoint) {
                        window.__nimea.routingModule.addToRoute(waypoint);
                    }
                }
            }
        });
        
        // Add window resize handler to adjust zoom for orientation changes on mobile
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                const newIsMobile = window.innerWidth <= 700;
                const newPadding = newIsMobile ? [20, 20] : [50, 50];
                map.fitBounds(bounds, { 
                    padding: newPadding,
                    maxZoom: newIsMobile ? 1 : 2
                });
            }, 250); // Debounce resize events
        });
        
        loadInitialData();
    };
    img.onerror = () => console.error("Failed to load map image.");
    img.src = mapImageUrl;

    async function loadInitialData() {
        try {
            // Load markers from single source of truth (TR dataset)
            let markersData = { markers: [] };
            try {
                const markersRes = await fetch('/map/data/markers.json');
                if (markersRes.ok) {
                    markersData = await markersRes.json();
                }
            } catch (error) {
                console.warn('Could not load markers.json, using empty array');
            }

            // Load terrain from unified source
            let terrainData = { type: 'FeatureCollection', features: [] };
            try {
                const terrainRes = await fetch('/map/data/terrain.geojson');
                if (terrainRes.ok) {
                    terrainData = await terrainRes.json();
                }
            } catch (error) {
                console.warn('Could not load terrain.geojson, using empty features');
            }

            // Load config from unified source
            let remoteConfig = {};
            try {
                const configRes = await fetch('/map/data/config.json');
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
            if (window.__nimea_route_share) {
                window.__nimea_route_share.initRouteShare(window.__nimea);
            }
            if (window.__nimea_dm_init) window.__nimea_dm_init(window.__nimea);
            if (window.__nimea_ui_init) window.__nimea_ui_init(window.__nimea);
            if (window.__nimea_direct_touch_init) window.__nimea_direct_touch_init(window.__nimea);
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
            // Also refresh DM publish UI control if present
            try {
                if (window.__nimea && window.__nimea.dmModule && window.DmControls) {
                    const btn = document.getElementById('dm-publish-json');
                    if (btn && window.__nimea.dmModule && window.__nimea.dmModule.setupDmMode) {
                        // Use UI module or dmControls if available
                        if (window.__nimea.uiModule && window.__nimea.uiModule.updatePublishUI) {
                            window.__nimea.uiModule.updatePublishUI();
                        }
                        // Fallback: manual style change
                        btn.classList.add('dirty-ready');
                    }
                }
            } catch (e) {
                console.warn('Could not update publish UI after dirty change', e);
            }
        }
    }

    function generateWikiLink(markerData) {
        // Detect if we're in English version
        const isEnglish = window.location.pathname.startsWith('/en');
        const baseWikiPath = isEnglish ? '/en/wiki' : '/wiki';
        
        // 1. Explicit slug override
        if (markerData.wikiSlug) {
            // Check if it's already a full path
            if (markerData.wikiSlug.includes('/')) {
                return `${baseWikiPath}/${markerData.wikiSlug.replace(/^\/wiki\//,'').replace(/\/+/g,'/')}/`;
            }
            // Otherwise, infer the correct category based on type
            if (markerData.type && ['city','town','village','fortress','ruin','landmark','dungeon'].includes(markerData.type)) {
                return `${baseWikiPath}/locations-regions/${markerData.wikiSlug}/`;
            }
            // For character types, use characters folder
            if (markerData.type === 'character') {
                return `${baseWikiPath}/characters/${markerData.wikiSlug}/`;
            }
            // Default fallback
            return `${baseWikiPath}/${markerData.wikiSlug}/`;
        }
        // 2. Infer by type (extendable)
        if (markerData.type && ['city','town','village','fortress','ruin','landmark','dungeon'].includes(markerData.type)) {
            return `${baseWikiPath}/locations-regions/${markerData.id}/`;
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
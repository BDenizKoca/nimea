document.addEventListener('DOMContentLoaded', () => {
    const mapElement = document.getElementById('map');
    if (!mapElement) {
        console.error("Map container #map not found.");
        return;
    }

    // --- CONFIG & STATE ---
    const config = {
        kmPerPixel: 100 / 175, // 0.5714285714
        profiles: {
            walk: { speed: 30, cost: 1.0 },
            wagon: { speed: 50, cost: 0.8 },
            horse: { speed: 60, cost: 0.7 },
        },
        terrainCosts: {
            normal: 1,
            road: 0.5,
            difficult: 3,
            blocked: Infinity,
        },
        gridCellSize: 24, // in pixels
    };

    const state = {
        isDmMode: new URLSearchParams(window.location.search).has('dm'),
        focusMarker: new URLSearchParams(window.location.search).get('focus'),
        markers: [],
        terrain: { type: 'FeatureCollection', features: [] },
        route: [],
        overlays: {},
        isLiveCMS: false, // Will be set to true when authenticated for live saving
    };

    // --- UI ELEMENTS ---
    const routeSidebar = document.getElementById('route-sidebar');
    const infoSidebar = document.getElementById('info-sidebar');
    const closeInfoSidebarBtn = document.getElementById('close-info-sidebar');
    const toggleRegions = document.getElementById('toggle-regions');
    const toggleBorders = document.getElementById('toggle-borders');

    // --- MAP INITIALIZATION ---
    const map = L.map('map', {
        crs: L.CRS.Simple,
        minZoom: -2,
        maxZoom: 2,
        zoomControl: false,
        attributionControl: false,
    });

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
        map.fitBounds(bounds);
        loadInitialData();
    };
    img.onerror = () => console.error("Failed to load map image.");
    img.src = mapImageUrl;

    async function loadInitialData() {
        try {
            // Load markers
            let markersData = { markers: [] };
            try {
                const markersRes = await fetch('../data/markers.json');
                if (markersRes.ok) {
                    markersData = await markersRes.json();
                }
            } catch (error) {
                console.warn('Could not load markers.json, using empty array');
            }

            // Load terrain
            let terrainData = { type: 'FeatureCollection', features: [] };
            try {
                const terrainRes = await fetch('../data/terrain.geojson');
                if (terrainRes.ok) {
                    terrainData = await terrainRes.json();
                }
            } catch (error) {
                console.warn('Could not load terrain.geojson, using empty features');
            }

            // Load config
            let remoteConfig = {};
            try {
                const configRes = await fetch('../data/config.json');
                if (configRes.ok) {
                    remoteConfig = await configRes.json();
                }
            } catch (error) {
                console.warn('Could not load config.json, using defaults');
            }

            Object.assign(config, remoteConfig);
            state.markers = markersData.markers || [];
            state.terrain = terrainData;

            console.log('Loaded data:', {
                markers: state.markers.length,
                terrain: state.terrain.features.length,
                config: remoteConfig
            });

            renderMarkers();
            setupOverlays();
            setupDmMode();

        } catch (error) {
            console.error("Error loading initial data:", error);
        }
    }

    // --- MARKERS ---
    function renderMarkers() {
        console.log('Rendering markers:', state.markers.length);
        let focusMarker = null;
        
        state.markers.forEach((markerData, index) => {
            console.log(`Marker ${index}:`, markerData);
            if (markerData.public || state.isDmMode) {
                console.log(`Adding marker: ${markerData.name} at [${markerData.y}, ${markerData.x}]`);
                const marker = L.marker([markerData.y, markerData.x]).addTo(map);
                marker.on('click', () => openInfoSidebar(markerData));
                
                // Check if this is the marker we should focus on
                if (state.focusMarker && markerData.id === state.focusMarker) {
                    focusMarker = { marker, data: markerData };
                }
            } else {
                console.log(`Skipping private marker: ${markerData.name}`);
            }
        });
        
        // Focus on specific marker if requested
        if (focusMarker) {
            map.setView([focusMarker.data.y, focusMarker.data.x], 3);
            setTimeout(() => {
                openInfoSidebar(focusMarker.data);
            }, 500);
        }
    }

    // --- SIDEBARS ---
    function openInfoSidebar(data) {
        const wikiLink = generateWikiLink(data);
        const content = `
            <h2>${data.name}</h2>
            <p>${data.summary}</p>
            ${data.type ? `<p><strong>Type:</strong> ${data.type}</p>` : ''}
            ${data.faction ? `<p><strong>Faction:</strong> ${data.faction}</p>` : ''}
            ${data.images && data.images.length > 0 ? data.images.map(img => `<img src="../${img}" alt="${data.name}" style="width:100%;">`).join('') : ''}
            ${wikiLink ? `<a href="${wikiLink}" class="wiki-link" target="_blank">📚 View in Wiki</a>` : ''}
            <button class="add-to-route" data-id="${data.id}">Add to Route</button>
        `;
        document.getElementById('info-content').innerHTML = content;
        infoSidebar.classList.add('open');

        document.querySelector('.add-to-route').addEventListener('click', (e) => {
            const markerId = e.target.dataset.id;
            const marker = state.markers.find(m => m.id === markerId);
            if (marker) {
                addToRoute(marker);
            }
        });
    }
    
    function generateWikiLink(markerData) {
        // Try to find matching wiki page based on marker ID or name
        const possiblePaths = [
            `/wiki/locations-regions/${markerData.id}/`,
            `/wiki/characters/${markerData.id}/`,
            `/wiki/nations-factions/${markerData.id}/`,
        ];
        
        // For now, assume locations-regions for map markers
        // TODO: This could be enhanced to actually check if pages exist
        if (markerData.type && ['city', 'town', 'village', 'fortress', 'ruin', 'landmark'].includes(markerData.type)) {
            return `/wiki/locations-regions/${markerData.id}/`;
        }
        
        return null;
    }

    closeInfoSidebarBtn.addEventListener('click', () => infoSidebar.classList.remove('open'));

    // --- OVERLAYS ---
    function setupOverlays() {
        console.log('Setting up overlays:', config.overlays, 'bounds:', originalMapBounds);
        if (config.overlays && originalMapBounds) {
            // Use the original map bounds for overlays to ensure proper sizing
            if (config.overlays.regions) {
                console.log('Adding regions overlay:', config.overlays.regions);
                state.overlays.regions = L.imageOverlay(`../${config.overlays.regions}`, originalMapBounds, { opacity: 0.7 }).addTo(map);
                toggleRegions.checked = true;
            }
            if (config.overlays.borders) {
                console.log('Adding borders overlay:', config.overlays.borders);
                state.overlays.borders = L.imageOverlay(`../${config.overlays.borders}`, originalMapBounds, { opacity: 0.8 }).addTo(map);
                toggleBorders.checked = true;
            }
        }

        toggleRegions.addEventListener('change', (e) => {
            if (state.overlays.regions) {
                if (e.target.checked) {
                    map.addLayer(state.overlays.regions);
                } else {
                    map.removeLayer(state.overlays.regions);
                }
            }
        });
        toggleBorders.addEventListener('change', (e) => {
             if (state.overlays.borders) {
                if (e.target.checked) {
                    map.addLayer(state.overlays.borders);
                } else {
                    map.removeLayer(state.overlays.borders);
                }
            }
        });
    }


    // --- ROUTE PLANNING ---
    function addToRoute(marker) {
        state.route.push(marker);
        routeSidebar.classList.add('open');
        updateRouteDisplay();
        if (state.route.length > 1) {
            calculateAndDisplayPath();
        }
    }

    function updateRouteDisplay() {
        const stopsDiv = document.getElementById('route-stops');
        stopsDiv.innerHTML = state.route.map(stop => `<div>${stop.name}</div>`).join('');
    }

    // --- PATHFINDING (A*) ---
    let pathfindingGrid = null;
    let easystar = new EasyStar.js();

    function buildPathfindingGrid() {
        const bounds = map.getBounds();
        const mapWidth = bounds.getEast();
        const mapHeight = bounds.getSouth();

        const cols = Math.floor(mapWidth / config.gridCellSize);
        const rows = Math.floor(mapHeight / config.gridCellSize);

        console.log(`Building ${cols}x${rows} grid...`);

        const grid = Array(rows).fill(null).map(() => Array(cols).fill(config.terrainCosts.normal));

        const blockedFeatures = state.terrain.features.filter(f => f.properties.kind === 'blocked');
        const difficultFeatures = state.terrain.features.filter(f => f.properties.kind === 'difficult');
        const roadFeatures = state.terrain.features.filter(f => f.properties.kind === 'road');

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const [worldY, worldX] = gridToWorldCoords(c, r);
                const point = turf.point([worldX, worldY]);
                let cost = config.terrainCosts.normal;
                let isBlocked = false;

                // Check for blocked polygons
                for (const feature of blockedFeatures) {
                    if (feature.geometry.type === 'Polygon' && turf.booleanPointInPolygon(point, feature)) {
                        isBlocked = true;
                        break;
                    }
                }

                if (isBlocked) {
                    grid[r][c] = Infinity; // Using Infinity for blocked
                    continue;
                }

                // Check for roads (LineString)
                let onRoad = false;
                for (const feature of roadFeatures) {
                    // Use a buffer to make roads easier to snap to
                    const distance = turf.pointToLineDistance(point, feature, { units: 'pixels' });
                    if (distance < config.gridCellSize / 2) {
                        cost = config.terrainCosts.road;
                        onRoad = true;
                        break;
                    }
                }
                if (onRoad) {
                    grid[r][c] = cost;
                    continue;
                }

                // Check for difficult terrain (Polygon or LineString buffer)
                for (const feature of difficultFeatures) {
                     if (feature.geometry.type === 'Polygon' && turf.booleanPointInPolygon(point, feature)) {
                        cost = config.terrainCosts.difficult;
                        break;
                    } else if (feature.geometry.type === 'LineString') {
                        const distance = turf.pointToLineDistance(point, feature, { units: 'pixels' });
                        if (distance < config.gridCellSize) { // Larger buffer for difficult terrain lines
                             cost = config.terrainCosts.difficult;
                             break;
                        }
                    }
                }
                 grid[r][c] = cost;
            }
        }

        console.log("Grid build complete.");
        easystar.setGrid(grid);
        const acceptableTiles = [config.terrainCosts.normal, config.terrainCosts.road, config.terrainCosts.difficult];
        easystar.setAcceptableTiles(acceptableTiles);
        easystar.setTileCost(config.terrainCosts.road, 0.5);
        easystar.setTileCost(config.terrainCosts.difficult, 3);
        easystar.enableDiagonals();
        easystar.disableCornerCutting();


        pathfindingGrid = { cols, rows, width: mapWidth, height: mapHeight };
    }


    function calculateAndDisplayPath() {
        if (!pathfindingGrid) {
            buildPathfindingGrid();
        }

        const start = state.route[state.route.length - 2];
        const end = state.route[state.route.length - 1];

        const startCell = worldToGridCoords(start.x, start.y);
        const endCell = worldToGridCoords(end.x, end.y);

        easystar.findPath(startCell.x, startCell.y, endCell.x, endCell.y, (path) => {
            if (path) {
                const pixelPath = path.map(p => gridToWorldCoords(p.x, p.y));
                const polyline = L.polyline(pixelPath, { color: 'red' }).addTo(map);
                map.fitBounds(polyline.getBounds());
                updateRouteSummary(pixelPath);
            } else {
                console.log("No path found.");
            }
        });
        easystar.calculate();
    }
    
    function worldToGridCoords(x, y) {
        return {
            x: Math.floor(x / config.gridCellSize),
            y: Math.floor(y / config.gridCellSize)
        };
    }

    function gridToWorldCoords(x, y) {
        return [
            y * config.gridCellSize + config.gridCellSize / 2,
            x * config.gridCellSize + config.gridCellSize / 2
        ];
    }


    function updateRouteSummary(pixelPath) {
        let totalDistancePx = 0;
        for (let i = 1; i < pixelPath.length; i++) {
            totalDistancePx += map.distance(pixelPath[i-1], pixelPath[i]);
        }
        const totalKm = totalDistancePx * config.kmPerPixel;

        const summaryDiv = document.getElementById('route-summary');
        summaryDiv.innerHTML = `
            <p>Total Distance: ${totalKm.toFixed(2)} km</p>
            <p>Walk: ${(totalKm / config.profiles.walk.speed).toFixed(1)} days</p>
            <p>Wagon: ${(totalKm / config.profiles.wagon.speed).toFixed(1)} days</p>
            <p>Horse: ${(totalKm / config.profiles.horse.speed).toFixed(1)} days</p>
        `;
    }


    // --- DM MODE ---
    let pendingMarker = null; // Store marker being created
    let pendingTerrain = null; // Store terrain being created
    let currentTerrainMode = null; // Track current terrain painting mode

    async function setupDmMode() {
        if (!state.isDmMode) return;
        
        console.log('Setting up DM mode controls...');

        // Initialize Git Gateway for live CMS
        try {
            await window.gitClient.initialize();
            if (window.gitClient.isAuthenticated) {
                state.isLiveCMS = true;
                showNotification('Live CMS mode enabled - changes save directly to repository!', 'success');
            } else {
                showNotification('Click "Login" to enable live CMS mode', 'info');
            }
        } catch (error) {
            console.warn('Git Gateway not available:', error);
            showNotification('Offline mode - use Export button to save data', 'info');
        }

        map.pm.addControls({
            position: 'topleft',
            drawMarker: true,
            drawPolygon: true,
            drawPolyline: true,
            editMode: true,
            removalMode: true,
        });

        // Add terrain mode selector
        addTerrainModeControls();
        
        // Add authentication controls
        addAuthenticationControls();

        // Add logic for saving markers and terrain
        const saveButton = L.Control.extend({
            options: {
                position: 'topleft'
            },
            onAdd: function () {
                const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
                const button = L.DomUtil.create('a', 'leaflet-control-button', container);
                button.innerHTML = state.isLiveCMS ? 'Export' : 'Save Data';
                button.title = state.isLiveCMS ? 
                    'Export data as backup (auto-saves to repo)' : 
                    'Export markers and terrain data';
                button.onclick = () => {
                    exportData();
                };
                return container;
            }
        });
        map.addControl(new saveButton());

        // Add bulk import button
        const importButton = L.Control.extend({
            options: {
                position: 'topleft'
            },
            onAdd: function () {
                const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
                const button = L.DomUtil.create('a', 'leaflet-control-button', container);
                button.innerHTML = 'Import';
                button.title = 'Bulk import markers from CSV';
                button.onclick = () => {
                    openBulkImportModal();
                };
                return container;
            }
        });
        map.addControl(new importButton());

        // Set up modal form handlers
        setupMarkerCreationModal();
        setupBulkImportModal();
        setupTerrainTypeModal();

        map.on('pm:create', async (e) => {
            if (e.shape === 'Marker') {
                pendingMarker = e.layer;
                openMarkerCreationModal(pendingMarker.getLatLng());
            } else if (e.shape === 'Polygon' || e.shape === 'Line') {
                pendingTerrain = e.layer;
                await openTerrainTypeModal();
            }
        });

        // Load existing terrain and style it
        renderExistingTerrain();
    }

    function addTerrainModeControls() {
        // Add terrain painting mode controls
        const terrainControls = L.Control.extend({
            options: {
                position: 'topleft'
            },
            onAdd: function () {
                const container = L.DomUtil.create('div', 'terrain-controls');
                container.innerHTML = `
                    <div class="leaflet-bar leaflet-control">
                        <a class="leaflet-control-button terrain-mode-btn" data-mode="road" title="Paint Roads">🛤️</a>
                        <a class="leaflet-control-button terrain-mode-btn" data-mode="difficult" title="Paint Difficult Terrain">🏔️</a>
                        <a class="leaflet-control-button terrain-mode-btn" data-mode="blocked" title="Paint Blocked Areas">🚫</a>
                        <a class="leaflet-control-button" id="clear-terrain-mode" title="Normal Drawing">✏️</a>
                    </div>
                `;
                
                // Add click handlers
                container.addEventListener('click', (e) => {
                    const button = e.target.closest('.terrain-mode-btn');
                    if (button) {
                        const mode = button.dataset.mode;
                        setTerrainMode(mode);
                        
                        // Update button states
                        container.querySelectorAll('.terrain-mode-btn').forEach(btn => btn.classList.remove('active'));
                        button.classList.add('active');
                    }
                    
                    if (e.target.id === 'clear-terrain-mode') {
                        clearTerrainMode();
                        container.querySelectorAll('.terrain-mode-btn').forEach(btn => btn.classList.remove('active'));
                    }
                });

                return container;
            }
        });
        
        map.addControl(new terrainControls());
    }

    function setTerrainMode(mode) {
        currentTerrainMode = mode;
        showNotification(`Terrain mode: ${mode}. Draw polygons/lines to paint terrain.`, 'success');
    }

    function clearTerrainMode() {
        currentTerrainMode = null;
        showNotification('Normal drawing mode enabled', 'success');
    }

    function addAuthenticationControls() {
        const authControls = L.Control.extend({
            options: {
                position: 'topright'
            },
            onAdd: function () {
                const container = L.DomUtil.create('div', 'auth-controls');
                container.innerHTML = `
                    <div class="leaflet-bar leaflet-control">
                        <a class="leaflet-control-button" id="dm-login-btn" title="Login for Live CMS">👤</a>
                        <a class="leaflet-control-button" id="dm-status-btn" title="CMS Status">📡</a>
                    </div>
                `;
                
                // Add click handlers
                const loginBtn = container.querySelector('#dm-login-btn');
                const statusBtn = container.querySelector('#dm-status-btn');
                
                loginBtn.addEventListener('click', async () => {
                    if (window.gitClient.isAuthenticated) {
                        window.gitClient.logout();
                    } else {
                        await window.gitClient.login();
                    }
                    updateAuthUI();
                });

                statusBtn.addEventListener('click', () => {
                    const status = state.isLiveCMS ? 
                        'Live CMS: Changes save to repository automatically' :
                        'Offline Mode: Use Export button to save data';
                    showNotification(status, 'info');
                });

                updateAuthUI();
                return container;
            }
        });
        
        map.addControl(new authControls());

        // Update UI when auth state changes
        function updateAuthUI() {
            const loginBtn = document.getElementById('dm-login-btn');
            const statusBtn = document.getElementById('dm-status-btn');
            
            if (loginBtn) {
                loginBtn.innerHTML = window.gitClient.isAuthenticated ? '👤✓' : '👤';
                loginBtn.title = window.gitClient.isAuthenticated ? 'Logout' : 'Login for Live CMS';
            }
            
            if (statusBtn) {
                statusBtn.innerHTML = state.isLiveCMS ? '📡✓' : '📡';
                statusBtn.style.color = state.isLiveCMS ? '#28a745' : '#6c757d';
            }
            
            state.isLiveCMS = window.gitClient.isAuthenticated;
        }

        // Listen for auth events
        if (window.netlifyIdentity) {
            window.netlifyIdentity.on('login', updateAuthUI);
            window.netlifyIdentity.on('logout', updateAuthUI);
        }
    }

    function setupMarkerCreationModal() {
        const modal = document.getElementById('marker-creation-modal');
        const form = document.getElementById('marker-form');
        const nameInput = document.getElementById('marker-name');
        const idInput = document.getElementById('marker-id');
        const cancelBtn = document.getElementById('cancel-marker');

        // Auto-generate ID from name
        nameInput.addEventListener('input', (e) => {
            const name = e.target.value;
            const id = name.toLowerCase()
                .replace(/[^a-z0-9\s-]/g, '')
                .replace(/\s+/g, '-')
                .replace(/-+/g, '-')
                .replace(/^-|-$/g, '');
            idInput.value = id;
        });

        // Cancel button
        cancelBtn.addEventListener('click', () => {
            if (pendingMarker) {
                map.removeLayer(pendingMarker);
                pendingMarker = null;
            }
            modal.classList.add('hidden');
        });

        // Form submission
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await saveMarkerFromForm();
        });

        // Close modal on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                cancelBtn.click();
            }
        });
    }

    function openMarkerCreationModal(latLng) {
        const modal = document.getElementById('marker-creation-modal');
        const coordsInput = document.getElementById('marker-coordinates');
        
        // Show coordinates
        coordsInput.value = `X: ${Math.round(latLng.lng)}, Y: ${Math.round(latLng.lat)}`;
        
        // Clear form
        document.getElementById('marker-form').reset();
        document.getElementById('marker-public').checked = true;
        
        modal.classList.remove('hidden');
        document.getElementById('marker-name').focus();
    }

    async function saveMarkerFromForm() {
        const form = document.getElementById('marker-form');
        const formData = new FormData(form);
        
        const id = formData.get('marker-id');
        const name = formData.get('marker-name');
        const summary = formData.get('marker-summary');
        const type = formData.get('marker-type');
        const faction = formData.get('marker-faction');
        const isPublic = formData.get('marker-public') === 'on';

        // Validation
        if (!id || !name || !summary) {
            showNotification('Please fill in all required fields', 'error');
            return;
        }

        // Check for duplicate ID
        if (state.markers.some(m => m.id === id)) {
            showNotification('Marker ID already exists', 'error');
            return;
        }

        const newMarkerData = {
            id,
            name,
            x: pendingMarker.getLatLng().lng,
            y: pendingMarker.getLatLng().lat,
            type,
            faction: faction || undefined,
            summary,
            images: [],
            public: isPublic,
        };

        state.markers.push(newMarkerData);
        pendingMarker.on('click', () => openInfoSidebar(newMarkerData));
        
        // Auto-save after creating marker
        if (state.isLiveCMS) {
            await saveLiveData('markers');
        } else {
            setTimeout(() => exportData(), 100);
        }
        
        document.getElementById('marker-creation-modal').classList.add('hidden');
        pendingMarker = null;
        
        showNotification(`Marker "${name}" created successfully!`, 'success');
    }

    function handleTerrainCreation(layer) {
        const kind = prompt("Enter terrain kind (road, difficult, blocked):");
        if (['road', 'difficult', 'blocked'].includes(kind)) {
            const feature = layer.toGeoJSON();
            feature.properties.kind = kind;
            state.terrain.features.push(feature);
            showNotification(`${kind} terrain added`, 'success');
            setTimeout(() => exportData(), 100);
        } else {
            map.removeLayer(layer);
            showNotification('Invalid terrain type', 'error');
        }
    }

    function setupTerrainTypeModal() {
        const modal = document.getElementById('terrain-type-modal');
        const terrainButtons = modal.querySelectorAll('.terrain-btn');
        const cancelBtn = document.getElementById('cancel-terrain');

        // Terrain type selection
        terrainButtons.forEach(button => {
            button.addEventListener('click', async () => {
                const terrainType = button.dataset.type;
                await saveTerrainWithType(terrainType);
                modal.classList.add('hidden');
            });
        });

        // Cancel button
        cancelBtn.addEventListener('click', () => {
            if (pendingTerrain) {
                map.removeLayer(pendingTerrain);
                pendingTerrain = null;
            }
            modal.classList.add('hidden');
        });

        // Close modal on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                cancelBtn.click();
            }
        });
    }

    async function openTerrainTypeModal() {
        const modal = document.getElementById('terrain-type-modal');
        
        // If we have a current terrain mode set, use it automatically
        if (currentTerrainMode) {
            await saveTerrainWithType(currentTerrainMode);
            return;
        }
        
        modal.classList.remove('hidden');
    }

    async function saveTerrainWithType(terrainType) {
        if (!pendingTerrain) return;

        const feature = pendingTerrain.toGeoJSON();
        feature.properties.kind = terrainType;
        state.terrain.features.push(feature);
        
        // Style the terrain visually
        styleTerrainLayer(pendingTerrain, terrainType);
        
        showNotification(`${terrainType} terrain added`, 'success');
        
        // Auto-save after creating terrain
        if (state.isLiveCMS) {
            await saveLiveData('terrain');
        } else {
            setTimeout(() => exportData(), 100);
        }
        
        pendingTerrain = null;
    }

    function styleTerrainLayer(layer, terrainType) {
        const styles = {
            road: {
                color: '#4a90e2',
                weight: 4,
                opacity: 0.8,
                fillColor: '#4a90e2',
                fillOpacity: 0.3
            },
            difficult: {
                color: '#f5a623',
                weight: 3,
                opacity: 0.8,
                fillColor: '#f5a623',
                fillOpacity: 0.3
            },
            blocked: {
                color: '#d0021b',
                weight: 3,
                opacity: 0.8,
                fillColor: '#d0021b',
                fillOpacity: 0.4
            }
        };

        if (layer.setStyle) {
            layer.setStyle(styles[terrainType]);
        }
        
        // Add popup with terrain info
        layer.bindPopup(`<b>${terrainType.charAt(0).toUpperCase() + terrainType.slice(1)} Terrain</b><br>
                        <small>Click to edit or delete</small>`);
    }

    function renderExistingTerrain() {
        console.log('Rendering existing terrain:', state.terrain.features.length, 'features');
        
        state.terrain.features.forEach(feature => {
            const terrainType = feature.properties.kind;
            
            if (feature.geometry.type === 'Polygon') {
                const coords = feature.geometry.coordinates[0].map(coord => [coord[1], coord[0]]);
                const polygon = L.polygon(coords).addTo(map);
                styleTerrainLayer(polygon, terrainType);
            } else if (feature.geometry.type === 'LineString') {
                const coords = feature.geometry.coordinates.map(coord => [coord[1], coord[0]]);
                const polyline = L.polyline(coords).addTo(map);
                styleTerrainLayer(polyline, terrainType);
            }
        });
    }

    function showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    function setupBulkImportModal() {
        const modal = document.getElementById('bulk-import-modal');
        const csvInput = document.getElementById('csv-input');
        const csvFile = document.getElementById('csv-file');
        const cancelBtn = document.getElementById('cancel-import');
        const processBtn = document.getElementById('process-import');

        // File upload handler
        csvFile.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    csvInput.value = e.target.result;
                };
                reader.readAsText(file);
            }
        });

        // Cancel button
        cancelBtn.addEventListener('click', () => {
            modal.classList.add('hidden');
            csvInput.value = '';
            csvFile.value = '';
        });

        // Process import
        processBtn.addEventListener('click', async () => {
            await processBulkImport(csvInput.value);
        });

        // Close modal on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                cancelBtn.click();
            }
        });
    }

    function openBulkImportModal() {
        const modal = document.getElementById('bulk-import-modal');
        modal.classList.remove('hidden');
        document.getElementById('csv-input').focus();
    }

    async function processBulkImport(csvData) {
        if (!csvData.trim()) {
            showNotification('Please enter CSV data', 'error');
            return;
        }

        const lines = csvData.trim().split('\n');
        const headers = lines[0].split(',').map(h => h.trim());
        
        // Check if first row is headers
        const hasHeaders = headers.includes('name') || headers.includes('x') || headers.includes('y');
        const dataLines = hasHeaders ? lines.slice(1) : lines;
        
        let imported = 0;
        let errors = [];

        dataLines.forEach((line, index) => {
            const values = line.split(',').map(v => v.trim());
            
            try {
                const markerData = hasHeaders ? 
                    parseCSVWithHeaders(headers, values) : 
                    parseCSVWithoutHeaders(values);
                
                // Validate required fields
                if (!markerData.name || !markerData.x || !markerData.y) {
                    errors.push(`Row ${index + 1}: Missing required fields`);
                    return;
                }

                // Check for duplicate ID
                if (state.markers.some(m => m.id === markerData.id)) {
                    errors.push(`Row ${index + 1}: Marker ID "${markerData.id}" already exists`);
                    return;
                }

                // Add marker
                state.markers.push(markerData);
                const marker = L.marker([markerData.y, markerData.x]).addTo(map);
                marker.on('click', () => openInfoSidebar(markerData));
                imported++;
                
            } catch (error) {
                errors.push(`Row ${index + 1}: ${error.message}`);
            }
        });

        // Show results
        if (imported > 0) {
            showNotification(`Successfully imported ${imported} markers!`, 'success');
            
            // Auto-save after import
            if (state.isLiveCMS) {
                await saveLiveData('markers');
            } else {
                setTimeout(() => exportData(), 100);
            }
        }
        
        if (errors.length > 0) {
            console.warn('Import errors:', errors);
            showNotification(`Imported ${imported} markers with ${errors.length} errors. Check console for details.`, 'error');
        }

        document.getElementById('bulk-import-modal').classList.add('hidden');
    }

    function parseCSVWithHeaders(headers, values) {
        const data = {};
        headers.forEach((header, i) => {
            data[header] = values[i] || '';
        });
        
        return {
            id: data.id || generateIdFromName(data.name),
            name: data.name,
            x: parseFloat(data.x),
            y: parseFloat(data.y),
            type: data.type || 'other',
            faction: data.faction || undefined,
            summary: data.summary || '',
            images: [],
            public: data.public === 'true' || data.public === '1' || data.public === 'yes',
        };
    }

    function parseCSVWithoutHeaders(values) {
        // Assume order: name,x,y,type,faction,summary,public
        return {
            id: generateIdFromName(values[0]),
            name: values[0],
            x: parseFloat(values[1]),
            y: parseFloat(values[2]),
            type: values[3] || 'other',
            faction: values[4] || undefined,
            summary: values[5] || '',
            images: [],
            public: values[6] === 'true' || values[6] === '1' || values[6] === 'yes',
        };
    }

    function generateIdFromName(name) {
        return name.toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
    }

    // --- LIVE CMS FUNCTIONS ---
    async function saveLiveData(dataType) {
        if (!state.isLiveCMS || !window.gitClient.isAuthenticated) {
            console.warn('Live CMS not available');
            return false;
        }

        try {
            showNotification('Saving to repository...', 'info');

            if (dataType === 'markers') {
                await window.gitClient.saveMarkersData({ markers: state.markers });
                showNotification('Markers saved to repository!', 'success');
            } else if (dataType === 'terrain') {
                await window.gitClient.saveTerrainData(state.terrain);
                showNotification('Terrain saved to repository!', 'success');
            }

            // Trigger site rebuild to update live site
            await window.gitClient.triggerRedeploy();
            
            return true;
        } catch (error) {
            console.error('Failed to save to repository:', error);
            showNotification(`Failed to save ${dataType}: ${error.message}`, 'error');
            return false;
        }
    }

    // Enhanced export with live CMS integration
    function exportData() {
        // Export markers
        const markersBlob = new Blob([JSON.stringify({ markers: state.markers }, null, 2)], { type: 'application/json' });
        download(markersBlob, 'markers.json');

        // Export terrain
        const terrainBlob = new Blob([JSON.stringify(state.terrain, null, 2)], { type: 'application/json' });
        download(terrainBlob, 'terrain.geojson');
    }

    function download(blob, filename) {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }
});

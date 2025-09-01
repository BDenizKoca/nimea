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
        markers: [],
        terrain: { type: 'FeatureCollection', features: [] },
        route: [],
        overlays: {},
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

    // --- LOAD MAP IMAGE & DATA ---
    const mapImageUrl = 'map.webp';
    const img = new Image();
    img.onload = () => {
        const { width, height } = img;
        const bounds = [[0, 0], [height, width]];
        L.imageOverlay(mapImageUrl, bounds).addTo(map);
        map.fitBounds(bounds);
        loadInitialData();
    };
    img.onerror = () => console.error("Failed to load map image.");
    img.src = mapImageUrl;

    async function loadInitialData() {
        try {
            const [markersRes, terrainRes, configRes] = await Promise.all([
                fetch('../data/markers.json').catch(() => ({ json: () => ({ markers: [] }) })),
                fetch('../data/terrain.geojson').catch(() => ({ json: () => ({ features: [] }) })),
                fetch('../data/config.json').catch(() => ({ json: () => ({}) }))
            ]);

            const markersData = await markersRes.json();
            const terrainData = await terrainRes.json();
            const remoteConfig = await configRes.json();

            Object.assign(config, remoteConfig);
            state.markers = markersData.markers || [];
            state.terrain = terrainData;

            renderMarkers();
            setupOverlays();
            setupDmMode();

        } catch (error) {
            console.error("Error loading initial data:", error);
        }
    }

    // --- MARKERS ---
    function renderMarkers() {
        state.markers.forEach(markerData => {
            if (markerData.public || state.isDmMode) {
                const marker = L.marker([markerData.y, markerData.x]).addTo(map);
                marker.on('click', () => openInfoSidebar(markerData));
            }
        });
    }

    // --- SIDEBARS ---
    function openInfoSidebar(data) {
        const content = `
            <h2>${data.name}</h2>
            <p>${data.summary}</p>
            ${data.images && data.images.length > 0 ? data.images.map(img => `<img src="../${img}" alt="${data.name}" style="width:100%;">`).join('') : ''}
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

    closeInfoSidebarBtn.addEventListener('click', () => infoSidebar.classList.remove('open'));

    // --- OVERLAYS ---
    function setupOverlays() {
        if (config.overlays) {
            const imgBounds = map.getBounds();
            if (config.overlays.regions) {
                state.overlays.regions = L.imageOverlay(`../${config.overlays.regions}`, imgBounds, { opacity: 0.7 }).addTo(map);
                toggleRegions.checked = true;
            }
            if (config.overlays.borders) {
                state.overlays.borders = L.imageOverlay(`../${config.overlays.borders}`, imgBounds, { opacity: 0.8 }).addTo(map);
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
    function setupDmMode() {
        if (!state.isDmMode) return;

        map.pm.addControls({
            position: 'topleft',
            drawMarker: true,
            drawPolygon: true,
            editMode: true,
            removalMode: true,
        });

        // Add logic for saving markers and terrain
        const saveButton = L.Control.extend({
            options: {
                position: 'topleft'
            },
            onAdd: function () {
                const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
                const button = L.DomUtil.create('a', 'leaflet-control-button', container);
                button.innerHTML = 'Save';
                button.onclick = () => {
                    exportData();
                };
                return container;
            }
        });
        map.addControl(new saveButton());


        map.on('pm:create', (e) => {
            if (e.shape === 'Marker') {
                const marker = e.layer;
                const id = prompt("Enter a unique ID for this marker:");
                const name = prompt("Enter a name for this marker:");
                const summary = prompt("Enter a summary:");
                if (id && name) {
                    const newMarkerData = {
                        id,
                        name,
                        x: marker.getLatLng().lng,
                        y: marker.getLatLng().lat,
                        summary,
                        images: [],
                        public: confirm("Make this marker public?"),
                    };
                    state.markers.push(newMarkerData);
                    marker.on('click', () => openInfoSidebar(newMarkerData));
                }
            } else if (e.shape === 'Polygon') {
                const kind = prompt("Enter terrain kind (road, difficult, blocked):");
                if (['road', 'difficult', 'blocked'].includes(kind)) {
                    const feature = e.layer.toGeoJSON();
                    feature.properties.kind = kind;
                    state.terrain.features.push(feature);
                }
            }
        });
    }

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

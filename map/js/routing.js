// map/js/routing.js

(function(window) {
    'use strict';

    // This will be initialized with the bridge object from the main script.
    let bridge = {};

    let pathfindingGrid = null;
    let isCalculatingRoute = false; // Mutex to prevent concurrent calculations

    function initRouting(map) {
        bridge = window.__nimea;
        if (!bridge) {
            console.error("Routing module requires the global bridge.");
            return;
        }
        
        // Expose public functions on the bridge
        bridge.routingModule = {
            addToRoute,
            recomputeRoute,
            invalidateGrid, // <-- NEW: Allow other modules to invalidate the grid
            initRouting: () => { /* no-op, already initialized */ }
        };
        
        console.log("Routing module initialized.");
    }

    /**
     * Invalidates the cached pathfinding grid.
     * Called by the DM module when terrain is updated.
     */
    function invalidateGrid() {
        pathfindingGrid = null;
        console.log("Pathfinding grid invalidated due to terrain changes.");
    }

    function addToRoute(marker) {
        if (bridge.state.isDmMode) {
            return; // routing disabled in DM mode
        }
        console.log('Adding to route:', marker.name);
        bridge.state.route.push(marker);
        
        const routeSidebar = document.getElementById('route-sidebar');
        if (routeSidebar) {
            routeSidebar.classList.add('open');
        }
        
        recomputeRoute();
    }

    function updateRouteDisplay() {
        const stopsDiv = document.getElementById('route-stops');
        if (!stopsDiv) return;
        stopsDiv.innerHTML = bridge.state.route.map((stop, idx) => {
            return `<div class="route-stop-row">${idx+1}. ${stop.name} <button class="mini-btn" data-ridx="${idx}" title="Remove stop">✖</button></div>`;
        }).join('') + (bridge.state.route.length?`<div class="route-actions"><button id="clear-route-btn" class="clear-route-btn">Clear Route</button></div>`:'');
        
        stopsDiv.querySelectorAll('button[data-ridx]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const ridx = parseInt(e.currentTarget.dataset.ridx,10);
                removeRouteIndex(ridx);
            });
        });
        
        const clearBtn = document.getElementById('clear-route-btn');
        if (clearBtn) clearBtn.addEventListener('click', clearRoute);
    }

    function removeRouteIndex(idx) {
        bridge.state.route.splice(idx,1);
        recomputeRoute();
    }

    function clearRoute() {
        if (isCalculatingRoute) {
            isCalculatingRoute = false; // Signal to stop the calculation chain
        }
        bridge.state.route = [];
        bridge.state.routeLegs = [];
        bridge.state.routePolylines.forEach(pl => bridge.map.removeLayer(pl));
        bridge.state.routePolylines = [];
        if (bridge.state.routePolyline) { bridge.map.removeLayer(bridge.state.routePolyline); bridge.state.routePolyline = null; }
        updateRouteDisplay();
        updateRouteSummaryEmpty();
    }

    function recomputeRoute() {
        if (isCalculatingRoute) {
            console.warn("Route calculation already in progress. Ignoring new request.");
            return;
        }

        console.log('recomputeRoute called, current state:', {
            routeLength: bridge.state.route.length,
            isDmMode: bridge.state.isDmMode,
            routeStops: bridge.state.route.map(r => r.name)
        });
        
        // Clear existing leg polylines
        bridge.state.routePolylines.forEach(pl => bridge.map.removeLayer(pl));
        bridge.state.routePolylines = [];
        bridge.state.routeLegs = [];
        if (bridge.state.routePolyline) { bridge.map.removeLayer(bridge.state.routePolyline); bridge.state.routePolyline = null; }
        
        updateRouteDisplay();
        
        if (bridge.state.route.length < 2) { 
            updateRouteSummaryEmpty(); 
            return; 
        }

        isCalculatingRoute = true;
        updateRouteSummaryCalculating();
        
        // Build grid if it doesn't exist. This is now the only place it's built.
        if (!pathfindingGrid) {
            buildPathfindingGrid();
        }

        // If grid build failed or was retried, the actual calculation will be picked up later.
        // The `isCalculatingRoute` flag will be handled by the grid builder.
        if (!pathfindingGrid) {
            console.log("Grid is not ready yet, calculation will start after grid is built.");
            return;
        }

        // Process legs sequentially to avoid overwhelming easystar
        const processLeg = (legIndex) => {
            // If calculation was cancelled, stop.
            if (!isCalculatingRoute) {
                console.log("Route calculation was cancelled.");
                updateRouteSummaryEmpty();
                return;
            }

            if (legIndex >= bridge.state.route.length - 1) {
                // All legs are calculated
                updateRouteSummaryFromLegs();
                isCalculatingRoute = false;
                console.info('Route summary updated (A* mode).');
                return;
            }

            const start = bridge.state.route[legIndex];
            const end = bridge.state.route[legIndex + 1];
            
            calculateLegPath(start, end, () => {
                // When this leg is done, process the next one
                processLeg(legIndex + 1);
            });
        };

        // Start processing from the first leg (index 0)
        processLeg(0);
    }

    function computeDirectKm(a, b) {
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const distPx = Math.sqrt(dx * dx + dy * dy);
        return distPx * bridge.config.kmPerPixel;
    }

    function buildPathfindingGrid() {
        // This function now only builds the grid data, it doesn't configure easystar.
        const bounds = bridge.map.getBounds();
        const mapWidth = bounds.getEast();
        const mapHeight = bounds.getSouth();

        // Safeguard against invalid map dimensions during initialization
        if (mapWidth <= 0 || mapHeight <= 0) {
            console.warn(`Invalid map dimensions (${mapWidth}x${mapHeight}). Retrying grid build shortly...`);
            setTimeout(buildPathfindingGrid, 200); // Try again after a short delay
            return;
        }

        const cols = Math.floor(mapWidth / bridge.config.gridCellSize);
        const rows = Math.floor(mapHeight / bridge.config.gridCellSize);

        // Final safeguard for cols/rows
        if (cols <= 0 || rows <= 0) {
            console.error(`Cannot build grid with non-positive dimensions: ${cols}x${rows}.`);
            isCalculatingRoute = false; // Release the lock
            return;
        }

        console.log(`Building ${cols}x${rows} grid for map size ${mapWidth}x${mapHeight}...`);
        console.log('Terrain features available:', bridge.state.terrain.features.length);

        const TILE_NORMAL = 1;
        const TILE_ROAD = 2;
        const TILE_DIFFICULT = 3;
        const TILE_UNPASSABLE = 4;

        const grid = Array(rows).fill(null).map(() => Array(cols).fill(TILE_NORMAL));

        if (bridge.state.terrain.features && bridge.state.terrain.features.length > 0) {
            const unpassableFeatures = bridge.state.terrain.features.filter(f => f.properties.kind === 'unpassable');
            const difficultFeatures = bridge.state.terrain.features.filter(f => f.properties.kind === 'difficult');
            const roadFeatures = bridge.state.terrain.features.filter(f => f.properties.kind === 'road');

            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    const [worldX, worldY] = gridToWorldCoords(c, r, cols, rows, mapWidth, mapHeight);
                    const point = turf.point([worldX, worldY]);
                    let tileType = TILE_NORMAL;
                    let isImpassable = false;

                    for (const feature of unpassableFeatures) {
                        if (feature.geometry.type === 'Polygon' && turf.booleanPointInPolygon(point, feature)) {
                            isImpassable = true;
                            tileType = TILE_UNPASSABLE;
                            break;
                        }
                    }
                    if (isImpassable) {
                        grid[r][c] = tileType;
                        continue;
                    }

                    let onRoad = false;
                    for (const feature of roadFeatures) {
                        const distance = turf.pointToLineDistance(point, feature, { units: 'pixels' });
                        if (distance < bridge.config.gridCellSize / 2) {
                            tileType = TILE_ROAD;
                            onRoad = true;
                            break;
                        }
                    }

                    if (!onRoad) {
                        for (const feature of difficultFeatures) {
                            if (feature.geometry.type === 'Polygon' && turf.booleanPointInPolygon(point, feature)) {
                                tileType = TILE_DIFFICULT;
                                break;
                            } else if (feature.geometry.type === 'LineString') {
                                const distance = turf.pointToLineDistance(point, feature, { units: 'pixels' });
                                if (distance < bridge.config.gridCellSize) {
                                    tileType = TILE_DIFFICULT;
                                    break;
                                }
                            }
                        }
                    }
                    grid[r][c] = tileType;
                }
            }
        }
        
        // Cache the generated grid and its metadata
        pathfindingGrid = { 
            grid, 
            cols, 
            rows, 
            width: mapWidth, 
            height: mapHeight,
            TILE_NORMAL, TILE_ROAD, TILE_DIFFICULT
        };

        // If a calculation was waiting for the grid, start it now.
        if (isCalculatingRoute) {
            recomputeRoute();
        }
    }

    function calculateLegPath(start, end, onComplete) {
        // Create a FRESH easystar instance for each leg to avoid state issues.
        const legEasystar = new EasyStar.js();

        // Configure this specific instance with the cached grid.
        legEasystar.setGrid(pathfindingGrid.grid);
        legEasystar.setAcceptableTiles([pathfindingGrid.TILE_NORMAL, pathfindingGrid.TILE_ROAD, pathfindingGrid.TILE_DIFFICULT]);
        legEasystar.setTileCost(pathfindingGrid.TILE_NORMAL, 1.0);
        legEasystar.setTileCost(pathfindingGrid.TILE_ROAD, 0.5);
        legEasystar.setTileCost(pathfindingGrid.TILE_DIFFICULT, 3.0);
        legEasystar.enableDiagonals();
        legEasystar.disableCornerCutting();

        const startCell = worldToGridCoords(start.x, start.y);
        const endCell = worldToGridCoords(end.x, end.y);
        const straightLineKm = computeDirectKm(start, end);
        
        const fallbackTimer = setTimeout(() => {
            console.warn('EasyStar timeout, using fallback route');
            legEasystar.stopFindPath(); // Stop the calculation
            const straightPath = [[start.y, start.x], [end.y, end.x]];
            const polyline = L.polyline(straightPath, { color: 'blue', weight: 3, dashArray: '5,5', pane: 'routePane' }).addTo(bridge.map);
            bridge.state.routePolylines.push(polyline);
            bridge.state.routeLegs.push({ from: start, to: end, distanceKm: straightLineKm, fallback: true });
            if (typeof onComplete === 'function') onComplete();
        }, 2000);
        
        legEasystar.findPath(startCell.x, startCell.y, endCell.x, endCell.y, (path) => {
            clearTimeout(fallbackTimer);
            
            if (path && path.length > 0) {
                const pixelPath = path.map(p => {
                    const coords = gridToWorldCoords(p.x, p.y);
                    return [coords[1], coords[0]];
                });
                const polyline = L.polyline(pixelPath, { color: 'red', weight: 3, pane: 'routePane' }).addTo(bridge.map);
                bridge.state.routePolylines.push(polyline);
                const distanceKm = computePixelPathKm(pixelPath);
                bridge.state.routeLegs.push({ from: start, to: end, distanceKm });
            } else {
                const straightPath = [[start.y, start.x], [end.y, end.x]];
                const polyline = L.polyline(straightPath, { color: 'blue', weight: 3, dashArray: '5,5', pane: 'routePane' }).addTo(bridge.map);
                bridge.state.routePolylines.push(polyline);
                bridge.state.routeLegs.push({ from: start, to: end, distanceKm: straightLineKm, fallback: true });
            }
            if (typeof onComplete === 'function') onComplete();
        });
        legEasystar.calculate();
    }
    
    function worldToGridCoords(x, y) {
        if (!pathfindingGrid) return { x: 0, y: 0 };
        const gridX = Math.floor(x / bridge.config.gridCellSize);
        const gridY = Math.floor(y / bridge.config.gridCellSize);
        return {
            x: Math.max(0, Math.min(gridX, pathfindingGrid.cols - 1)),
            y: Math.max(0, Math.min(gridY, pathfindingGrid.rows - 1))
        };
    }

    function gridToWorldCoords(gridX, gridY) {
        // Overloaded signature to support old calls from the grid builder
        if (arguments.length > 2) {
            const cols = arguments[2];
            const rows = arguments[3];
            const mapWidth = arguments[4];
            const mapHeight = arguments[5];
            return [
                gridX * bridge.config.gridCellSize + bridge.config.gridCellSize / 2,
                gridY * bridge.config.gridCellSize + bridge.config.gridCellSize / 2
            ];
        }
        return [
            gridX * bridge.config.gridCellSize + bridge.config.gridCellSize / 2,
            gridY * bridge.config.gridCellSize + bridge.config.gridCellSize / 2
        ];
    }

    function computePixelPathKm(pixelPath) {
        let totalDistancePx = 0;
        for (let i = 1; i < pixelPath.length; i++) {
            const dx = pixelPath[i][1] - pixelPath[i-1][1];
            const dy = pixelPath[i][0] - pixelPath[i-1][0];
            totalDistancePx += Math.sqrt(dx * dx + dy * dy);
        }
        return totalDistancePx * bridge.config.kmPerPixel;
    }

    function updateRouteSummaryFromLegs() {
        const summaryDiv = document.getElementById('route-summary');
        if (!summaryDiv) return;
        if (!bridge.state.routeLegs.length) { 
            updateRouteSummaryEmpty(); 
            return; 
        }
        const totalKm = bridge.state.routeLegs.reduce((a,l)=>a+l.distanceKm,0);
        const legsHtml = bridge.state.routeLegs.map((l,i)=>`<li>Leg ${i+1}: ${l.from.name} → ${l.to.name}: ${l.distanceKm.toFixed(2)} km${l.fallback?' (direct)':''}</li>`).join('');
        summaryDiv.innerHTML = `
            <h3>Route Summary</h3>
            <p><strong>Total Distance:</strong> ${totalKm.toFixed(2)} km</p>
            <ul class="route-legs">${legsHtml}</ul>
            <div class="travel-times">
                <p><strong>Walking:</strong> ${(totalKm / bridge.config.profiles.walk.speed).toFixed(1)} days</p>
                <p><strong>Wagon:</strong> ${(totalKm / bridge.config.profiles.wagon.speed).toFixed(1)} days</p>
                <p><strong>Horse:</strong> ${(totalKm / bridge.config.profiles.horse.speed).toFixed(1)} days</p>
            </div>
        `;
    }

    function updateRouteSummaryCalculating() {
        const summaryDiv = document.getElementById('route-summary');
        if (!summaryDiv) return;
        summaryDiv.innerHTML = '<p>Calculating route...</p>';
    }

    function updateRouteSummaryEmpty() {
        const summaryDiv = document.getElementById('route-summary');
        if (!summaryDiv) return;
        if (!bridge.state.route.length) { 
            summaryDiv.innerHTML = '<p>No route defined yet. Add a marker.</p>'; 
            return; 
        }
        if (bridge.state.route.length === 1) { 
            summaryDiv.innerHTML = '<p>Add a second stop to compute a route.</p>'; 
            return; 
        }
    }

    // Expose the init function to the global scope
    window.__nimea_routing_init = initRouting;

})(window);

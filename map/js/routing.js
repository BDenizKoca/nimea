// map/js/routing.js

(function(window) {
    'use strict';

    // This will be initialized with the bridge object from the main script.
    let bridge = {};

    let pathfindingGrid = null;
    let easystar = null;

    function initRouting(map) {
        bridge = window.__nimea;
        if (!bridge) {
            console.error("Routing module requires the global bridge.");
            return;
        }
        easystar = new EasyStar.js();
        
        // Expose public functions on the bridge
        bridge.routingModule = {
            addToRoute,
            recomputeRoute,
            initRouting: () => { /* no-op, already initialized */ }
        };
        
        console.log("Routing module initialized.");
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
        bridge.state.route = [];
        bridge.state.routeLegs = [];
        bridge.state.routePolylines.forEach(pl => bridge.map.removeLayer(pl));
        bridge.state.routePolylines = [];
        if (bridge.state.routePolyline) { bridge.map.removeLayer(bridge.state.routePolyline); bridge.state.routePolyline = null; }
        updateRouteDisplay();
        updateRouteSummaryEmpty();
    }

    function recomputeRoute() {
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

        console.info('Computing route distances using direct pixel distance (175px = 100km).');

        for (let i = 1; i < bridge.state.route.length; i++) {
            const start = bridge.state.route[i - 1];
            const end = bridge.state.route[i];
            const straightLineKm = computeDirectKm(start, end);
            console.debug(`Leg ${i}: ${start.name} -> ${end.name} = ${straightLineKm.toFixed(2)} km`);

            const straightPath = [[start.y, start.x], [end.y, end.x]];
            const polyline = L.polyline(straightPath, {
                color: '#204d8c',
                weight: 3,
                dashArray: '6,6',
                pane: 'routePane'
            }).addTo(bridge.map);
            
            bridge.state.routePolylines.push(polyline);
            bridge.state.routeLegs.push({ from: start, to: end, distanceKm: straightLineKm, mode: 'direct' });
        }

        updateRouteSummaryFromLegs();
        console.info('Route summary updated (direct mode).');
    }

    function computeDirectKm(a, b) {
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const distPx = Math.sqrt(dx * dx + dy * dy);
        return distPx * bridge.config.kmPerPixel;
    }

    function buildPathfindingGrid() {
        const bounds = bridge.map.getBounds();
        const mapWidth = bounds.getEast();
        const mapHeight = bounds.getSouth();

        const cols = Math.floor(mapWidth / bridge.config.gridCellSize);
        const rows = Math.floor(mapHeight / bridge.config.gridCellSize);

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
                    const [worldX, worldY] = gridToWorldCoords(c, r);
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

        easystar.setGrid(grid);
        easystar.setAcceptableTiles([TILE_NORMAL, TILE_ROAD, TILE_DIFFICULT]);
        easystar.setTileCost(TILE_NORMAL, 1.0);
        easystar.setTileCost(TILE_ROAD, 0.5);
        easystar.setTileCost(TILE_DIFFICULT, 3.0);
        easystar.enableDiagonals();
        easystar.disableCornerCutting();

        pathfindingGrid = { cols, rows, width: mapWidth, height: mapHeight, TILE_NORMAL, TILE_ROAD, TILE_DIFFICULT, TILE_UNPASSABLE };
    }

    function calculateLegPath(start, end, onComplete) {
        if (!pathfindingGrid) buildPathfindingGrid();
        const startCell = worldToGridCoords(start.x, start.y);
        const endCell = worldToGridCoords(end.x, end.y);
        const straightLineKm = computeDirectKm(start, end);
        
        const fallbackTimer = setTimeout(() => {
            console.warn('EasyStar timeout, using fallback route');
            const straightPath = [[start.y, start.x], [end.y, end.x]];
            const polyline = L.polyline(straightPath, { color: 'blue', weight: 3, dashArray: '5,5', pane: 'routePane' }).addTo(bridge.map);
            bridge.state.routePolylines.push(polyline);
            bridge.state.routeLegs.push({ from: start, to: end, distanceKm: straightLineKm, fallback: true });
            if (typeof onComplete === 'function') onComplete();
        }, 2000);
        
        easystar.findPath(startCell.x, startCell.y, endCell.x, endCell.y, (path) => {
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
        easystar.calculate();
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

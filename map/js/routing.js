// map/js/routing.js - Graph-based pathfinding system

(function(window) {
    'use strict';

    // This will be initialized with the bridge object from the main script.
    let bridge = {};

    let routingGraph = null;
    let isCalculatingRoute = false; // Mutex to prevent concurrent calculations

    // Terrain costs for pathfinding
    const TERRAIN_COSTS = {
        road: 0.5,      // Fast travel on roads
        normal: 1.0,    // Default terrain
        difficult: 3.0, // Mountains, swamps, etc.
        unpassable: Infinity // Blocked areas
    };

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
            invalidateGraph,
            initRouting: () => { /* no-op, already initialized */ }
        };
        
        console.log("Routing module initialized.");
    }

    /**
     * Invalidates the cached routing graph.
     * Called by the DM module when terrain is updated.
     */
    function invalidateGraph() {
        routingGraph = null;
    }

    function addToRoute(marker) {
        if (bridge.state.isDmMode) {
            return; // routing disabled in DM mode
        }
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

        // Close sidebar
        const routeSidebar = document.getElementById('route-sidebar');
        if (routeSidebar) {
            routeSidebar.classList.remove('open');
        }
    }

    function recomputeRoute() {
        if (isCalculatingRoute) {
            console.warn("Route calculation already in progress. Ignoring new request.");
            return;
        }
        
        // Clear existing leg polylines
        bridge.state.routePolylines.forEach(pl => bridge.map.removeLayer(pl));
        bridge.state.routePolylines = [];
        bridge.state.routeLegs = [];
        if (bridge.state.routePolyline) { 
            bridge.map.removeLayer(bridge.state.routePolyline); 
            bridge.state.routePolyline = null; 
        }
        
        updateRouteDisplay();
        
        if (bridge.state.route.length < 2) { 
            updateRouteSummaryEmpty(); 
            return; 
        }

        isCalculatingRoute = true;
        updateRouteSummaryCalculating();
        
        // Build graph if it doesn't exist
        if (!routingGraph) {
            buildRoutingGraph();
        }

        if (!routingGraph) {
            return;
        }

        // Process legs sequentially 
        const processLeg = (legIndex) => {
            // If calculation was cancelled, stop.
            if (!isCalculatingRoute) {
                updateRouteSummaryEmpty();
                return;
            }

            if (legIndex >= bridge.state.route.length - 1) {
                // All legs are calculated
                updateRouteSummaryFromLegs();
                isCalculatingRoute = false;
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

    function buildRoutingGraph() {
        const nodes = new Map(); // nodeId -> {x, y, type}
        const edges = []; // {from, to, cost, distance}
        
        // Add all markers as nodes
        bridge.state.markers.forEach(marker => {
            const nodeId = `marker_${marker.id}`;
            nodes.set(nodeId, {
                x: marker.x,
                y: marker.y,
                type: 'marker',
                markerId: marker.id
            });
        });
        
        // Process road features to create road network
        const roadFeatures = bridge.state.terrain.features.filter(f => f.properties.kind === 'road');
        
        roadFeatures.forEach((roadFeature, roadIndex) => {
            if (roadFeature.geometry.type !== 'LineString') return;
            
            const coordinates = roadFeature.geometry.coordinates;
            
            // Create nodes for road endpoints and intersections
            coordinates.forEach((coord, coordIndex) => {
                const nodeId = `road_${roadIndex}_${coordIndex}`;
                nodes.set(nodeId, {
                    x: coord[0],
                    y: coord[1],
                    type: 'road_node'
                });
            });
            
            // Create edges between consecutive road nodes
            for (let i = 0; i < coordinates.length - 1; i++) {
                const fromId = `road_${roadIndex}_${i}`;
                const toId = `road_${roadIndex}_${i + 1}`;
                const from = coordinates[i];
                const to = coordinates[i + 1];
                
                const distance = Math.sqrt(
                    Math.pow(to[0] - from[0], 2) + 
                    Math.pow(to[1] - from[1], 2)
                );
                
                // Roads have low cost
                edges.push({
                    from: fromId,
                    to: toId,
                    cost: TERRAIN_COSTS.road,
                    distance: distance
                });
                
                // Add reverse edge for bidirectional travel
                edges.push({
                    from: toId,
                    to: fromId,
                    cost: TERRAIN_COSTS.road,
                    distance: distance
                });
            }
        });
        
        // Connect markers to nearby road nodes
        bridge.state.markers.forEach(marker => {
            const markerNodeId = `marker_${marker.id}`;
            const markerPos = {x: marker.x, y: marker.y};
            
            let closestRoadNode = null;
            let closestDistance = Infinity;
            
            // Find closest road node
            for (let [nodeId, node] of nodes) {
                if (node.type === 'road_node') {
                    const distance = Math.sqrt(
                        Math.pow(node.x - markerPos.x, 2) + 
                        Math.pow(node.y - markerPos.y, 2)
                    );
                    
                    if (distance < closestDistance) {
                        closestDistance = distance;
                        closestRoadNode = nodeId;
                    }
                }
            }
            
            // Connect marker to closest road node if within reasonable distance
            if (closestRoadNode && closestDistance < 200) { // 200 pixel threshold
                const terrainCost = getTerrainCostBetweenPoints(
                    markerPos, 
                    nodes.get(closestRoadNode)
                );
                
                edges.push({
                    from: markerNodeId,
                    to: closestRoadNode,
                    cost: terrainCost,
                    distance: closestDistance
                });
                
                edges.push({
                    from: closestRoadNode,
                    to: markerNodeId,
                    cost: terrainCost,
                    distance: closestDistance
                });
            }
        });
        
        // Connect markers directly if no roads available or they're far from roads
        bridge.state.markers.forEach((marker1, i) => {
            bridge.state.markers.forEach((marker2, j) => {
                if (i >= j) return; // Avoid duplicate edges and self-loops
                
                const marker1NodeId = `marker_${marker1.id}`;
                const marker2NodeId = `marker_${marker2.id}`;
                
                const distance = Math.sqrt(
                    Math.pow(marker2.x - marker1.x, 2) + 
                    Math.pow(marker2.y - marker1.y, 2)
                );
                
                // Increased connection distance to improve pathfinding
                if (distance < 1000) { // Increased from 500 to 1000
                    const terrainCost = getTerrainCostBetweenPoints(
                        {x: marker1.x, y: marker1.y},
                        {x: marker2.x, y: marker2.y}
                    );
                    
                    console.log(`Terrain cost between ${marker1.name} and ${marker2.name}: ${terrainCost}`);
                    
                    // Create connections even through difficult terrain (with high cost)
                    if (terrainCost < Infinity) {
                        edges.push({
                            from: marker1NodeId,
                            to: marker2NodeId,
                            cost: terrainCost,
                            distance: distance
                        });
                        
                        edges.push({
                            from: marker2NodeId,
                            to: marker1NodeId,
                            cost: terrainCost,
                            distance: distance
                        });
                    }
                }
            });
        });
        
        routingGraph = { nodes, edges };
        
        // If a calculation was waiting for the graph, start it now
        if (isCalculatingRoute) {
            recomputeRoute();
        }
    }

    /**
     * Dijkstra's algorithm implementation for pathfinding
     */
    function findShortestPath(graph, startNodeId, endNodeId) {
        if (!graph.nodes.has(startNodeId) || !graph.nodes.has(endNodeId)) {
            console.warn(`Node not found: start=${startNodeId}, end=${endNodeId}`);
            return null;
        }

        const distances = new Map();
        const previous = new Map();
        const unvisited = new Set();

        // Initialize distances
        for (let nodeId of graph.nodes.keys()) {
            distances.set(nodeId, Infinity);
            unvisited.add(nodeId);
        }
        distances.set(startNodeId, 0);

        while (unvisited.size > 0) {
            // Find unvisited node with minimum distance
            let currentNode = null;
            let minDistance = Infinity;
            for (let nodeId of unvisited) {
                if (distances.get(nodeId) < minDistance) {
                    minDistance = distances.get(nodeId);
                    currentNode = nodeId;
                }
            }

            if (currentNode === null || minDistance === Infinity) {
                break; // No more reachable nodes
            }

            unvisited.delete(currentNode);

            if (currentNode === endNodeId) {
                break; // Found target
            }

            // Check all edges from current node
            for (let edge of graph.edges) {
                if (edge.from === currentNode && unvisited.has(edge.to)) {
                    const totalCost = edge.distance * edge.cost;
                    const altDistance = distances.get(currentNode) + totalCost;
                    
                    if (altDistance < distances.get(edge.to)) {
                        distances.set(edge.to, altDistance);
                        previous.set(edge.to, currentNode);
                    }
                }
            }
        }

        // Reconstruct path
        if (!previous.has(endNodeId)) {
            return null; // No path found
        }

        const path = [];
        let currentNode = endNodeId;
        while (currentNode !== undefined) {
            path.unshift(currentNode);
            currentNode = previous.get(currentNode);
        }

        return path;
    }

    /**
     * Calculate terrain cost between two points based on terrain features
     */
    function getTerrainCostBetweenPoints(from, to) {
        // Check if path crosses unpassable/blocked areas
        const unpassableFeatures = bridge.state.terrain.features.filter(f => 
            f.properties.kind === 'unpassable' || f.properties.kind === 'blocked'
        );
        
        for (const feature of unpassableFeatures) {
            if (feature.geometry.type === 'Polygon') {
                // Simple line-polygon intersection check
                if (lineIntersectsPolygon([from.x, from.y], [to.x, to.y], feature.geometry.coordinates[0])) {
                    return Infinity; // Unpassable
                }
            }
        }
        
        // Check for difficult terrain (increases cost)
        const difficultFeatures = bridge.state.terrain.features.filter(f => f.properties.kind === 'difficult');
        
        for (const feature of difficultFeatures) {
            if (feature.geometry.type === 'Polygon') {
                // If path goes through difficult terrain, increase cost
                if (lineIntersectsPolygon([from.x, from.y], [to.x, to.y], feature.geometry.coordinates[0])) {
                    return TERRAIN_COSTS.difficult;
                }
            }
        }
        
        // Default terrain cost
        return TERRAIN_COSTS.normal;
    }

    /**
     * Simple line-polygon intersection test
     */
    function lineIntersectsPolygon(lineStart, lineEnd, polygon) {
        // Check if line intersects any edge of the polygon
        for (let i = 0; i < polygon.length - 1; i++) {
            if (linesIntersect(
                lineStart, lineEnd,
                polygon[i], polygon[i + 1]
            )) {
                return true;
            }
        }
        return false;
    }

    /**
     * Check if two line segments intersect
     */
    function linesIntersect(line1Start, line1End, line2Start, line2End) {
        const x1 = line1Start[0], y1 = line1Start[1];
        const x2 = line1End[0], y2 = line1End[1];
        const x3 = line2Start[0], y3 = line2Start[1];
        const x4 = line2End[0], y4 = line2End[1];

        const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
        if (denom === 0) return false; // Lines are parallel

        const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
        const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;

        return t >= 0 && t <= 1 && u >= 0 && u <= 1;
    }

    function calculateLegPath(start, end, onComplete) {
        const startNodeId = `marker_${start.id}`;
        const endNodeId = `marker_${end.id}`;
        
        // Run Dijkstra's algorithm to find shortest path
        const path = findShortestPath(routingGraph, startNodeId, endNodeId);
        
        const straightLineKm = computeDirectKm(start, end);
        
        if (path && path.length > 0) {
            // Convert node path to coordinate path
            const pixelPath = path.map(nodeId => {
                const node = routingGraph.nodes.get(nodeId);
                return [node.y, node.x]; // Leaflet expects [lat, lng] format
            });
            
            const polyline = L.polyline(pixelPath, { 
                color: 'red', 
                weight: 3, 
                pane: 'routePane' 
            }).addTo(bridge.map);
            
            bridge.state.routePolylines.push(polyline);
            const distanceKm = computePixelPathKm(pixelPath);
            bridge.state.routeLegs.push({ from: start, to: end, distanceKm });
            
            console.log(`Found path from ${start.name} to ${end.name}: ${distanceKm.toFixed(2)}km`);
        } else {
            // Check if straight line crosses unpassable terrain
            const terrainCost = getTerrainCostBetweenPoints(
                {x: start.x, y: start.y}, 
                {x: end.x, y: end.y}
            );
            
            if (terrainCost === Infinity) {
                // Can't use straight line either - mark as unreachable
                console.warn(`No path possible from ${start.name} to ${end.name} - blocked by unpassable terrain`);
                bridge.state.routeLegs.push({ 
                    from: start, 
                    to: end, 
                    distanceKm: 0, 
                    unreachable: true 
                });
            } else {
                // Fallback to straight line with terrain cost applied
                const straightPath = [[start.y, start.x], [end.y, end.x]];
                const adjustedDistance = straightLineKm * terrainCost;
                
                const polyline = L.polyline(straightPath, { 
                    color: terrainCost > 1 ? 'orange' : 'blue', 
                    weight: 3, 
                    dashArray: '5,5', 
                    pane: 'routePane' 
                }).addTo(bridge.map);
                
                bridge.state.routePolylines.push(polyline);
                bridge.state.routeLegs.push({ 
                    from: start, 
                    to: end, 
                    distanceKm: adjustedDistance, 
                    fallback: true,
                    terrainType: terrainCost > 1 ? 'difficult' : 'normal'
                });
                
                console.log(`Using fallback path from ${start.name} to ${end.name}: ${adjustedDistance.toFixed(2)}km (terrain cost: ${terrainCost})`);
            }
        }
        
        if (typeof onComplete === 'function') onComplete();
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
        const legsHtml = bridge.state.routeLegs.map((l,i)=>{
            let legInfo = `Leg ${i+1}: ${l.from.name} → ${l.to.name}: ${l.distanceKm.toFixed(2)} km`;
            if (l.unreachable) {
                legInfo += ' (BLOCKED!)';
            } else if (l.fallback) {
                if (l.terrainType === 'difficult') {
                    legInfo += ' (difficult terrain)';
                } else {
                    legInfo += ' (direct)';
                }
            }
            return `<li>${legInfo}</li>`;
        }).join('');
        
        const hasBlocked = bridge.state.routeLegs.some(l => l.unreachable);
        const hasTerrainPenalty = bridge.state.routeLegs.some(l => l.terrainType === 'difficult');
        
        let warningHtml = '';
        if (hasBlocked) {
            warningHtml = '<p class="route-warning">⚠️ Some destinations are unreachable due to terrain!</p>';
        } else if (hasTerrainPenalty) {
            warningHtml = '<p class="route-info">ℹ️ Route includes difficult terrain (longer travel time)</p>';
        }
        
        summaryDiv.innerHTML = `
            <h3>Route Summary</h3>
            ${warningHtml}
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

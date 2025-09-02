// map/js/routing.js - Graph-based pathfinding system

(function(window) {
    'use strict';

    // This will be initialized with the bridge object from the main script.
    let bridge = {};

    let routingGraph = null;
    let isCalculatingRoute = false; // Mutex to prevent concurrent calculations

    // Terrain costs for hybrid pathfinding system
    const TERRAIN_COSTS = {
        road: 1.0,       // Primary paths: roads are fastest (cost = 1)
        difficult: 5.0,  // Existing difficult terrain (matches DM mode)
        forest: 3.0,     // New forest terrain type (moderate difficulty)
        unpassable: Infinity, // Blocked areas (matches DM mode)
        normal: 2.0      // Default fallback terrain for empty areas
    };

    // Grid size for terrain-based pathfinding fallback (pixels)
    const TERRAIN_GRID_SIZE = 50;
    
    // Bridge connection distance threshold (pixels)
    const ROAD_CONNECTION_DISTANCE = 150;

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
        const nodes = new Map(); // nodeId -> {x, y, type, cost}
        const edges = []; // {from, to, cost, distance, type}
        const edgeMap = new Map(); // `${from}|${to}` -> edge
        
        console.log("Building hybrid multilayer routing graph...");
        
        // === ROADS LAYER ===
        // Add all road features as a high-priority network
        const roadFeatures = bridge.state.terrain.features.filter(f => f.properties.kind === 'road');
        const roadNodes = new Map(); // Track road intersections
        
        roadFeatures.forEach((roadFeature, roadIndex) => {
            if (roadFeature.geometry.type !== 'LineString') return;
            
            const coordinates = roadFeature.geometry.coordinates;
            
            // Create nodes for each point in the road
            coordinates.forEach((coord, coordIndex) => {
                const nodeId = `road_${roadIndex}_${coordIndex}`;
                nodes.set(nodeId, {
                    x: coord[0],
                    y: coord[1],
                    type: 'road_node',
                    roadIndex,
                    coordIndex
                });
                
                // Track for intersection detection
                const posKey = `${Math.round(coord[0])},${Math.round(coord[1])}`;
                if (!roadNodes.has(posKey)) {
                    roadNodes.set(posKey, []);
                }
                roadNodes.get(posKey).push(nodeId);
            });
            
            // Create edges between consecutive road points
            for (let i = 0; i < coordinates.length - 1; i++) {
                const fromId = `road_${roadIndex}_${i}`;
                const toId = `road_${roadIndex}_${i + 1}`;
                const from = coordinates[i];
                const to = coordinates[i + 1];
                
                const distance = Math.sqrt(
                    Math.pow(to[0] - from[0], 2) + 
                    Math.pow(to[1] - from[1], 2)
                );
                
                // Roads have cost = 1 (primary paths)
                const fwd = { from: fromId, to: toId, cost: TERRAIN_COSTS.road, distance, type: 'road' };
                const rev = { from: toId, to: fromId, cost: TERRAIN_COSTS.road, distance, type: 'road' };
                edges.push(fwd, rev);
                edgeMap.set(`${fromId}|${toId}`, fwd);
                edgeMap.set(`${toId}|${fromId}`, rev);
            }
        });
        
        // Connect road intersections (where roads cross or meet)
        for (let [posKey, nodeIds] of roadNodes) {
            if (nodeIds.length > 1) {
                // Create connections between all road nodes at this position
                for (let i = 0; i < nodeIds.length; i++) {
                    for (let j = i + 1; j < nodeIds.length; j++) {
                        const fromId = nodeIds[i];
                        const toId = nodeIds[j];
                        
                        // Zero-cost transition between road networks at intersections
                        const fwd = { from: fromId, to: toId, cost: 0, distance: 0, type: 'road_intersection' };
                        const rev = { from: toId, to: fromId, cost: 0, distance: 0, type: 'road_intersection' };
                        edges.push(fwd, rev);
                        edgeMap.set(`${fromId}|${toId}`, fwd);
                        edgeMap.set(`${toId}|${fromId}`, rev);
                    }
                }
            }
        }
        
        // === TERRAIN GRID LAYER ===
        // Create a grid of terrain nodes as fallback pathfinding layer
        const mapBounds = getMapBounds();
        const terrainNodes = new Map();
        
        for (let x = mapBounds.minX; x <= mapBounds.maxX; x += TERRAIN_GRID_SIZE) {
            for (let y = mapBounds.minY; y <= mapBounds.maxY; y += TERRAIN_GRID_SIZE) {
                const nodeId = `terrain_${Math.round(x)}_${Math.round(y)}`;
                const terrainCost = getTerrainCostAtPoint(x, y);
                
                // Only add passable terrain nodes
                if (terrainCost < Infinity) {
                    nodes.set(nodeId, {
                        x: x,
                        y: y,
                        type: 'terrain_node',
                        terrainCost: terrainCost
                    });
                    terrainNodes.set(`${Math.round(x)},${Math.round(y)}`, nodeId);
                }
            }
        }
        
        // Connect adjacent terrain grid nodes
        for (let [posKey, nodeId] of terrainNodes) {
            const [x, y] = posKey.split(',').map(Number);
            const node = nodes.get(nodeId);
            
            // Check 8-directional neighbors
            const neighbors = [
                [x + TERRAIN_GRID_SIZE, y], // right
                [x - TERRAIN_GRID_SIZE, y], // left
                [x, y + TERRAIN_GRID_SIZE], // down
                [x, y - TERRAIN_GRID_SIZE], // up
                [x + TERRAIN_GRID_SIZE, y + TERRAIN_GRID_SIZE], // diagonal
                [x - TERRAIN_GRID_SIZE, y - TERRAIN_GRID_SIZE], // diagonal
                [x + TERRAIN_GRID_SIZE, y - TERRAIN_GRID_SIZE], // diagonal
                [x - TERRAIN_GRID_SIZE, y + TERRAIN_GRID_SIZE]  // diagonal
            ];
            
            neighbors.forEach(([nx, ny]) => {
                const neighborKey = `${nx},${ny}`;
                const neighborId = terrainNodes.get(neighborKey);
                
                if (neighborId) {
                    const neighborNode = nodes.get(neighborId);
                    const distance = Math.sqrt(
                        Math.pow(nx - x, 2) + Math.pow(ny - y, 2)
                    );
                    
                    // Cost is the average of the two nodes' terrain costs
                    const avgCost = (node.terrainCost + neighborNode.terrainCost) / 2;
                    
                    const edge = {
                        from: nodeId,
                        to: neighborId,
                        cost: avgCost,
                        distance: distance,
                        type: 'terrain'
                    };
                    
                    edges.push(edge);
                    edgeMap.set(`${nodeId}|${neighborId}`, edge);
                }
            });
        }
        
        // === MARKERS LAYER ===
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
        
        // === BRIDGE CONNECTIONS ===
        // Connect markers to road network (primary connections)
        bridge.state.markers.forEach(marker => {
            const markerNodeId = `marker_${marker.id}`;
            const markerPos = { x: marker.x, y: marker.y };
            
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
            
            // Connect to road if within reasonable distance
            if (closestRoadNode && closestDistance < ROAD_CONNECTION_DISTANCE) {
                const connectionCost = getTerrainCostBetweenPoints(markerPos, nodes.get(closestRoadNode));
                
                const fwd = { 
                    from: markerNodeId, 
                    to: closestRoadNode, 
                    cost: connectionCost, 
                    distance: closestDistance,
                    type: 'road_bridge'
                };
                const rev = { 
                    from: closestRoadNode, 
                    to: markerNodeId, 
                    cost: connectionCost, 
                    distance: closestDistance,
                    type: 'road_bridge'
                };
                
                edges.push(fwd, rev);
                edgeMap.set(`${markerNodeId}|${closestRoadNode}`, fwd);
                edgeMap.set(`${closestRoadNode}|${markerNodeId}`, rev);
            }
            
            // Connect markers to terrain grid (fallback connections)
            const gridX = Math.round(marker.x / TERRAIN_GRID_SIZE) * TERRAIN_GRID_SIZE;
            const gridY = Math.round(marker.y / TERRAIN_GRID_SIZE) * TERRAIN_GRID_SIZE;
            const terrainNodeId = terrainNodes.get(`${gridX},${gridY}`);
            
            if (terrainNodeId) {
                const terrainNode = nodes.get(terrainNodeId);
                const distance = Math.sqrt(
                    Math.pow(terrainNode.x - marker.x, 2) + 
                    Math.pow(terrainNode.y - marker.y, 2)
                );
                
                const connectionCost = getTerrainCostBetweenPoints(markerPos, terrainNode);
                
                const fwd = {
                    from: markerNodeId,
                    to: terrainNodeId,
                    cost: connectionCost,
                    distance: distance,
                    type: 'terrain_bridge'
                };
                const rev = {
                    from: terrainNodeId,
                    to: markerNodeId,
                    cost: connectionCost,
                    distance: distance,
                    type: 'terrain_bridge'
                };
                
                edges.push(fwd, rev);
                edgeMap.set(`${markerNodeId}|${terrainNodeId}`, fwd);
                edgeMap.set(`${terrainNodeId}|${markerNodeId}`, rev);
            }
        });
        
        routingGraph = { nodes, edges, edgeMap };
        console.log(`Built graph with ${nodes.size} nodes and ${edges.length} edges`);
    }

    /**
     * Get map bounds for terrain grid generation
     */
    function getMapBounds() {
        // Default bounds - could be enhanced to use actual map data
        return {
            minX: 0,
            maxX: 2500,
            minY: 0,
            maxY: 2500
        };
    }

    /**
     * Get terrain cost at a specific point
     */
    function getTerrainCostAtPoint(x, y) {
        // Check if point is in any unpassable areas
        const unpassableFeatures = bridge.state.terrain.features.filter(f => 
            f.properties.kind === 'unpassable' || f.properties.kind === 'blocked'
        );
        
        for (const feature of unpassableFeatures) {
            if (feature.geometry.type === 'Polygon') {
                if (pointInPolygon([x, y], feature.geometry.coordinates[0])) {
                    return Infinity; // Unpassable
                }
            }
        }
        
        // Check for different terrain types (matching what's available in DM mode)
        const difficultFeatures = bridge.state.terrain.features.filter(f => 
            ['difficult', 'forest'].includes(f.properties.kind)
        );
        
        for (const feature of difficultFeatures) {
            if (feature.geometry.type === 'Polygon') {
                if (pointInPolygon([x, y], feature.geometry.coordinates[0])) {
                    // Map terrain types to costs
                    const kind = feature.properties.kind;
                    return TERRAIN_COSTS[kind] || TERRAIN_COSTS.difficult;
                }
            }
        }
        
        // Default to normal terrain (open areas)
        return TERRAIN_COSTS.normal;
    }

    /**
     * Check if point is inside polygon
     */
    function pointInPolygon(point, polygon) {
        const [x, y] = point;
        let inside = false;
        
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const [xi, yi] = polygon[i];
            const [xj, yj] = polygon[j];
            
            if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
                inside = !inside;
            }
        }
        
        return inside;
    }

    /**
     * A* algorithm implementation for efficient pathfinding
     */
    function findShortestPathAStar(graph, startNodeId, endNodeId) {
        if (!graph.nodes.has(startNodeId) || !graph.nodes.has(endNodeId)) {
            console.warn(`Node not found: start=${startNodeId}, end=${endNodeId}`);
            return null;
        }

        const startNode = graph.nodes.get(startNodeId);
        const endNode = graph.nodes.get(endNodeId);
        
        // A* data structures
        const openSet = new Set([startNodeId]);
        const cameFrom = new Map();
        const gScore = new Map(); // Cost from start to node
        const fScore = new Map(); // gScore + heuristic

        // Initialize scores
        for (let nodeId of graph.nodes.keys()) {
            gScore.set(nodeId, Infinity);
            fScore.set(nodeId, Infinity);
        }
        gScore.set(startNodeId, 0);
        fScore.set(startNodeId, heuristic(startNode, endNode));

        while (openSet.size > 0) {
            // Find node in openSet with lowest fScore
            let current = null;
            let lowestF = Infinity;
            for (let nodeId of openSet) {
                const f = fScore.get(nodeId);
                if (f < lowestF) {
                    lowestF = f;
                    current = nodeId;
                }
            }

            if (current === endNodeId) {
                // Reconstruct path
                const path = [];
                let node = current;
                while (node !== undefined) {
                    path.unshift(node);
                    node = cameFrom.get(node);
                }
                return path;
            }

            openSet.delete(current);
            
            // Check all neighbors
            for (let edge of graph.edges) {
                if (edge.from === current) {
                    const neighbor = edge.to;
                    const tentativeGScore = gScore.get(current) + (edge.distance * edge.cost);
                    
                    if (tentativeGScore < gScore.get(neighbor)) {
                        cameFrom.set(neighbor, current);
                        gScore.set(neighbor, tentativeGScore);
                        
                        const neighborNode = graph.nodes.get(neighbor);
                        fScore.set(neighbor, tentativeGScore + heuristic(neighborNode, endNode));
                        
                        if (!openSet.has(neighbor)) {
                            openSet.add(neighbor);
                        }
                    }
                }
            }
        }

        return null; // No path found
    }

    /**
     * Heuristic function for A* (Euclidean distance)
     */
    function heuristic(nodeA, nodeB) {
        return Math.sqrt(
            Math.pow(nodeB.x - nodeA.x, 2) + 
            Math.pow(nodeB.y - nodeA.y, 2)
        );
    }

    /**
     * Dijkstra's algorithm implementation for pathfinding (fallback)
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
        
        console.log(`Calculating path from ${start.name} to ${end.name}`);
        
        // Use A* algorithm for efficient pathfinding across the hybrid graph
        const graphPath = findShortestPathAStar(routingGraph, startNodeId, endNodeId);
        
        if (!graphPath || graphPath.length === 0) {
            console.warn(`No path found between ${start.name} and ${end.name}`);
            bridge.state.routeLegs.push({ 
                from: start, 
                to: end, 
                distanceKm: 0, 
                unreachable: true 
            });
            if (typeof onComplete === 'function') onComplete();
            return;
        }
        
        // Convert path to pixel coordinates and analyze path segments
        const pathSegments = analyzePathSegments(graphPath);
        const totalCostKm = computeGraphPathCost(graphPath);
        
        // Render path with different styles for roads vs terrain
        renderHybridPath(pathSegments);
        
        // Add leg to route
        bridge.state.routeLegs.push({ 
            from: start, 
            to: end, 
            distanceKm: totalCostKm, 
            hybrid: true,
            segments: pathSegments
        });
        
        if (typeof onComplete === 'function') onComplete();
    }

    /**
     * Analyze path segments to distinguish between road and terrain traversal
     */
    function analyzePathSegments(pathIds) {
        const segments = [];
        let currentSegment = null;
        
        for (let i = 0; i < pathIds.length; i++) {
            const nodeId = pathIds[i];
            const node = routingGraph.nodes.get(nodeId);
            const point = [node.y, node.x]; // Leaflet uses [lat, lng]
            
            // Determine segment type based on next edge
            let segmentType = 'terrain';
            if (i < pathIds.length - 1) {
                const nextNodeId = pathIds[i + 1];
                const edgeKey = `${nodeId}|${nextNodeId}`;
                const edge = routingGraph.edgeMap.get(edgeKey);
                
                if (edge && (edge.type === 'road' || edge.type === 'road_intersection')) {
                    segmentType = 'road';
                } else if (edge && edge.type.includes('bridge')) {
                    segmentType = 'bridge';
                }
            }
            
            // Group consecutive points of the same type
            if (!currentSegment || currentSegment.type !== segmentType) {
                if (currentSegment) {
                    segments.push(currentSegment);
                }
                currentSegment = {
                    type: segmentType,
                    points: [point]
                };
            } else {
                currentSegment.points.push(point);
            }
        }
        
        if (currentSegment) {
            segments.push(currentSegment);
        }
        
        return segments;
    }

    /**
     * Render hybrid path with different styles for different segment types
     */
    function renderHybridPath(segments) {
        segments.forEach(segment => {
            if (segment.points.length < 2) return;
            
            let style;
            switch (segment.type) {
                case 'road':
                    style = { 
                        color: '#2563eb', // Blue for roads
                        weight: 4, 
                        opacity: 0.9,
                        pane: 'routePane'
                    };
                    break;
                case 'terrain':
                    style = { 
                        color: '#dc2626', // Red for terrain traversal
                        weight: 3, 
                        opacity: 0.8,
                        dashArray: '8, 8', // Dashed for off-road
                        pane: 'routePane'
                    };
                    break;
                case 'bridge':
                    style = { 
                        color: '#7c3aed', // Purple for bridges
                        weight: 3, 
                        opacity: 0.7,
                        dashArray: '4, 4',
                        pane: 'routePane'
                    };
                    break;
                default:
                    style = { 
                        color: '#6b7280', // Gray fallback
                        weight: 2, 
                        opacity: 0.6,
                        pane: 'routePane'
                    };
            }
            
            const polyline = L.polyline(segment.points, style).addTo(bridge.map);
            bridge.state.routePolylines.push(polyline);
        });
    }

    /**
     * Compute total cost of graph path in kilometers
     */
    function computeGraphPathCost(pathIds) {
        if (!pathIds || pathIds.length < 2) return 0;
        
        let totalCostPx = 0;
        
        for (let i = 1; i < pathIds.length; i++) {
            const edgeKey = `${pathIds[i-1]}|${pathIds[i]}`;
            const edge = routingGraph.edgeMap.get(edgeKey);
            
            if (!edge) {
                console.warn(`Missing edge: ${edgeKey}`);
                return Infinity;
            }
            
            totalCostPx += edge.distance * edge.cost;
        }
        
        return totalCostPx * bridge.config.kmPerPixel;
    }

    // Compute effective km of graph path using edge cost * distance
    function computeGraphPathEffectiveKm(pathIds) {
        if (!pathIds || pathIds.length < 2) return Infinity;
        let costPxWeighted = 0;
        for (let i = 1; i < pathIds.length; i++) {
            const key = `${pathIds[i-1]}|${pathIds[i]}`;
            const edge = routingGraph.edgeMap.get(key);
            if (!edge) return Infinity;
            costPxWeighted += edge.distance * edge.cost;
        }
        return costPxWeighted * bridge.config.kmPerPixel;
    }

    function updateRouteSummaryFromLegs() {
        const summaryDiv = document.getElementById('route-summary');
        if (!summaryDiv) return;
        if (!bridge.state.routeLegs.length) { 
            updateRouteSummaryEmpty(); 
            return; 
        }
        
        const totalKm = bridge.state.routeLegs.reduce((a, l) => a + l.distanceKm, 0);
        const hasUnreachable = bridge.state.routeLegs.some(l => l.unreachable);
        
        // Analyze route composition
        let roadKm = 0;
        let terrainKm = 0;
        let bridgeKm = 0;
        
        bridge.state.routeLegs.forEach(leg => {
            if (leg.segments) {
                leg.segments.forEach(segment => {
                    const segmentDistance = computeSegmentDistance(segment.points);
                    switch (segment.type) {
                        case 'road':
                            roadKm += segmentDistance;
                            break;
                        case 'terrain':
                            terrainKm += segmentDistance;
                            break;
                        case 'bridge':
                            bridgeKm += segmentDistance;
                            break;
                    }
                });
            }
        });
        
        const legsHtml = bridge.state.routeLegs.map((l, i) => {
            let legInfo = `Leg ${i + 1}: ${l.from.name} → ${l.to.name}: ${l.distanceKm.toFixed(2)} km`;
            
            if (l.unreachable) {
                legInfo += ' <span class="route-status blocked">BLOCKED!</span>';
            } else if (l.hybrid) {
                legInfo += ' <span class="route-status hybrid">hybrid route</span>';
            } else if (l.fallback) {
                legInfo += ' <span class="route-status terrain">direct terrain</span>';
            }
            
            return `<li>${legInfo}</li>`;
        }).join('');
        
        // Generate warnings and info
        let alertsHtml = '';
        if (hasUnreachable) {
            alertsHtml += '<div class="route-alert warning">⚠️ Some destinations are unreachable due to terrain barriers!</div>';
        } else if (terrainKm > roadKm) {
            alertsHtml += '<div class="route-alert info">ℹ️ Route primarily uses off-road terrain (slower travel)</div>';
        } else if (terrainKm > 0) {
            alertsHtml += '<div class="route-alert info">ℹ️ Route includes some off-road terrain sections</div>';
        }
        
        // Route composition breakdown
        const compositionHtml = `
            <div class="route-composition">
                <h4>Route Composition</h4>
                <div class="composition-item road">
                    <span class="composition-color" style="background-color: #2563eb;"></span>
                    Roads: ${roadKm.toFixed(1)} km (${((roadKm / totalKm) * 100).toFixed(0)}%)
                </div>
                <div class="composition-item terrain">
                    <span class="composition-color" style="background-color: #dc2626;"></span>
                    Off-road: ${terrainKm.toFixed(1)} km (${((terrainKm / totalKm) * 100).toFixed(0)}%)
                </div>
                ${bridgeKm > 0 ? `
                <div class="composition-item bridge">
                    <span class="composition-color" style="background-color: #7c3aed;"></span>
                    Connections: ${bridgeKm.toFixed(1)} km (${((bridgeKm / totalKm) * 100).toFixed(0)}%)
                </div>` : ''}
            </div>
        `;
        
        summaryDiv.innerHTML = `
            <h3>Hybrid Route Summary</h3>
            ${alertsHtml}
            <div class="route-totals">
                <p><strong>Total Distance:</strong> ${totalKm.toFixed(2)} km</p>
                ${compositionHtml}
            </div>
            <div class="route-legs">
                <h4>Route Legs</h4>
                <ul>${legsHtml}</ul>
            </div>
            <div class="travel-times">
                <h4>Estimated Travel Times</h4>
                <div class="travel-time-item">
                    <strong>Walking:</strong> ${(totalKm / bridge.config.profiles.walk.speed).toFixed(1)} days
                </div>
                <div class="travel-time-item">
                    <strong>Wagon:</strong> ${(totalKm / bridge.config.profiles.wagon.speed).toFixed(1)} days
                    ${terrainKm > 0 ? '<small>(+25% for off-road sections)</small>' : ''}
                </div>
                <div class="travel-time-item">
                    <strong>Horse:</strong> ${(totalKm / bridge.config.profiles.horse.speed).toFixed(1)} days
                    ${terrainKm > 0 ? '<small>(+15% for off-road sections)</small>' : ''}
                </div>
            </div>
        `;
        
        // Add some basic styling
        if (!document.getElementById('hybrid-routing-styles')) {
            const style = document.createElement('style');
            style.id = 'hybrid-routing-styles';
            style.textContent = `
                .route-alert { padding: 8px 12px; margin: 8px 0; border-radius: 4px; font-size: 14px; }
                .route-alert.warning { background: #fef3c7; border: 1px solid #f59e0b; color: #92400e; }
                .route-alert.info { background: #dbeafe; border: 1px solid #3b82f6; color: #1e40af; }
                .route-status { font-size: 11px; padding: 2px 6px; border-radius: 3px; color: white; }
                .route-status.blocked { background: #dc2626; }
                .route-status.hybrid { background: #059669; }
                .route-status.terrain { background: #d97706; }
                .route-composition { margin: 10px 0; }
                .composition-item { display: flex; align-items: center; margin: 4px 0; font-size: 13px; }
                .composition-color { width: 12px; height: 12px; margin-right: 8px; border-radius: 2px; }
                .route-totals, .route-legs, .travel-times { margin: 12px 0; }
                .travel-time-item { margin: 4px 0; }
                .travel-time-item small { color: #666; display: block; margin-left: 20px; }
            `;
            document.head.appendChild(style);
        }
    }

    /**
     * Compute distance of a path segment in kilometers
     */
    function computeSegmentDistance(points) {
        if (!points || points.length < 2) return 0;
        
        let totalDistancePx = 0;
        for (let i = 1; i < points.length; i++) {
            const dx = points[i][1] - points[i-1][1]; // x coordinates
            const dy = points[i][0] - points[i-1][0]; // y coordinates (lat)
            totalDistancePx += Math.sqrt(dx * dx + dy * dy);
        }
        
        return totalDistancePx * bridge.config.kmPerPixel;
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

// map/js/routing/graph-builder.js - Graph construction module

(function(window) {
    'use strict';

    // This will be set by the main routing module
    let bridge = {};
    let TERRAIN_COSTS = {};
    let TERRAIN_GRID_SIZE = 50;
    let ROAD_CONNECTION_DISTANCE = 150;

    // Terrain utility functions (will be imported)
    let getTerrainCostAtPoint, getTerrainCostBetweenPoints;

    /**
     * Initialize the graph builder with dependencies
     */
    function initGraphBuilder(bridgeObj, terrainCosts, gridSize, roadDistance, terrainUtils) {
        bridge = bridgeObj;
        TERRAIN_COSTS = terrainCosts;
        TERRAIN_GRID_SIZE = gridSize;
        ROAD_CONNECTION_DISTANCE = roadDistance;
        getTerrainCostAtPoint = terrainUtils.getTerrainCostAtPoint;
        getTerrainCostBetweenPoints = terrainUtils.getTerrainCostBetweenPoints;
    }

    /**
     * Build the complete hybrid multilayer routing graph
     */
    function buildRoutingGraph() {
        const nodes = new Map(); // nodeId -> {x, y, type, cost}
        const edges = []; // {from, to, cost, distance, type}
        const edgeMap = new Map(); // `${from}|${to}` -> edge
        
        console.log("Building hybrid multilayer routing graph...");
        
        // Build each layer of the graph
        buildRoadsLayer(nodes, edges, edgeMap);
        buildTerrainGridLayer(nodes, edges, edgeMap);
        buildMarkersLayer(nodes);
        buildBridgeConnections(nodes, edges, edgeMap);
        
        const graph = { nodes, edges, edgeMap };
        console.log(`Built graph with ${nodes.size} nodes and ${edges.length} edges`);
        return graph;
    }

    /**
     * Build the roads layer - high-priority road network
     */
    function buildRoadsLayer(nodes, edges, edgeMap) {
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
        connectRoadIntersections(roadNodes, edges, edgeMap);
    }

    /**
     * Connect road intersections where multiple roads meet
     */
    function connectRoadIntersections(roadNodes, edges, edgeMap) {
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
    }

    /**
     * Build terrain grid layer - fallback pathfinding network
     */
    function buildTerrainGridLayer(nodes, edges, edgeMap) {
        const mapBounds = getMapBounds();
        const terrainNodes = new Map();
        
        // Create terrain grid nodes (include all nodes, even high-cost ones)
        for (let x = mapBounds.minX; x <= mapBounds.maxX; x += TERRAIN_GRID_SIZE) {
            for (let y = mapBounds.minY; y <= mapBounds.maxY; y += TERRAIN_GRID_SIZE) {
                const nodeId = `terrain_${Math.round(x)}_${Math.round(y)}`;
                const terrainCost = getTerrainCostAtPoint(x, y);
                
                // Add all nodes, even high-cost ones (no infinite costs anymore)
                nodes.set(nodeId, {
                    x: x,
                    y: y,
                    type: 'terrain_node',
                    terrainCost: terrainCost
                });
                terrainNodes.set(`${Math.round(x)},${Math.round(y)}`, nodeId);
            }
        }
        
        // Connect adjacent terrain grid nodes
        connectTerrainNodes(terrainNodes, nodes, edges, edgeMap);
    }

    /**
     * Connect adjacent terrain grid nodes
     */
    function connectTerrainNodes(terrainNodes, nodes, edges, edgeMap) {
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
    }

    /**
     * Build markers layer - add all map markers as nodes
     */
    function buildMarkersLayer(nodes) {
        console.log(`Building markers layer with ${bridge.state.markers.length} markers`);
        bridge.state.markers.forEach(marker => {
            const nodeId = `marker_${marker.id}`;
            console.log(`Adding marker node: ${nodeId} (${marker.name}) at (${marker.x}, ${marker.y}) isWaypoint: ${marker.isWaypoint}`);
            nodes.set(nodeId, {
                x: marker.x,
                y: marker.y,
                type: 'marker',
                markerId: marker.id,
                isWaypoint: marker.isWaypoint || false
            });
        });
        console.log(`Markers layer built with ${nodes.size} total nodes`);
    }

    /**
     * Build bridge connections - connect markers to road and terrain layers
     */
    function buildBridgeConnections(nodes, edges, edgeMap) {
        console.log(`Building bridge connections for ${bridge.state.markers.length} markers`);
        bridge.state.markers.forEach(marker => {
            console.log(`Connecting marker ${marker.name} (${marker.id}) to road and terrain layers`);
            connectMarkerToRoads(marker, nodes, edges, edgeMap);
            connectMarkerToTerrain(marker, nodes, edges, edgeMap);
        });
    }

    /**
     * Connect marker to nearest road network
     */
    function connectMarkerToRoads(marker, nodes, edges, edgeMap) {
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
    }

    /**
     * Connect marker to terrain grid
     */
    function connectMarkerToTerrain(marker, nodes, edges, edgeMap) {
        const markerNodeId = `marker_${marker.id}`;
        const markerPos = { x: marker.x, y: marker.y };
        
        // Try multiple connection strategies for better connectivity
        const connectionsAttempted = [];
        
        // Strategy 1: Connect to nearest grid point
        const gridX = Math.round(marker.x / TERRAIN_GRID_SIZE) * TERRAIN_GRID_SIZE;
        const gridY = Math.round(marker.y / TERRAIN_GRID_SIZE) * TERRAIN_GRID_SIZE;
        const terrainNodeId = `terrain_${gridX}_${gridY}`;
        
        if (nodes.has(terrainNodeId)) {
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
            connectionsAttempted.push(terrainNodeId);
        }
        
        // Strategy 2: Connect to surrounding grid points for redundancy
        const offsets = [
            [-TERRAIN_GRID_SIZE, 0], [TERRAIN_GRID_SIZE, 0],   // horizontal neighbors
            [0, -TERRAIN_GRID_SIZE], [0, TERRAIN_GRID_SIZE],   // vertical neighbors
            [-TERRAIN_GRID_SIZE, -TERRAIN_GRID_SIZE], [TERRAIN_GRID_SIZE, TERRAIN_GRID_SIZE], // diagonals
            [-TERRAIN_GRID_SIZE, TERRAIN_GRID_SIZE], [TERRAIN_GRID_SIZE, -TERRAIN_GRID_SIZE]
        ];
        
        offsets.forEach(([dx, dy]) => {
            const neighborX = gridX + dx;
            const neighborY = gridY + dy;
            const neighborNodeId = `terrain_${neighborX}_${neighborY}`;
            
            if (nodes.has(neighborNodeId) && !connectionsAttempted.includes(neighborNodeId)) {
                const neighborNode = nodes.get(neighborNodeId);
                const distance = Math.sqrt(
                    Math.pow(neighborNode.x - marker.x, 2) + 
                    Math.pow(neighborNode.y - marker.y, 2)
                );
                
                // Only connect to nearby neighbors to avoid overly long connections
                if (distance <= TERRAIN_GRID_SIZE * 1.5) {
                    const connectionCost = getTerrainCostBetweenPoints(markerPos, neighborNode);
                    
                    const fwd = {
                        from: markerNodeId,
                        to: neighborNodeId,
                        cost: connectionCost,
                        distance: distance,
                        type: 'terrain_bridge_backup'
                    };
                    const rev = {
                        from: neighborNodeId,
                        to: markerNodeId,
                        cost: connectionCost,
                        distance: distance,
                        type: 'terrain_bridge_backup'
                    };
                    
                    edges.push(fwd, rev);
                    edgeMap.set(`${markerNodeId}|${neighborNodeId}`, fwd);
                    edgeMap.set(`${neighborNodeId}|${markerNodeId}`, rev);
                    connectionsAttempted.push(neighborNodeId);
                }
            }
        });
        
        if (connectionsAttempted.length === 0) {
            console.warn(`⚠️ Failed to connect marker ${marker.name} to terrain grid - trying emergency connections`);
            
            // Emergency fallback: try connecting to ANY nearby terrain node
            for (let [nodeId, node] of nodes) {
                if (node.type === 'terrain_node') {
                    const distance = Math.sqrt(
                        Math.pow(node.x - marker.x, 2) + 
                        Math.pow(node.y - marker.y, 2)
                    );
                    
                    if (distance <= TERRAIN_GRID_SIZE * 3) { // Expanded search radius
                        const connectionCost = getTerrainCostBetweenPoints(markerPos, node);
                        
                        const fwd = {
                            from: markerNodeId,
                            to: nodeId,
                            cost: connectionCost,
                            distance: distance,
                            type: 'terrain_bridge_emergency'
                        };
                        const rev = {
                            from: nodeId,
                            to: markerNodeId,
                            cost: connectionCost,
                            distance: distance,
                            type: 'terrain_bridge_emergency'
                        };
                        
                        edges.push(fwd, rev);
                        edgeMap.set(`${markerNodeId}|${nodeId}`, fwd);
                        edgeMap.set(`${nodeId}|${markerNodeId}`, rev);
                        connectionsAttempted.push(nodeId);
                        
                        console.log(`✅ Emergency connected ${marker.name} to terrain node ${nodeId} (distance: ${distance.toFixed(1)})`);
                        break; // Only need one emergency connection
                    }
                }
            }
        }
        
        if (connectionsAttempted.length === 0) {
            console.error(`❌ CRITICAL: Failed to connect marker ${marker.name} to ANY terrain nodes!`);
        } else {
            console.log(`✅ Connected marker ${marker.name} to ${connectionsAttempted.length} terrain nodes`);
        }
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

    // Expose module functions
    window.__nimea_graph_builder = {
        initGraphBuilder,
        buildRoutingGraph
    };

})(window);
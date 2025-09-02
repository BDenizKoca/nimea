// map/js/routing.js - Core routing system with modular architecture

(function(window) {
    'use strict';

    // Bridge object will be initialized from main script
    let bridge = {};

    // Routing modules
    let graphBuilder = null;
    let pathfinding = null;
    let terrainUtils = null;
    let visualizer = null;
    let pathNaturalizer = null;

    // Routing state
    let routingGraph = null;
    let isCalculatingRoute = false; // Mutex to prevent concurrent calculations
    let waypointCounter = 0; // Counter for waypoint naming

    // Configuration constants
    const TERRAIN_COSTS = {
        road: 1.0,       // Primary paths: roads are fastest (cost = 1)
        difficult: 5.0,  // Existing difficult terrain (matches DM mode)
        forest: 3.0,     // New forest terrain type (moderate difficulty)
        unpassable: 50.0, // High cost but not infinite - allow pathfinding around
        blocked: 50.0,   // High cost but not infinite - allow pathfinding around
        normal: 2.0      // Default fallback terrain for empty areas
    };

    const TERRAIN_GRID_SIZE = 25;  // Denser grid for better connectivity
    const ROAD_CONNECTION_DISTANCE = 300; // Increased range for road connections

    /**
     * Initialize routing system with all dependencies
     */
    function initRouting(map) {
        bridge = window.__nimea;
        if (!bridge) {
            console.error("Routing module requires the global bridge.");
            return;
        }

        // Initialize sub-modules
        graphBuilder = window.__nimea_graph_builder;
        pathfinding = window.__nimea_pathfinding;
        terrainUtils = window.__nimea_terrain_utils;
        visualizer = window.__nimea_visualizer;
        pathNaturalizer = window.__nimea_path_naturalizer;

        if (!graphBuilder || !pathfinding || !terrainUtils || !visualizer || !pathNaturalizer) {
            console.error("Routing modules not loaded. Required: graph-builder, pathfinding, terrain-utils, visualizer, path-naturalizer");
            return;
        }

        // Initialize modules with dependencies
        graphBuilder.initGraphBuilder(bridge, TERRAIN_COSTS, TERRAIN_GRID_SIZE, ROAD_CONNECTION_DISTANCE, terrainUtils);
        terrainUtils.initTerrainUtils(bridge, TERRAIN_COSTS);
        pathNaturalizer.initPathNaturalizer(bridge, terrainUtils);
        visualizer.initVisualizer(bridge);
        
        // Expose public functions on the bridge
        bridge.routingModule = {
            addToRoute,
            recomputeRoute,
            invalidateGraph,
            createWaypoint,
            deleteWaypoint,
            initRouting: () => { /* no-op, already initialized */ }
        };
        
        console.log("Routing module initialized with modular architecture.");
    }

    /**
     * Create a temporary waypoint at the given coordinates
     */
    function createWaypoint(lat, lng) {
        if (bridge.state.isDmMode) {
            return; // waypoints disabled in DM mode
        }

        waypointCounter++;
        const waypoint = {
            id: `waypoint_${waypointCounter}`,
            name: `Waypoint ${waypointCounter}`,
            x: lng,
            y: lat,
            isWaypoint: true
        };

        // Add waypoint to markers for routing purposes
        bridge.state.markers.push(waypoint);
        
        // Create visual marker on map
        const icon = L.divIcon({
            html: `<div class="waypoint-marker">${waypointCounter}</div>`,
            className: 'waypoint-icon',
            iconSize: [24, 24],
            iconAnchor: [12, 12]
        });
        
        const marker = L.marker([lat, lng], { icon }).addTo(bridge.map);
        
        // Click to delete waypoint
        marker.on('click', () => {
            if (confirm(`Delete ${waypoint.name}?`)) {
                deleteWaypoint(waypoint.id, marker);
            }
        });

        // Store reference to marker on waypoint
        waypoint.marker = marker;

        return waypoint;
    }

    /**
     * Delete a waypoint
     */
    function deleteWaypoint(waypointId, marker) {
        // Remove from markers array
        const markerIndex = bridge.state.markers.findIndex(m => m.id === waypointId);
        if (markerIndex > -1) {
            bridge.state.markers.splice(markerIndex, 1);
        }

        // Remove from route if it's there
        const routeIndex = bridge.state.route.findIndex(r => r.id === waypointId);
        if (routeIndex > -1) {
            bridge.state.route.splice(routeIndex, 1);
            recomputeRoute();
        }

        // Remove from map
        if (marker) {
            bridge.map.removeLayer(marker);
        }

        // Invalidate routing graph to rebuild without this waypoint
        invalidateGraph();
    }

    /**
     * Invalidates the cached routing graph.
     * Called by the DM module when terrain is updated.
     */
    function invalidateGraph() {
        routingGraph = null;
        console.log("Routing graph invalidated");
    }

    /**
     * Add marker to route and open route sidebar
     */
    function addToRoute(marker) {
        if (bridge.state.isDmMode) {
            return; // routing disabled in DM mode
        }

        bridge.state.route.push(marker);
        
        const routeSidebar = document.getElementById('route-sidebar');
        const reopenRouteSidebarBtn = document.getElementById('reopen-route-sidebar');
        if (routeSidebar) {
            routeSidebar.classList.add('open');
            // Hide reopen button when sidebar opens
            if (reopenRouteSidebarBtn) {
                reopenRouteSidebarBtn.classList.add('hidden');
            }
        }
        
        recomputeRoute();
    }

    /**
     * Update route display with current stops and drag-drop support
     */
    function updateRouteDisplay() {
        const stopsDiv = document.getElementById('route-stops');
        if (!stopsDiv) return;

        stopsDiv.innerHTML = bridge.state.route.map((stop, idx) => {
            const stopType = stop.isWaypoint ? 'waypoint' : 'marker';
            return `<div class="route-stop-row" draggable="true" data-route-index="${idx}">
                        <span class="drag-handle">⋮⋮</span>
                        <span class="stop-info">${idx+1}. ${stop.name}</span>
                        <button class="mini-btn" data-ridx="${idx}" title="Remove stop">✖</button>
                    </div>`;
        }).join('') + (bridge.state.route.length ? `<div class="route-actions">
                        <button id="clear-route-btn" class="clear-route-btn">Clear Route</button>
                    </div>` : '');
        
        // Add event listeners for remove buttons
        stopsDiv.querySelectorAll('button[data-ridx]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const ridx = parseInt(e.currentTarget.dataset.ridx, 10);
                removeRouteIndex(ridx);
            });
        });
        
        // Add event listener for clear button
        const clearBtn = document.getElementById('clear-route-btn');
        if (clearBtn) clearBtn.addEventListener('click', clearRoute);

        // Setup drag and drop functionality (re-initialize after DOM update)
        setupDragAndDrop(stopsDiv);
    }

    /**
     * Setup drag and drop functionality for route reordering
     */
    function setupDragAndDrop(container) {
        // Remove any existing event listeners to prevent duplicates
        container.removeEventListener('dragstart', handleDragStart);
        container.removeEventListener('dragend', handleDragEnd);
        container.removeEventListener('dragover', handleDragOver);
        container.removeEventListener('drop', handleDrop);
        container.removeEventListener('dragenter', handleDragEnter);
        
        let draggedElement = null;
        let draggedIndex = null;

        // Drag start handler
        function handleDragStart(e) {
            const draggableRow = e.target.closest('.route-stop-row[draggable="true"]');
            if (!draggableRow) return;
            
            draggedElement = draggableRow;
            draggedIndex = parseInt(draggableRow.dataset.routeIndex, 10);
            draggableRow.classList.add('dragging');
            
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', draggedIndex.toString());
            
            console.log(`Drag started: index ${draggedIndex}`);
        }

        // Drag end handler
        function handleDragEnd(e) {
            const draggableRow = e.target.closest('.route-stop-row[draggable="true"]');
            if (draggableRow) {
                draggableRow.classList.remove('dragging');
            }
            
            // Clean up drop indicators
            container.querySelectorAll('.drop-indicator').forEach(indicator => {
                indicator.remove();
            });
            
            draggedElement = null;
            draggedIndex = null;
            
            console.log('Drag ended');
        }

        // Drag over handler
        function handleDragOver(e) {
            if (!draggedElement) return;
            
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            
            const targetRow = e.target.closest('.route-stop-row');
            if (targetRow && targetRow !== draggedElement && !targetRow.classList.contains('dragging')) {
                // Remove existing indicators
                container.querySelectorAll('.drop-indicator').forEach(indicator => {
                    indicator.remove();
                });
                
                // Add drop indicator
                const rect = targetRow.getBoundingClientRect();
                const midpoint = rect.top + rect.height / 2;
                
                const indicator = document.createElement('div');
                indicator.className = 'drop-indicator';
                indicator.style.cssText = 'height: 2px; background: #357abd; margin: 2px 0; pointer-events: none;';
                
                if (e.clientY < midpoint) {
                    targetRow.parentNode.insertBefore(indicator, targetRow);
                } else {
                    targetRow.parentNode.insertBefore(indicator, targetRow.nextSibling);
                }
            }
        }

        // Drag enter handler
        function handleDragEnter(e) {
            if (!draggedElement) return;
            e.preventDefault();
        }

        // Drop handler
        function handleDrop(e) {
            e.preventDefault();
            
            if (!draggedElement || draggedIndex === null) return;
            
            const targetRow = e.target.closest('.route-stop-row');
            if (!targetRow || targetRow === draggedElement || targetRow.classList.contains('dragging')) {
                return;
            }
            
            const targetIndex = parseInt(targetRow.dataset.routeIndex, 10);
            const rect = targetRow.getBoundingClientRect();
            const midpoint = rect.top + rect.height / 2;
            
            let newIndex = targetIndex;
            if (e.clientY > midpoint) {
                newIndex = targetIndex + 1;
            }
            
            // Adjust for removal of dragged item
            if (draggedIndex < newIndex) {
                newIndex--;
            }
            
            console.log(`Dropping: from ${draggedIndex} to ${newIndex}`);
            
            if (draggedIndex !== newIndex) {
                reorderRoute(draggedIndex, newIndex);
            }
            
            // Clean up drop indicators
            container.querySelectorAll('.drop-indicator').forEach(indicator => {
                indicator.remove();
            });
        }

        // Use event delegation to handle all drag events
        container.addEventListener('dragstart', handleDragStart, true);
        container.addEventListener('dragend', handleDragEnd, true);
        container.addEventListener('dragover', handleDragOver, true);
        container.addEventListener('dragenter', handleDragEnter, true);
        container.addEventListener('drop', handleDrop, true);
        
        console.log('Drag and drop initialized for', container.querySelectorAll('.route-stop-row[draggable="true"]').length, 'items');
    }

    /**
     * Reorder route stops
     */
    function reorderRoute(fromIndex, toIndex) {
        const item = bridge.state.route.splice(fromIndex, 1)[0];
        bridge.state.route.splice(toIndex, 0, item);
        recomputeRoute();
    }

    /**
     * Remove specific route stop by index
     */
    function removeRouteIndex(idx) {
        bridge.state.route.splice(idx, 1);
        recomputeRoute();
    }

    /**
     * Clear entire route
     */
    function clearRoute() {
        if (isCalculatingRoute) {
            isCalculatingRoute = false; // Signal to stop the calculation chain
        }

        bridge.state.route = [];
        bridge.state.routeLegs = [];
        bridge.state.routePolylines.forEach(pl => bridge.map.removeLayer(pl));
        bridge.state.routePolylines = [];
        
        if (bridge.state.routePolyline) { 
            bridge.map.removeLayer(bridge.state.routePolyline); 
            bridge.state.routePolyline = null; 
        }

        updateRouteDisplay();
        visualizer.updateRouteSummaryEmpty();
    }

    /**
     * Recompute entire route with sequential leg processing
     */
    function recomputeRoute() {
        if (isCalculatingRoute) {
            console.warn("Route calculation already in progress. Ignoring new request.");
            return;
        }
        
        // Clear existing route visualization
        bridge.state.routePolylines.forEach(pl => bridge.map.removeLayer(pl));
        bridge.state.routePolylines = [];
        bridge.state.routeLegs = [];
        
        if (bridge.state.routePolyline) { 
            bridge.map.removeLayer(bridge.state.routePolyline); 
            bridge.state.routePolyline = null; 
        }
        
        updateRouteDisplay();
        
        if (bridge.state.route.length < 2) { 
            visualizer.updateRouteSummaryEmpty(); 
            return; 
        }

        isCalculatingRoute = true;
        visualizer.updateRouteSummaryCalculating();
        
        // Build graph if it doesn't exist
        if (!routingGraph) {
            routingGraph = graphBuilder.buildRoutingGraph();
        }

        if (!routingGraph) {
            console.error("Failed to build routing graph");
            isCalculatingRoute = false;
            return;
        }

        // Process legs sequentially 
        const processLeg = (legIndex) => {
            // If calculation was cancelled, stop.
            if (!isCalculatingRoute) {
                visualizer.updateRouteSummaryEmpty();
                return;
            }

            if (legIndex >= bridge.state.route.length - 1) {
                // All legs are calculated
                visualizer.updateRouteSummaryFromLegs();
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

    /**
     * Calculate path for a single route leg
     */
    function calculateLegPath(start, end, onComplete) {
        const startNodeId = `marker_${start.id}`;
        const endNodeId = `marker_${end.id}`;
        
        console.log(`Calculating path from ${start.name} (${start.x}, ${start.y}) to ${end.name} (${end.x}, ${end.y})`);
        
        // Check if nodes exist in graph
        if (!routingGraph.nodes.has(startNodeId)) {
            console.error(`Start node ${startNodeId} not found in graph`);
            bridge.state.routeLegs.push({ 
                from: start, 
                to: end, 
                distanceKm: 0, 
                unreachable: true,
                error: `Start marker ${start.name} not in routing graph`
            });
            if (typeof onComplete === 'function') onComplete();
            return;
        }
        
        if (!routingGraph.nodes.has(endNodeId)) {
            console.error(`End node ${endNodeId} not found in graph`);
            bridge.state.routeLegs.push({ 
                from: start, 
                to: end, 
                distanceKm: 0, 
                unreachable: true,
                error: `End marker ${end.name} not in routing graph`
            });
            if (typeof onComplete === 'function') onComplete();
            return;
        }
        
        console.log(`Graph contains ${routingGraph.nodes.size} nodes and ${routingGraph.edges.length} edges`);
        
        // Use A* algorithm for efficient pathfinding across the hybrid graph
        const graphPath = pathfinding.findShortestPathAStar(routingGraph, startNodeId, endNodeId);
        
        if (!graphPath || graphPath.length === 0) {
            console.warn(`No path found between ${start.name} and ${end.name} - checking connectivity...`);
            
            // Debug: Check if start/end have any connections
            const startConnections = routingGraph.edges.filter(e => e.from === startNodeId || e.to === startNodeId);
            const endConnections = routingGraph.edges.filter(e => e.from === endNodeId || e.to === endNodeId);
            
            console.log(`Start node ${startNodeId} has ${startConnections.length} connections`);
            console.log(`End node ${endNodeId} has ${endConnections.length} connections`);
            
            if (startConnections.length === 0) {
                console.error(`Start marker ${start.name} has no graph connections`);
            }
            if (endConnections.length === 0) {
                console.error(`End marker ${end.name} has no graph connections`);
            }
            
            bridge.state.routeLegs.push({ 
                from: start, 
                to: end, 
                distanceKm: 0, 
                unreachable: true,
                error: `No path found - Start: ${startConnections.length} connections, End: ${endConnections.length} connections`
            });
            if (typeof onComplete === 'function') onComplete();
            return;
        }
        
        console.log(`Found path with ${graphPath.length} nodes`);
        
        // Convert path to segments and render
        const pathSegments = visualizer.analyzePathSegments(graphPath, routingGraph);
        const totalCostKm = pathfinding.computeGraphPathCost(graphPath, routingGraph.edgeMap, bridge.config.kmPerPixel);
        
        // Render path with different styles for roads vs terrain
        visualizer.renderHybridPath(pathSegments);
        
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

    // Expose the init function to the global scope
    window.__nimea_routing_init = initRouting;

})(window);
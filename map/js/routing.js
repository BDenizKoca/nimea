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

    // Routing state
    let routingGraph = null;
    let isCalculatingRoute = false; // Mutex to prevent concurrent calculations
    let waypointCounter = 0; // Counter for waypoint naming

    // Configuration constants
    const TERRAIN_COSTS = {
        road: 1.0,       // Primary paths: roads are fastest (cost = 1)
        difficult: 5.0,  // Existing difficult terrain (matches DM mode)
        forest: 3.0,     // New forest terrain type (moderate difficulty)
        unpassable: Infinity, // Blocked areas (matches DM mode)
        normal: 2.0      // Default fallback terrain for empty areas
    };

    const TERRAIN_GRID_SIZE = 50;
    const ROAD_CONNECTION_DISTANCE = 150;

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

        if (!graphBuilder || !pathfinding || !terrainUtils || !visualizer) {
            console.error("Routing modules not loaded. Required: graph-builder, pathfinding, terrain-utils, visualizer");
            return;
        }

        // Initialize modules with dependencies
        graphBuilder.initGraphBuilder(bridge, TERRAIN_COSTS, TERRAIN_GRID_SIZE, ROAD_CONNECTION_DISTANCE, terrainUtils);
        terrainUtils.initTerrainUtils(bridge, TERRAIN_COSTS);
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

        // Add drag and drop functionality
        setupDragAndDrop(stopsDiv);
    }

    /**
     * Setup drag and drop functionality for route reordering
     */
    function setupDragAndDrop(container) {
        const draggables = container.querySelectorAll('.route-stop-row[draggable="true"]');
        
        draggables.forEach(draggable => {
            draggable.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', e.target.dataset.routeIndex);
                e.target.classList.add('dragging');
            });

            draggable.addEventListener('dragend', (e) => {
                e.target.classList.remove('dragging');
            });

            draggable.addEventListener('dragover', (e) => {
                e.preventDefault();
                const afterElement = getDragAfterElement(container, e.clientY);
                const dragging = container.querySelector('.dragging');
                
                if (afterElement == null) {
                    container.appendChild(dragging);
                } else {
                    container.insertBefore(dragging, afterElement);
                }
            });

            draggable.addEventListener('drop', (e) => {
                e.preventDefault();
                const draggedIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
                const targetIndex = parseInt(e.target.closest('.route-stop-row').dataset.routeIndex, 10);
                
                if (draggedIndex !== targetIndex) {
                    reorderRoute(draggedIndex, targetIndex);
                }
            });
        });
    }

    /**
     * Get the element after which the dragged item should be inserted
     */
    function getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.route-stop-row:not(.dragging)')];
        
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
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
        
        console.log(`Calculating path from ${start.name} to ${end.name}`);
        
        // Use A* algorithm for efficient pathfinding across the hybrid graph
        const graphPath = pathfinding.findShortestPathAStar(routingGraph, startNodeId, endNodeId);
        
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
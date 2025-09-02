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
            initRouting: () => { /* no-op, already initialized */ }
        };
        
        console.log("Routing module initialized with modular architecture.");
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
     * Update route display with current stops
     */
    function updateRouteDisplay() {
        const stopsDiv = document.getElementById('route-stops');
        if (!stopsDiv) return;

        stopsDiv.innerHTML = bridge.state.route.map((stop, idx) => {
            return `<div class="route-stop-row">${idx+1}. ${stop.name} <button class="mini-btn" data-ridx="${idx}" title="Remove stop">✖</button></div>`;
        }).join('') + (bridge.state.route.length ? `<div class="route-actions"><button id="clear-route-btn" class="clear-route-btn">Clear Route</button></div>` : '');
        
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
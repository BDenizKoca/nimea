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
        
        // Invalidate routing graph to include the new waypoint
        invalidateGraph();
        
        console.log(`Created waypoint ${waypoint.name} at (${waypoint.x}, ${waypoint.y})`);
        
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

        // Add touch support for waypoint deletion on mobile
        marker.on('touchstart', (e) => {
            e.originalEvent.preventDefault();
            marker._touchStartTime = Date.now();
            marker._touchStartPos = e.originalEvent.touches[0];
        });

        marker.on('touchend', (e) => {
            e.originalEvent.preventDefault();
            
            if (marker._touchStartTime && marker._touchStartPos) {
                const touchDuration = Date.now() - marker._touchStartTime;
                const touchEnd = e.originalEvent.changedTouches[0];
                
                const deltaX = Math.abs(touchEnd.clientX - marker._touchStartPos.clientX);
                const deltaY = Math.abs(touchEnd.clientY - marker._touchStartPos.clientY);
                const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
                
                // Consider it a tap if: duration < 500ms and movement < 10px
                if (touchDuration < 500 && distance < 10) {
                    if (confirm(`Delete ${waypoint.name}?`)) {
                        deleteWaypoint(waypoint.id, marker);
                    }
                }
                
                marker._touchStartTime = null;
                marker._touchStartPos = null;
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
        
        // Use event delegation for better reliability when DOM changes frequently
        // Remove any existing delegated listeners to avoid duplicates
        stopsDiv.removeEventListener('click', handleRouteStopClick);
        stopsDiv.addEventListener('click', handleRouteStopClick);
        
        // Add event listener for clear button (direct since it's unique)
        const clearBtn = document.getElementById('clear-route-btn');
        if (clearBtn) {
            console.log("Clear route button found, attaching event listener");
            // Remove any existing listener to avoid duplicates
            clearBtn.removeEventListener('click', clearRouteHandler);
            clearBtn.addEventListener('click', clearRouteHandler);
        } else {
            console.log("Clear route button not found in DOM");
        }

        // Setup drag and drop functionality (re-initialize after DOM update)
        if (bridge.state.route.length > 1) {
            setupDragAndDrop(stopsDiv);
        }
    }

    /**
     * Delegated event handler for route stop interactions
     */
    function handleRouteStopClick(e) {
        const target = e.target;
        
        // Handle remove button clicks
        if (target.classList.contains('mini-btn') && target.dataset.ridx !== undefined) {
            e.preventDefault();
            e.stopPropagation();
            const ridx = parseInt(target.dataset.ridx, 10);
            console.log("Remove button clicked for index:", ridx);
            removeRouteIndex(ridx);
            return;
        }
    }

    /**
     * Clear route button handler
     */
    function clearRouteHandler(e) {
        e.preventDefault();
        e.stopPropagation();
        console.log("Clear route button clicked");
        clearRoute();
    }

    /**
     * Setup drag and drop functionality for route reordering
     */
    function setupDragAndDrop(container) {
        // Store drag state
        let draggedElement = null;
        let draggedIndex = null;
        let touchDragging = false;
        let touchStartY = 0;
        let touchCurrentRow = null;

        // Clear any existing handlers by cloning the container
        const newContainer = container.cloneNode(true);
        container.parentNode.replaceChild(newContainer, container);
        
        // Update reference to the new container
        const stopsDiv = document.getElementById('route-stops');
        
        // Drag start handler
        function handleDragStart(e) {
            // Only handle draggable route rows
            if (!e.target.matches('.route-stop-row[draggable="true"]') && 
                !e.target.closest('.route-stop-row[draggable="true"]')) {
                return;
            }
            
            const draggableRow = e.target.closest('.route-stop-row[draggable="true"]');
            if (!draggableRow) return;
            
            draggedElement = draggableRow;
            draggedIndex = parseInt(draggableRow.dataset.routeIndex, 10);
            draggableRow.classList.add('dragging');
            
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', draggedIndex.toString());
            
            console.log(`🟢 Drag started: index ${draggedIndex}, element:`, draggableRow);
        }

        // Drag end handler
        function handleDragEnd(e) {
            if (draggedElement) {
                draggedElement.classList.remove('dragging');
            }
            
            // Clean up drop indicators
            stopsDiv.querySelectorAll('.drop-indicator').forEach(indicator => {
                indicator.remove();
            });
            
            console.log('🔴 Drag ended');
            draggedElement = null;
            draggedIndex = null;
        }

        // Drag over handler
        function handleDragOver(e) {
            if (!draggedElement) return;
            
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            
            const targetRow = e.target.closest('.route-stop-row');
            if (targetRow && targetRow !== draggedElement && !targetRow.classList.contains('dragging')) {
                // Remove existing indicators
                stopsDiv.querySelectorAll('.drop-indicator').forEach(indicator => {
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
            
            if (!draggedElement || draggedIndex === null) {
                console.warn('⚠️ Drop event but no dragged element');
                return;
            }
            
            const targetRow = e.target.closest('.route-stop-row');
            if (!targetRow || targetRow === draggedElement || targetRow.classList.contains('dragging')) {
                console.warn('⚠️ Invalid drop target');
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
            
            console.log(`🟡 Drop: from ${draggedIndex} to ${newIndex}`);
            
            if (draggedIndex !== newIndex && newIndex >= 0) {
                reorderRoute(draggedIndex, newIndex);
            }
            
            // Clean up drop indicators
            stopsDiv.querySelectorAll('.drop-indicator').forEach(indicator => {
                indicator.remove();
            });
        }

        // Add event listeners with capture to ensure they fire
        stopsDiv.addEventListener('dragstart', handleDragStart, true);
        stopsDiv.addEventListener('dragend', handleDragEnd, true);
        stopsDiv.addEventListener('dragover', handleDragOver, true);
        stopsDiv.addEventListener('dragenter', handleDragEnter, true);
        stopsDiv.addEventListener('drop', handleDrop, true);
        
        console.log('🔧 Drag and drop initialized for', stopsDiv.querySelectorAll('.route-stop-row[draggable="true"]').length, 'items');

        // --- Mobile touch fallback (long press + move) ---
        // Activate only if no native drag events (basic heuristic: touch events present)
        if ('ontouchstart' in window) {
            ensureMobileDnDStyles();
            let dragOriginIndex = null;
            let targetIndex = null;
            let targetHighlightRow = null;

            const rows = () => Array.from(stopsDiv.querySelectorAll('.route-stop-row'));

            function clearHighlight() {
                if (targetHighlightRow) {
                    targetHighlightRow.classList.remove('touch-drop-before');
                    targetHighlightRow.classList.remove('touch-drop-after');
                    targetHighlightRow = null;
                }
            }

            rows().forEach(row => {
                row.addEventListener('touchstart', (e) => {
                    if (e.touches.length !== 1) return;
                    touchStartY = e.touches[0].clientY;
                    touchCurrentRow = row;
                    dragOriginIndex = parseInt(row.dataset.routeIndex, 10);
                    row.classList.add('touch-press');
                    row._longPressTimer = setTimeout(() => {
                        touchDragging = true;
                        row.classList.add('dragging');
                        // Fix height to avoid layout shift
                        row.style.height = row.getBoundingClientRect().height + 'px';
                    }, 280); // slightly longer to reduce accidental drags
                }, { passive: true });

                row.addEventListener('touchmove', (e) => {
                    if (!touchCurrentRow) return;
                    const y = e.touches[0].clientY;
                    if (!touchDragging) {
                        if (Math.abs(y - touchStartY) > 14) { // tolerance
                            clearTimeout(touchCurrentRow._longPressTimer);
                            touchCurrentRow.classList.remove('touch-press');
                            touchCurrentRow = null;
                        }
                        return;
                    }
                    e.preventDefault();
                    // Identify potential target index by comparing to row midpoints
                    const rowList = rows();
                    let provisionalIndex = dragOriginIndex;
                    for (let i = 0; i < rowList.length; i++) {
                        const r = rowList[i];
                        if (r === touchCurrentRow) continue; // skip dragged
                        const rect = r.getBoundingClientRect();
                        const midpoint = rect.top + rect.height / 2;
                        if (y < midpoint) { // would insert before r
                            provisionalIndex = parseInt(r.dataset.routeIndex, 10);
                            clearHighlight();
                            r.classList.add('touch-drop-before');
                            targetHighlightRow = r;
                            break;
                        }
                        // if we reach end, place after last
                        if (i === rowList.length - 1) {
                            provisionalIndex = parseInt(r.dataset.routeIndex, 10) + 1;
                            clearHighlight();
                            r.classList.add('touch-drop-after');
                            targetHighlightRow = r;
                        }
                    }
                    targetIndex = provisionalIndex;
                }, { passive: false });

                function finalizeTouchDrag(cancelled) {
                    if (touchCurrentRow) {
                        clearTimeout(touchCurrentRow._longPressTimer);
                        touchCurrentRow.classList.remove('touch-press');
                        touchCurrentRow.classList.remove('dragging');
                        touchCurrentRow.style.height = '';
                    }
                    clearHighlight();
                    if (!cancelled && touchDragging && targetIndex !== null && dragOriginIndex !== null) {
                        let finalTarget = targetIndex;
                        // Adjust if moving downward past original position
                        if (finalTarget > dragOriginIndex) finalTarget -= 1;
                        if (finalTarget !== dragOriginIndex && finalTarget >= 0) {
                            reorderRoute(dragOriginIndex, finalTarget);
                        }
                    }
                    touchDragging = false;
                    touchCurrentRow = null;
                    dragOriginIndex = null;
                    targetIndex = null;
                }

                row.addEventListener('touchend', () => finalizeTouchDrag(false));
                row.addEventListener('touchcancel', () => finalizeTouchDrag(true));
            });
        }
    }

    // Inject minimal styles for mobile drag indicators once
    function ensureMobileDnDStyles() {
        if (document.getElementById('route-mobile-dnd-styles')) return;
        const style = document.createElement('style');
        style.id = 'route-mobile-dnd-styles';
        style.textContent = `
            .route-stop-row.touch-press { opacity: 0.85; }
            .route-stop-row.dragging { background: #1e3a8a10; }
            .route-stop-row.touch-drop-before { box-shadow: inset 0 3px 0 #1e40af; }
            .route-stop-row.touch-drop-after { box-shadow: inset 0 -3px 0 #1e40af; }
        `;
        document.head.appendChild(style);
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
        console.log("removeRouteIndex called with index:", idx, "current route length:", bridge.state.route.length);
        if (idx >= 0 && idx < bridge.state.route.length) {
            const removedStop = bridge.state.route[idx];
            console.log("Removing stop:", removedStop.name);
            bridge.state.route.splice(idx, 1);
            console.log("New route length:", bridge.state.route.length);
            recomputeRoute();
        } else {
            console.error("Invalid route index:", idx);
        }
    }

    /**
     * Clear entire route
     */
    function clearRoute() {
        console.log("clearRoute() called - current route length:", bridge.state.route.length);
        
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

        // Remove unified route line if present
        if (bridge.state.routeUnifiedPolyline) {
            bridge.map.removeLayer(bridge.state.routeUnifiedPolyline);
            bridge.state.routeUnifiedPolyline = null;
        }

        console.log("Route cleared, updating display");
        updateRouteDisplay();
        visualizer.updateRouteSummaryEmpty();
        console.log("Route display updated - new route length:", bridge.state.route.length);
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
                // Render a single unified line across all legs (prevents segment gaps)
                try {
                    visualizer.renderFullUnifiedRoute(bridge.state.routeLegs);
                } catch (e) {
                    console.warn('Unified full-route rendering failed:', e);
                }
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
    // (Removed per-leg rendering; final unified rendering occurs after all legs complete.)
        
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
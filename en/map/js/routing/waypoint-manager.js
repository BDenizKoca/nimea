// map/js/routing/waypoint-manager.js - Waypoint creation, deletion and management

(function(window) {
    'use strict';

    let bridge = {};
    let waypointCounter = 0; // Counter for waypoint naming

    /**
     * Initialize the waypoint manager module
     */
    function initWaypointManager(bridgeObj) {
        bridge = bridgeObj;
        
        console.log("Waypoint manager module initialized");
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
        if (bridge.routingModule && bridge.routingModule.invalidateGraph) {
            bridge.routingModule.invalidateGraph();
        }
        
        console.log(`Created waypoint ${waypoint.name} at (${waypoint.x}, ${waypoint.y})`);
        
        // Create visual marker on map - classic marker pin in orange color
        const icon = L.icon({
            iconUrl: 'data:image/svg+xml;base64,' + btoa(`
                <svg width="25" height="41" viewBox="0 0 25 41" xmlns="http://www.w3.org/2000/svg">
                    <path fill="#ff6b35" stroke="#ffffff" stroke-width="2" 
                          d="M12.5 0C5.6 0 0 5.6 0 12.5c0 12.5 12.5 28.5 12.5 28.5s12.5-16 12.5-28.5C25 5.6 19.4 0 12.5 0z"/>
                    <circle fill="#ffffff" cx="12.5" cy="12.5" r="6"/>
                    <text x="12.5" y="17" text-anchor="middle" font-family="Arial, sans-serif" font-size="10" font-weight="bold" fill="#ff6b35">${waypointCounter}</text>
                </svg>
            `),
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [0, -41],
            className: 'waypoint-marker-icon'
        });
        
        const marker = L.marker([lat, lng], { 
            icon,
            draggable: true,  // Make waypoints draggable!
            waypointId: waypoint.id  // Store reference for reliable lookup
        }).addTo(bridge.map);
        
        // Store bidirectional references for reliable state management
        waypoint._leafletMarker = marker;
        marker._waypointData = waypoint;
        
        // Handle dragging - update waypoint position and handle reordering
        marker.on('dragend', (e) => {
            const newLatLng = e.target.getLatLng();
            console.log(`Waypoint ${waypoint.name} dragged to: ${newLatLng.lat}, ${newLatLng.lng}`);
            
            // Update waypoint coordinates in all locations
            updateWaypointPosition(waypoint, newLatLng.lat, newLatLng.lng);
            
            // Invalidate routing graph since waypoint moved
            if (bridge.routingModule && bridge.routingModule.invalidateGraph) {
                console.log("Invalidating routing graph due to waypoint movement");
                bridge.routingModule.invalidateGraph();
            }
            
            // Check if waypoint needs reordering in route based on new position
            console.log("Handling waypoint reordering after drag");
            handleWaypointReordering(waypoint);
            
            // Mark as just dragged to prevent accidental deletion
            marker._justDragged = true;
            marker._dragEndTime = Date.now();
            setTimeout(() => {
                marker._justDragged = false;
            }, 300); // Longer delay to prevent accidental clicks
        });
        
        // Click to delete waypoint with improved click detection
        marker.on('click', (e) => {
            // Prevent deletion if recently dragged
            if (marker._justDragged || (marker._dragEndTime && Date.now() - marker._dragEndTime < 300)) {
                console.log("Click ignored - waypoint was recently dragged");
                return;
            }
            
            e.originalEvent.stopPropagation(); // Prevent map click events
            
            if (confirm(`Delete ${waypoint.name}?`)) {
                deleteWaypoint(waypoint.id);
            }
        });
        
        // Track dragging states more reliably
        marker.on('dragstart', () => {
            marker._isDragging = true;
            marker._justDragged = false;
            console.log(`Started dragging waypoint ${waypoint.name}`);
        });

        // Add touch support for waypoint deletion on mobile
        setupWaypointTouchHandlers(marker, waypoint);

        return waypoint;
    }

    /**
     * Update waypoint position in all relevant data structures
     */
    function updateWaypointPosition(waypoint, newLat, newLng) {
        // Update waypoint object
        waypoint.lat = newLat;
        waypoint.lng = newLng;
        waypoint.x = newLng;
        waypoint.y = newLat;
        
        // Update in markers array
        const markerIndex = bridge.state.markers.findIndex(m => m.id === waypoint.id);
        if (markerIndex > -1) {
            bridge.state.markers[markerIndex] = waypoint;
        }
        
        // Update in route array if present
        const routeIndex = bridge.state.route.findIndex(r => r.id === waypoint.id);
        if (routeIndex > -1) {
            bridge.state.route[routeIndex] = waypoint;
        }
        
        console.log(`Updated waypoint ${waypoint.name} position to [${newLat}, ${newLng}] in all data structures`);
    }

    /**
     * Handle waypoint reordering in route based on geographical position
     */
    function handleWaypointReordering(draggedWaypoint) {
        console.log("handleWaypointReordering called for waypoint:", draggedWaypoint.name);
        console.log("Current route:", bridge.state.route.map(r => r.name));
        
        const routeIndex = bridge.state.route.findIndex(r => r.id === draggedWaypoint.id);
        if (routeIndex === -1) {
            console.log("Waypoint not in route - no reordering needed");
            return; // Waypoint not in route
        }
        
        console.log(`Waypoint ${draggedWaypoint.name} found at route index ${routeIndex}`);
        
        // Find the optimal position for this waypoint in the route based on geographic proximity
        let bestPosition = routeIndex;
        let minTotalDistance = calculateRouteDistance(bridge.state.route);
        
        console.log(`Current route distance: ${minTotalDistance.toFixed(2)}`);
        
        // Try inserting the waypoint at each position and find the best one
        for (let i = 0; i < bridge.state.route.length; i++) {
            if (i === routeIndex) continue; // Skip current position
            
            // Create a test route with waypoint moved to position i
            const testRoute = [...bridge.state.route];
            const waypoint = testRoute.splice(routeIndex, 1)[0];
            testRoute.splice(i, 0, waypoint);
            
            const testDistance = calculateRouteDistance(testRoute);
            if (testDistance < minTotalDistance) {
                minTotalDistance = testDistance;
                bestPosition = i;
            }
        }
        
        console.log(`Best position for waypoint: ${bestPosition} (was ${routeIndex})`);
        
        // If a better position was found, reorder the route
        if (bestPosition !== routeIndex) {
            console.log(`Reordering waypoint ${draggedWaypoint.name} from position ${routeIndex} to ${bestPosition}`);
            
            if (bridge.routingModule && bridge.routingModule.reorderRoute) {
                console.log("Calling bridge.routingModule.reorderRoute");
                bridge.routingModule.reorderRoute(routeIndex, bestPosition);
            } else {
                console.log("bridge.routingModule.reorderRoute not available, using fallback");
                // Fallback manual reordering
                const waypoint = bridge.state.route.splice(routeIndex, 1)[0];
                bridge.state.route.splice(bestPosition, 0, waypoint);
                
                // Trigger route recomputation
                if (bridge.routingModule && bridge.routingModule.recomputeRoute) {
                    console.log("Calling bridge.routingModule.recomputeRoute (fallback)");
                    bridge.routingModule.recomputeRoute();
                } else {
                    console.error("bridge.routingModule.recomputeRoute not available!");
                }
            }
        } else {
            // Even if position doesn't change, recompute route for new coordinates
            console.log("Waypoint position optimal - recomputing route for new coordinates");
            if (bridge.routingModule && bridge.routingModule.recomputeRoute) {
                console.log("Calling bridge.routingModule.recomputeRoute (position optimal)");
                bridge.routingModule.recomputeRoute();
            } else {
                console.error("bridge.routingModule.recomputeRoute not available!");
            }
        }
    }

    /**
     * Calculate total distance of a route (simple Euclidean distance)
     */
    function calculateRouteDistance(route) {
        if (!route || route.length < 2) return 0;
        
        let totalDistance = 0;
        for (let i = 1; i < route.length; i++) {
            const dx = route[i].x - route[i-1].x;
            const dy = route[i].y - route[i-1].y;
            totalDistance += Math.sqrt(dx * dx + dy * dy);
        }
        return totalDistance;
    }

    /**
     * Setup touch handlers for waypoint deletion on mobile
     */
    function setupWaypointTouchHandlers(marker, waypoint) {
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
    }

    /**
     * Delete a waypoint - improved with better state cleanup
     */
    function deleteWaypoint(waypointId) {
        console.log(`Deleting waypoint: ${waypointId}`);
        
        // Find waypoint in markers array
        const markerIndex = bridge.state.markers.findIndex(m => m.id === waypointId);
        let waypoint = null;
        if (markerIndex > -1) {
            waypoint = bridge.state.markers[markerIndex];
            bridge.state.markers.splice(markerIndex, 1);
            console.log(`Removed waypoint from markers array at index ${markerIndex}`);
        }

        // Remove from route if present
        const routeIndex = bridge.state.route.findIndex(r => r.id === waypointId);
        if (routeIndex > -1) {
            bridge.state.route.splice(routeIndex, 1);
            console.log(`Removed waypoint from route at index ${routeIndex}`);
        }

        // Remove from map using multiple methods to ensure cleanup
        if (waypoint && waypoint._leafletMarker) {
            bridge.map.removeLayer(waypoint._leafletMarker);
            console.log("Removed waypoint marker using stored reference");
        }
        
        // Also search all map layers to ensure cleanup
        bridge.map.eachLayer(layer => {
            if (layer instanceof L.Marker && 
                (layer.options.waypointId === waypointId || 
                 (layer._waypointData && layer._waypointData.id === waypointId))) {
                bridge.map.removeLayer(layer);
                console.log("Removed waypoint marker found by layer search");
            }
        });

        // Invalidate routing graph and recompute
        if (bridge.routingModule && bridge.routingModule.invalidateGraph) {
            bridge.routingModule.invalidateGraph();
        }
        
        if (bridge.routingModule && bridge.routingModule.recomputeRoute) {
            bridge.routingModule.recomputeRoute();
        }
        
        console.log(`Successfully deleted waypoint ${waypointId}`);
    }

    /**
     * Clear all waypoints from the map and data structures
     */
    function clearAllWaypoints() {
        console.log("Clearing all waypoints...");
        
        // Find all waypoints in markers
        const waypoints = bridge.state.markers.filter(m => m.isWaypoint);
        
        // Remove each waypoint
        waypoints.forEach(waypoint => {
            // Remove from map if it has a marker
            if (waypoint._leafletMarker) {
                bridge.map.removeLayer(waypoint._leafletMarker);
            }
            
            // Also try to find and remove by searching all map layers
            bridge.map.eachLayer(layer => {
                if (layer instanceof L.Marker && layer.options.markerId === waypoint.id) {
                    bridge.map.removeLayer(layer);
                }
            });
        });
        
        // Remove all waypoints from markers array
        bridge.state.markers = bridge.state.markers.filter(m => !m.isWaypoint);
        
        // Invalidate graph to remove waypoint connections
        if (bridge.routingModule && bridge.routingModule.invalidateGraph) {
            bridge.routingModule.invalidateGraph();
        }
        
        console.log(`Cleared ${waypoints.length} waypoints`);
    }

    // Expose public functions
    window.__nimea_waypoint_manager = {
        initWaypointManager,
        createWaypoint,
        deleteWaypoint,
        clearAllWaypoints
    };

})(window);
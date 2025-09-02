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
        setupWaypointTouchHandlers(marker, waypoint);

        // Store reference to marker on waypoint
        waypoint.marker = marker;

        return waypoint;
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
            if (bridge.routingModule && bridge.routingModule.recomputeRoute) {
                bridge.routingModule.recomputeRoute();
            }
        }

        // Remove from map
        if (marker) {
            bridge.map.removeLayer(marker);
        }

        // Invalidate routing graph to rebuild without this waypoint
        if (bridge.routingModule && bridge.routingModule.invalidateGraph) {
            bridge.routingModule.invalidateGraph();
        }
    }

    // Expose public functions
    window.__nimea_waypoint_manager = {
        initWaypointManager,
        createWaypoint,
        deleteWaypoint
    };

})(window);
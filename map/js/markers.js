// map/js/markers.js - Marker rendering and management

(function(window) {
    'use strict';

    let bridge = {};

    function initMarkersModule(nimeaBridge) {
        bridge = nimeaBridge;
        if (!bridge) {
            console.error("Markers module requires the global Nimea bridge.");
            return;
        }

        bridge.markersModule = {
            renderMarkers
        };
        
        console.log("Markers module initialized.");
    }

    function renderMarkers() {
        // Clean up existing markers to prevent memory leaks
        bridge.map.eachLayer(layer => {
            if (layer instanceof L.Marker && !layer.options.isPending) {
                bridge.map.removeLayer(layer);
            }
        });
        
        let focusMarkerInstance = null;
        
        bridge.state.markers.forEach(markerData => {
            // Skip waypoints - they're handled by routing.js
            if (markerData.isWaypoint) return;
            
            if (markerData.public || bridge.state.isDmMode) {
                const marker = L.marker([markerData.y, markerData.x], {
                    draggable: bridge.state.isDmMode // Make draggable only in DM mode
                }).addTo(bridge.map);
                
                marker.on('click', () => {
                    // Single click: Just open info sidebar
                    bridge.uiModule.openInfoSidebar(markerData);
                });

                // Add touch event support for mobile devices
                marker.on('touchstart', (e) => {
                    // Prevent default to avoid conflicts
                    e.originalEvent.preventDefault();
                    
                    // Track touch start time for tap detection
                    marker._touchStartTime = Date.now();
                    marker._touchStartPos = e.originalEvent.touches[0];
                });

                marker.on('touchend', (e) => {
                    e.originalEvent.preventDefault();
                    if (!marker._touchStartTime || !marker._touchStartPos) return;
                    const touchDuration = Date.now() - marker._touchStartTime;
                    const touchEnd = e.originalEvent.changedTouches[0];
                    const deltaX = Math.abs(touchEnd.clientX - marker._touchStartPos.clientX);
                    const deltaY = Math.abs(touchEnd.clientY - marker._touchStartPos.clientY);
                    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

                    if (touchDuration < 500 && distance < 10) {
                        const now = Date.now();
                        const isDouble = marker._lastTapTime && (now - marker._lastTapTime) < 320;
                        // Always open info immediately on first tap
                        bridge.uiModule.openInfoSidebar(markerData);
                        if (isDouble) {
                            // Perform focus WITHOUT closing sidebar so user still sees info
                            mapFocusWithoutClosing(markerData);
                            marker._lastTapTime = null; // reset chain
                        } else {
                            marker._lastTapTime = now;
                        }
                    }

                    marker._touchStartTime = null;
                    marker._touchStartPos = null;
                });

                marker.on('dblclick', () => {
                    // Double click: Focus mode with zoom and center
                    focusOnMarker(markerData);
                });

                // Helper function for focus behavior
                function focusOnMarker(markerData) {
                    // Desktop double-click path (kept for compatibility)
                    mapFocusWithoutClosing(markerData);
                }

                function mapFocusWithoutClosing(markerData) {
                    bridge.map.flyTo([markerData.y, markerData.x], Math.max(2.2, bridge.map.getZoom()), {
                        duration: 1.0,
                        easeLinearity: 0.25
                    });
                    // Ensure sidebar stays visible – reopen after slight delay in case layout shifts
                    setTimeout(() => bridge.uiModule.openInfoSidebar(markerData), 400);
                }
                
                // Handle marker drag end in DM mode
                if (bridge.state.isDmMode) {
                    marker.on('dragend', function(e) {
                        const newPos = e.target.getLatLng();
                        const newY = Math.round(newPos.lat);
                        const newX = Math.round(newPos.lng);
                        
                        // Update marker position in the data
                        markerData.y = newY;
                        markerData.x = newX;
                        
                        console.log(`Moved marker "${markerData.name}" to [${newY}, ${newX}]`);
                        
                        // Auto-save the updated position
                        if (bridge.dmModule && bridge.dmModule.updateMarkerPosition) {
                            bridge.dmModule.updateMarkerPosition(markerData);
                        }
                    });
                }
                
                if (bridge.state.focusMarker && markerData.id === bridge.state.focusMarker) {
                    focusMarkerInstance = { marker, data: markerData };
                }
            }
        });
        
        // Focus on specific marker if requested
        if (focusMarkerInstance) {
            // Close any existing info sidebar
            bridge.uiModule.closeInfoSidebar();
            
            // Use flyTo for smooth zoom animation instead of abrupt setView
            bridge.map.flyTo([focusMarkerInstance.data.y, focusMarkerInstance.data.x], 2.2, {
                duration: 1.5, // 1.5 second animation
                easeLinearity: 0.25 // Smooth easing
            });
            setTimeout(() => {
                bridge.uiModule.openInfoSidebar(focusMarkerInstance.data);
            }, 800); // Reduced delay since animation is smoother
        }
    }

    window.__nimea_markers_init = initMarkersModule;

})(window);

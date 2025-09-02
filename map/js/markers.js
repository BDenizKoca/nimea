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
            if (markerData.public || bridge.state.isDmMode) {
                const marker = L.marker([markerData.y, markerData.x], {
                    draggable: bridge.state.isDmMode // Make draggable only in DM mode
                }).addTo(bridge.map);
                
                marker.on('click', () => {
                    // Check if marker is currently visible in viewport
                    const markerPoint = bridge.map.latLngToContainerPoint([markerData.y, markerData.x]);
                    const mapSize = bridge.map.getSize();
                    
                    // If marker is not well visible or zoom is too low, smoothly zoom to it
                    if (bridge.map.getZoom() < 2 || 
                        markerPoint.x < 100 || markerPoint.x > mapSize.x - 100 ||
                        markerPoint.y < 100 || markerPoint.y > mapSize.y - 100) {
                        
                        bridge.map.flyTo([markerData.y, markerData.x], Math.max(2.5, bridge.map.getZoom()), {
                            duration: 1.2,
                            easeLinearity: 0.25
                        });
                        
                        // Open sidebar after animation
                        setTimeout(() => {
                            bridge.uiModule.openInfoSidebar(markerData);
                        }, 600);
                    } else {
                        // Marker is already well visible, just open sidebar
                        bridge.uiModule.openInfoSidebar(markerData);
                    }
                });
                
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
            // Use flyTo for smooth zoom animation instead of abrupt setView
            bridge.map.flyTo([focusMarkerInstance.data.y, focusMarkerInstance.data.x], 3, {
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

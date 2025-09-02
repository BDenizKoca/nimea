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
        
        // Set up zoom-based marker scaling
        setupMarkerScaling();
        
        console.log("Markers module initialized.");
    }

    /**
     * Set up dynamic marker scaling based on zoom level
     */
    function setupMarkerScaling() {
        if (!bridge.map) return;
        
        const applyMarkerScale = () => {
            const zoom = bridge.map.getZoom();
            const maxZoom = bridge.map.getMaxZoom();
            const minZoom = bridge.map.getMinZoom();
            
            // Calculate scale factor - minimum 0.6 (60%) at max zoom, normal scale at lower zooms
            const minScale = 0.6;
            const normalizedZoom = (zoom - minZoom) / (maxZoom - minZoom);
            const scale = Math.max(minScale, 1 - (normalizedZoom * 0.4));
            
            // Apply scale to all custom markers
            bridge.map.eachLayer(layer => {
                if (layer instanceof L.Marker) {
                    const iconElement = layer.getElement();
                    if (iconElement && (iconElement.classList.contains('custom-marker') || iconElement.classList.contains('custom-image-marker'))) {
                        iconElement.style.transform = `scale(${scale})`;
                    }
                }
            });
        };
        
        // Apply scaling on zoom events
        bridge.map.on('zoom', applyMarkerScale);
        bridge.map.on('zoomend', applyMarkerScale);
        
        // Apply initial scaling
        setTimeout(applyMarkerScale, 100);
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
                // Create custom icon if specified, otherwise use default
                let markerOptions = {
                    draggable: bridge.state.isDmMode, // Make draggable only in DM mode
                    riseOnHover: true  // Ensures marker appears above others on hover
                };

                // Add custom icon if available
                if (markerData.iconUrl) {
                    // Prioritize image URL over emoji - use normal marker size
                    markerOptions.icon = L.icon({
                        iconUrl: markerData.iconUrl,
                        iconSize: [32, 32],
                        iconAnchor: [16, 32],
                        popupAnchor: [0, -32],
                        className: 'custom-image-marker'
                    });
                } else if (markerData.customIcon) {
                    // Use emoji/text icon - larger size for visibility
                    markerOptions.icon = L.divIcon({
                        html: `<div class="custom-marker-icon">${markerData.customIcon}</div>`,
                        className: 'custom-marker',
                        iconSize: [32, 32],
                        iconAnchor: [16, 32],
                        popupAnchor: [0, -32]
                    });
                }

                const marker = L.marker([markerData.y, markerData.x], markerOptions).addTo(bridge.map);
                
                // Store marker data directly on the marker object for direct-touch.js to use
                marker.markerData = markerData;
                
                // Unified tap detection for both desktop and mobile
                let lastTapTime = 0;
                let tapTimeout = null;
                
                const handleSingleTap = () => {
                    console.log("Single tap detected on marker:", markerData.name);
                    bridge.uiModule.openInfoSidebar(markerData);
                };
                
                const handleDoubleTap = () => {
                    console.log("Double tap detected on marker:", markerData.name);
                    focusOnMarker(markerData);
                };
                
                const handleTapEvent = (e) => {
                    const now = Date.now();
                    const timeSince = now - lastTapTime;
                    
                    if (timeSince < 300 && timeSince > 0) {
                        // Double tap detected
                        clearTimeout(tapTimeout);
                        lastTapTime = 0; // Reset to prevent triple-tap
                        handleDoubleTap();
                    } else {
                        // Potential single tap - wait to see if double tap follows
                        lastTapTime = now;
                        tapTimeout = setTimeout(() => {
                            if (lastTapTime === now) {
                                handleSingleTap();
                            }
                        }, 300);
                    }
                };
                
                // Desktop click handler with delay for double-click detection
                marker.on('click', (e) => {
                    e.originalEvent.preventDefault();
                    handleTapEvent(e);
                });
                
                // Disable the default dblclick handler since we handle it manually
                marker.off('dblclick');
                
                // Make sure the marker's icon exists before we try to modify it
                if (marker._icon) {
                    // Add a data attribute to make marker identification easier
                    marker._icon.setAttribute('data-marker-id', markerData.id);
                    
                    // For iOS Safari, add explicit touch handling on the icon itself
                    if (L.Browser.touch) {
                        marker._icon.addEventListener('touchend', (e) => {
                            e.preventDefault(); // Prevent default behavior
                            console.log("Direct touchend on marker icon:", markerData.name);
                            handleTapEvent(e); // Use the same unified tap detection
                        }, false);
                    }
                } else {
                    // Leaflet might create the icon later, so we listen for when it's added to DOM
                    marker.on('add', () => {
                        if (marker._icon) {
                            marker._icon.setAttribute('data-marker-id', markerData.id);
                            
                            if (L.Browser.touch) {
                                marker._icon.addEventListener('touchend', (e) => {
                                    e.preventDefault();
                                    console.log("Delayed touchend on marker icon:", markerData.name);
                                    handleTapEvent(e); // Use the same unified tap detection
                                }, false);
                            }
                        }
                    });
                }

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
            // Removed the automatic info sidebar opening - now "Show on Map" just zooms to location
        }
        
        // Apply marker scaling after rendering
        setTimeout(() => {
            const zoom = bridge.map.getZoom();
            const maxZoom = bridge.map.getMaxZoom();
            const minZoom = bridge.map.getMinZoom();
            
            const minScale = 0.6;
            const normalizedZoom = (zoom - minZoom) / (maxZoom - minZoom);
            const scale = Math.max(minScale, 1 - (normalizedZoom * 0.4));
            
            bridge.map.eachLayer(layer => {
                if (layer instanceof L.Marker) {
                    const iconElement = layer.getElement();
                    if (iconElement && (iconElement.classList.contains('custom-marker') || iconElement.classList.contains('custom-image-marker'))) {
                        iconElement.style.transform = `scale(${scale})`;
                    }
                }
            });
        }, 50);
    }

    window.__nimea_markers_init = initMarkersModule;

})(window);

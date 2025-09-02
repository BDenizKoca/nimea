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
        // Create a layer group to hold all markers for efficient eachLayer iteration
        bridge.markerLayerGroup = L.layerGroup().addTo(bridge.map);
        
        // Set up global zoom event listener using eachLayer approach
        setupGlobalZoomScaling();
        
        console.log("Marker scaling setup complete (LayerGroup with eachLayer approach)");
    }

    /**
     * Set up global zoom scaling using eachLayer method for efficiency
     */
    function setupGlobalZoomScaling() {
        if (!bridge.map || !bridge.markerLayerGroup) return;

        let lastZoomIconState = null; // Store state to avoid unnecessary icon changes
        
        const updateAllMarkers = () => {
            const currentZoom = bridge.map.getZoom();
            const newSize = calculateIconSize(currentZoom);
            
            // Optimization: only update if size actually changed
            if (lastZoomIconState === newSize) return;
            lastZoomIconState = newSize;
            
            console.log(`Global zoom update: zoom ${currentZoom}, size ${newSize}px`);
            
            bridge.markerLayerGroup.eachLayer(function(layer) {
                if (layer.markerData) {
                    updateMarkerIcon(layer, layer.markerData, newSize);
                }
            });
        };

        // Set up single global zoom event listener
        bridge.map.on('zoomend', updateAllMarkers);
        
        // Initial size setup
        updateAllMarkers();
        
        console.log("Global zoom scaling setup complete");
    }

    /**
     * Update a single marker's icon with new size
     */
    function updateMarkerIcon(marker, markerData, newSize) {
        const ZoomIcon = createZoomResponsiveIcon();
        
        let newIcon;
        if (markerData.iconUrl) {
            // Image marker
            newIcon = new ZoomIcon({
                html: `<img src="${markerData.iconUrl}" class="custom-marker-image" style="width:100%; height:100%;">`,
                className: 'custom-image-marker zoom-responsive-marker',
                iconSize: [newSize, newSize],
                iconAnchor: [newSize/2, newSize],
                popupAnchor: [0, -newSize]
            });
        } else if (markerData.customIcon) {
            // Custom icon (emoji/text)
            newIcon = new ZoomIcon({
                html: `<div class="custom-marker-icon" style="font-size: ${newSize * 0.6}px">${markerData.customIcon}</div>`,
                className: 'custom-marker zoom-responsive-marker',
                iconSize: [newSize, newSize],
                iconAnchor: [newSize/2, newSize],
                popupAnchor: [0, -newSize]
            });
        } else {
            // Default marker
            newIcon = new ZoomIcon({
                html: `<div class="custom-marker-icon" style="font-size: ${newSize * 0.6}px; width: ${newSize}px; height: ${newSize}px;">📍</div>`,
                className: 'custom-marker zoom-responsive-marker',
                iconSize: [newSize, newSize],
                iconAnchor: [newSize/2, newSize],
                popupAnchor: [0, -newSize]
            });
        }
        
        if (newIcon) {
            marker.setIcon(newIcon);
        }
    }

    /**
     * Create a zoom-responsive icon class
     */
    function createZoomResponsiveIcon(baseSize = 48) {
        const ZoomIcon = L.DivIcon.extend({
            options: {
                className: 'custom-marker zoom-responsive-marker',
                iconSize: [baseSize, baseSize],
                iconAnchor: [baseSize/2, baseSize],
                popupAnchor: [0, -baseSize]
            }
        });
        return ZoomIcon;
    }

    /**
     * Calculate icon size based on zoom level using your formula
     */
    function calculateIconSize(zoom, baseSize = 60) {
        // Using your formula: newSize = 60/((20 - actualZoom )*2)
        const rawSize = baseSize / ((20 - zoom) * 2);
        // Clamp size between reasonable bounds
        const clampedSize = Math.max(20, Math.min(80, rawSize));
        console.log(`Zoom ${zoom}: formula gives ${rawSize.toFixed(1)}px, clamped to ${clampedSize}px`);
        return clampedSize;
    }

    function renderMarkers() {
        // Clean up existing markers from layer group to prevent memory leaks
        if (bridge.markerLayerGroup) {
            bridge.markerLayerGroup.clearLayers();
        } else {
            // Fallback: clean up markers from map directly
            bridge.map.eachLayer(layer => {
                if (layer instanceof L.Marker && !layer.options.isPending) {
                    bridge.map.removeLayer(layer);
                }
            });
        }
        
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

                // Create marker and add to layer group instead of directly to map
                const marker = L.marker([markerData.y, markerData.x], markerOptions);
                
                // Store marker data directly on the marker object
                marker.markerData = markerData;
                
                // Set initial icon immediately using current zoom level
                const currentZoom = bridge.map.getZoom();
                const initialSize = calculateIconSize(currentZoom);
                updateMarkerIcon(marker, markerData, initialSize);
                
                // Add to our marker layer group for efficient eachLayer iteration
                if (bridge.markerLayerGroup) {
                    bridge.markerLayerGroup.addLayer(marker);
                } else {
                    // Fallback: add directly to map if layer group not ready
                    marker.addTo(bridge.map);
                }
                
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
    }

    window.__nimea_markers_init = initMarkersModule;

})(window);

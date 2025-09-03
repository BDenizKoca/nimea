// map/js/markers.js - Marker rendering and management

(function(window) {
    'use strict';

    let bridge = {};
    let allMarkers = []; // Keep a reference to all markers

    function initMarkersModule(nimeaBridge) {
        bridge = nimeaBridge;
        if (!bridge) {
            console.error("Markers module requires the global Nimea bridge.");
            return;
        }

        bridge.markersModule = {
            renderMarkers
        };
        
        setupMarkerScaling();
        console.log("Markers module initialized.");
    }

    function setupMarkerScaling() {
        if (!bridge.map) return;
        
        bridge.map.on('zoomend', function() {
            updateAllMarkerSizes();
        });
        
        console.log("Marker scaling setup complete.");
    }

    function calculateIconSize(zoom) {
        // Exponential scaling for a more natural feel
        // Adjust the base (1.3) and multiplier (10) to fine-tune
        const size = Math.pow(1.3, zoom) * 10;
        // Clamp the size to reasonable limits
        return Math.max(16, Math.min(80, size));
    }

    function updateAllMarkerSizes() {
        const zoom = bridge.map.getZoom();
        const newSize = calculateIconSize(zoom);

        allMarkers.forEach(marker => {
            // Only scale custom icons, not default Leaflet ones
            if (marker.markerData && (marker.markerData.iconUrl || marker.markerData.customIcon)) {
                const icon = marker.getIcon();
                if (icon) {
                    // Update icon options directly
                    icon.options.iconSize = [newSize, newSize];
                    icon.options.iconAnchor = [newSize / 2, newSize];
                    icon.options.popupAnchor = [0, -newSize];
                    
                    // Crucially, update the font size for text/emoji icons
                    if (icon.options.html && icon.options.html.includes('custom-marker-icon')) {
                        // Re-create the HTML with the new font size
                        icon.options.html = `<div class="custom-marker-icon" style="font-size: ${newSize * 0.6}px">${marker.markerData.customIcon}</div>`;
                    }

                    // Re-apply the icon to force a re-render
                    marker.setIcon(icon);
                }
            }
        });
    }

    function createMarkerIcon(markerData, initialSize) {
        let iconHtml = '';
        let iconClass = 'custom-marker';

        if (markerData.iconUrl) {
            iconHtml = `<img src="${markerData.iconUrl}" class="custom-marker-image" style="width:100%; height:100%;">`;
            iconClass += ' custom-image-marker';
        } else if (markerData.customIcon) {
            iconHtml = `<div class="custom-marker-icon" style="font-size: ${initialSize * 0.6}px">${markerData.customIcon}</div>`;
        } else {
            return null; // Use Leaflet's default icon
        }

        return L.divIcon({
            html: iconHtml,
            className: iconClass,
            iconSize: [initialSize, initialSize],
            iconAnchor: [initialSize / 2, initialSize],
            popupAnchor: [0, -initialSize]
        });
    }

    function renderMarkers() {
        // Clear existing markers from the map and our reference array
        allMarkers.forEach(marker => bridge.map.removeLayer(marker));
        allMarkers = [];
        
        let focusMarkerInstance = null;
        
        bridge.state.markers.forEach(markerData => {
            if (markerData.isWaypoint) return;
            
            if (markerData.public || bridge.state.isDmMode) {
                const initialZoom = bridge.map.getZoom();
                const initialSize = calculateIconSize(initialZoom);
                const icon = createMarkerIcon(markerData, initialSize);
                
                let markerOptions = {
                    draggable: bridge.state.isDmMode,
                    riseOnHover: true
                };

                if (icon) {
                    markerOptions.icon = icon;
                }

                const marker = L.marker([markerData.y, markerData.x], markerOptions).addTo(bridge.map);
                marker.markerData = markerData;
                allMarkers.push(marker); // Add to our list for scaling
                
                // Unified tap detection
                let lastTapTime = 0;
                let tapTimeout = null;
                
                const handleSingleTap = () => bridge.uiModule.openInfoSidebar(markerData);
                const handleDoubleTap = () => focusOnMarker(markerData);
                
                const handleTapEvent = () => {
                    const now = Date.now();
                    if (now - lastTapTime < 300) {
                        clearTimeout(tapTimeout);
                        lastTapTime = 0;
                        handleDoubleTap();
                    } else {
                        lastTapTime = now;
                        tapTimeout = setTimeout(() => {
                            if (lastTapTime === now) handleSingleTap();
                        }, 300);
                    }
                };
                
                marker.on('click', handleTapEvent);
                marker.off('dblclick');
                
                marker.on('add', () => {
                    if (marker._icon) {
                        marker._icon.setAttribute('data-marker-id', markerData.id);
                    }
                });

                function focusOnMarker(markerData) {
                    bridge.map.flyTo([markerData.y, markerData.x], Math.max(2.2, bridge.map.getZoom()), {
                        duration: 1.0,
                        easeLinearity: 0.25
                    });
                    setTimeout(() => bridge.uiModule.openInfoSidebar(markerData), 400);
                }
                
                if (bridge.state.isDmMode) {
                    marker.on('dragend', function(e) {
                        const newPos = e.target.getLatLng();
                        markerData.y = Math.round(newPos.lat);
                        markerData.x = Math.round(newPos.lng);
                        
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
        
        if (focusMarkerInstance) {
            bridge.uiModule.closeInfoSidebar();
            bridge.map.flyTo([focusMarkerInstance.data.y, focusMarkerInstance.data.x], 2.2, {
                duration: 1.5,
                easeLinearity: 0.25
            });
        }
        
        // Initial size update after rendering
        updateAllMarkerSizes();
    }

    window.__nimea_markers_init = initMarkersModule;

})(window);
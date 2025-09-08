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
        
        // Update marker sizes continuously during zoom and after zoom ends
        bridge.map.on('zoom', updateAllMarkerSizes);
        bridge.map.on('zoomend', updateAllMarkerSizes);
        
        // Ensure a correct initial size in case render happens before first zoom event
        setTimeout(updateAllMarkerSizes, 0);
        
        console.log("Marker scaling setup complete.");
    }

    function calculateIconSize(zoom) {
        // Map the current zoom onto a 0..1 range using the map's min/max zoom
        const map = bridge.map;
        const minZ = (map && typeof map.getMinZoom === 'function') ? map.getMinZoom() : -3;
        const maxZ = (map && typeof map.getMaxZoom === 'function') ? map.getMaxZoom() : 4;
        // Guard against division by zero
        const span = Math.max(1, (maxZ - minZ));
        const t = (zoom - minZ) / span; // 0 at min zoom, 1 at max zoom
        
        // Apply a slight ease to bias sizes larger at common zooms
        const eased = Math.pow(t, 1.15); // tweak exponent for feel
        
        // Choose generous bounds so icons are big when zoomed in, smaller when zoomed out
        const minSize = 22; // slightly larger at far zoom-out
        const maxSize = 140; // bigger at max zoom-in
        const size = minSize + eased * (maxSize - minSize);
        
        return Math.round(size);
    }

function updateAllMarkerSizes() {
    const zoom = bridge.map.getZoom();
    const newSize = calculateIconSize(zoom);

    allMarkers.forEach(marker => {
        // Only scale custom icons
        if (marker.markerData && (marker.markerData.iconUrl || marker.markerData.customIcon)) {
            const icon = marker.getIcon();
            if (icon) {
                // Update the icon's size and anchor options
                icon.options.iconSize = [newSize, newSize];
                icon.options.iconAnchor = [newSize / 2, newSize];
                icon.options.popupAnchor = [0, -newSize];
                
                // CRITICAL FIX: For emoji/text icons, the font-size within the HTML must be updated.
                if (marker.markerData.customIcon) {
                    icon.options.html = `<div class=\"custom-marker-icon\" style=\"font-size: ${Math.round(newSize * 0.78)}px\">${marker.markerData.customIcon}</div>`;
                }

                // Re-apply the icon to the marker to force a re-render with the new options
                marker.setIcon(icon);
            }
        }
    });
}

    function createMarkerIcon(markerData, initialSize) {
        let iconHtml = '';
        let iconClass = 'custom-marker';

        if (markerData.iconUrl) {
            iconHtml = `<img src="${markerData.iconUrl}" class="custom-marker-image" style="display:block; width:100%; height:100%; object-fit:contain;">`;
            iconClass += ' custom-image-marker';
        } else if (markerData.customIcon) {
            iconHtml = `<div class=\"custom-marker-icon\" style=\"font-size:${Math.round(initialSize * 0.78)}px; width:100%; height:100%; display:flex; align-items:center; justify-content:center;\">${markerData.customIcon}</div>`;
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
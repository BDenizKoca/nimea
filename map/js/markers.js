// map/js/markers.js - Marker rendering and management

(function(window) {
    'use strict';

    let bridge = {};

    // Define a reusable, zoom-responsive DivIcon class
    const ZoomIcon = L.DivIcon.extend({
        createIcon: function(oldIcon) {
            const div = L.DivIcon.prototype.createIcon.call(this, oldIcon);
            this._setIconStyles(div, 'icon');
            this._updateIconSize(div); // Set initial size
            return div;
        },

        _updateIconSize: function(icon) {
            if (!icon) return;
            const zoom = bridge.map ? bridge.map.getZoom() : 1; // Default zoom if map not ready
            const newSize = this.options.calculateSize(zoom);
            
            icon.style.width = `${newSize}px`;
            icon.style.height = `${newSize}px`;

            // Adjust font size for text/emoji icons
            if (this.options.html.includes('custom-marker-icon')) {
                const fontElement = icon.querySelector('.custom-marker-icon');
                if (fontElement) {
                    fontElement.style.fontSize = `${newSize * 0.6}px`;
                }
            }
        },
        
        _updateAllIcons: function() {
            if (!this._map) return;
            this._map.eachLayer(layer => {
                if (layer.options.icon instanceof ZoomIcon) {
                    layer.options.icon._updateIconSize(layer._icon);
                    // Also update anchor and popup anchor
                    const newSize = parseFloat(layer._icon.style.width);
                    layer.options.icon.options.iconAnchor = [newSize / 2, newSize];
                    layer.options.icon.options.popupAnchor = [0, -newSize];
                    if (layer.getPopup()) {
                        layer.getPopup().options.offset = [0, -newSize];
                    }
                }
            });
        }
    });

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
        
        // Create a single instance of our icon class to manage all icons
        const zoomIconManager = new ZoomIcon({ calculateSize: calculateIconSize });
        
        // Listen to zoom events and update all icons
        bridge.map.on('zoomend', () => {
            zoomIconManager._updateAllIcons();
        });
        
        console.log("Marker scaling setup complete.");
    }

    function calculateIconSize(zoom, baseSize = 48, minSize = 16, maxSize = 64) {
        // Formula: size = baseSize / ( (20 - zoom) * 1.5 )
        const rawSize = baseSize / ((20 - zoom) * 1.5);
        // Clamp size between reasonable bounds
        return Math.max(minSize, Math.min(maxSize, rawSize));
    }

    function createMarkerIcon(markerData) {
        const initialZoom = bridge.map ? bridge.map.getZoom() : 1;
        const initialSize = calculateIconSize(initialZoom);

        let iconHtml = '';
        let iconClass = 'custom-marker zoom-responsive-marker';

        if (markerData.iconUrl) {
            iconHtml = `<img src="${markerData.iconUrl}" class="custom-marker-image" style="width:100%; height:100%;">`;
            iconClass += ' custom-image-marker';
        } else if (markerData.customIcon) {
            iconHtml = `<div class="custom-marker-icon" style="font-size: ${initialSize * 0.6}px">${markerData.customIcon}</div>`;
        } else {
            return null; // Use Leaflet's default icon
        }

        return new ZoomIcon({
            html: iconHtml,
            className: iconClass,
            calculateSize: calculateIconSize,
            iconSize: [initialSize, initialSize], // Initial size
            iconAnchor: [initialSize / 2, initialSize],
            popupAnchor: [0, -initialSize]
        });
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
            if (markerData.isWaypoint) return;
            
            if (markerData.public || bridge.state.isDmMode) {
                const icon = createMarkerIcon(markerData);
                
                let markerOptions = {
                    draggable: bridge.state.isDmMode,
                    riseOnHover: true
                };

                if (icon) {
                    markerOptions.icon = icon;
                }

                const marker = L.marker([markerData.y, markerData.x], markerOptions).addTo(bridge.map);
                marker.markerData = markerData;
                
                // Unified tap detection for both desktop and mobile
                let lastTapTime = 0;
                let tapTimeout = null;
                
                const handleSingleTap = () => {
                    bridge.uiModule.openInfoSidebar(markerData);
                };
                
                const handleDoubleTap = () => {
                    focusOnMarker(markerData);
                };
                
                const handleTapEvent = (e) => {
                    const now = Date.now();
                    const timeSince = now - lastTapTime;
                    
                    if (timeSince < 300 && timeSince > 0) {
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
                marker.off('dblclick'); // Disable default double-click
                
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
    }

    window.__nimea_markers_init = initMarkersModule;

})(window);
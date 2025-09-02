// direct-touch.js - Handles all mobile touch interactions directly
// This approach bypasses Leaflet's event system for maximum compatibility

(function(window) {
    'use strict';

    let bridge = {};
    let activeTouches = {};
    
    function initDirectTouchModule(nimeaBridge) {
        bridge = nimeaBridge;
        if (!bridge || !bridge.map) {
            console.error("Direct touch module requires the Nimea bridge with map.");
            return;
        }
        
        setupGlobalTouchHandlers();
        console.log("Direct touch module initialized.");
    }
    
    function setupGlobalTouchHandlers() {
        const mapContainer = bridge.map.getContainer();
        
        // Attach touch event handlers to the map container
        mapContainer.addEventListener('touchstart', handleTouchStart, { passive: false });
        mapContainer.addEventListener('touchend', handleTouchEnd, { passive: false });
        mapContainer.addEventListener('touchcancel', handleTouchCancel, { passive: false });
        
        console.log("Global touch handlers enabled");
    }
    
    function handleTouchStart(e) {
        // Don't prevent default here - let scrolling and zooming work
        
        // Record touch start details
        Array.from(e.touches).forEach(touch => {
            activeTouches[touch.identifier] = {
                startX: touch.clientX,
                startY: touch.clientY,
                startTime: Date.now(),
                target: touch.target
            };
        });
    }
    
    function handleTouchEnd(e) {
        // For each touch that ended
        Array.from(e.changedTouches).forEach(touch => {
            const touchId = touch.identifier;
            const touchData = activeTouches[touchId];
            
            // Only proceed if we have data for this touch
            if (touchData) {
                const duration = Date.now() - touchData.startTime;
                const deltaX = Math.abs(touch.clientX - touchData.startX);
                const deltaY = Math.abs(touch.clientY - touchData.startY);
                const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
                
                // If this was a quick tap without much movement
                if (duration < 500 && distance < 10) {
                    // Find if this was on a marker
                    const element = touchData.target;
                    
                    // Check if this element or any parent is a marker icon
                    let current = element;
                    let foundMarker = null;
                    
                    // Search up to 5 levels deep for a marker
                    for (let i = 0; i < 5; i++) {
                        if (!current) break;
                        
                        // Check for Leaflet marker icon classes
                        if (current.classList && 
                            (current.classList.contains('leaflet-marker-icon') || 
                             current.classList.contains('leaflet-interactive'))) {
                            
                            // Found a marker element, now find the actual marker instance
                            foundMarker = findMarkerFromElement(current);
                            break;
                        }
                        
                        current = current.parentElement;
                    }
                    
                    // If we found a marker, handle the tap
                    if (foundMarker) {
                        e.preventDefault(); // Prevent any other handlers
                        console.log("Direct touch module detected tap on marker:", foundMarker.markerData ? foundMarker.markerData.name : 'unknown');
                        
                        // If this marker has associated data, open the info sidebar
                        if (foundMarker.markerData) {
                            bridge.uiModule.openInfoSidebar(foundMarker.markerData);
                        }
                    }
                }
                
                // Clean up this touch data
                delete activeTouches[touchId];
            }
        });
    }
    
    function handleTouchCancel(e) {
        // Clean up any active touches that were cancelled
        Array.from(e.changedTouches).forEach(touch => {
            delete activeTouches[touch.identifier];
        });
    }
    
    // Helper function to find the marker instance from a DOM element
    function findMarkerFromElement(element) {
        // This is a bit of a hack, but we can try to find the marker by iterating
        // through all layers on the map and checking if any marker's icon element matches
        let foundMarker = null;
        
        bridge.map.eachLayer(layer => {
            if (layer instanceof L.Marker && layer._icon === element) {
                foundMarker = layer;
            }
        });
        
        return foundMarker;
    }
    
    // We'll add a method to link marker DOM elements with their data
    // This will be called from markers.js during marker creation
    function registerMarkerElement(marker, markerData) {
        if (marker && marker._icon) {
            marker.markerData = markerData;
        }
    }
    
    window.__nimea_direct_touch_init = initDirectTouchModule;
    
    // Export public methods
    return {
        registerMarkerElement
    };
    
})(window);
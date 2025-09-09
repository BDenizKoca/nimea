// map/js/routing/route-ui.js - UI management for route display and interactions

(function(window) {
    'use strict';

    let bridge = {};
    let domCache = {};
    let routeDragDrop = {};

    /**
     * Initialize the route UI module
     */
    function initRouteUI(bridgeObj, domCacheObj, routeDragDropObj) {
        bridge = bridgeObj;
        domCache = domCacheObj;
        routeDragDrop = routeDragDropObj;
        
    (window.__nimea_log && __nimea_log.log)("Route UI module initialized");
    }

    /**
     * Set up permanent event delegation for route control buttons
     * This only needs to be called once during module initialization
     */
    function setupRouteEventDelegation() {
        const stopsDiv = domCache.get('route-stops');
    (window.__nimea_log && __nimea_log.log)("Setting up route event delegation - stopsDiv:", stopsDiv);
        
        if (!stopsDiv) {
            (window.__nimea_log && __nimea_log.error)("Route stops container not found - trying direct getElementById");
            const fallbackStopsDiv = document.getElementById('route-stops');
            (window.__nimea_log && __nimea_log.log)("Fallback stopsDiv:", fallbackStopsDiv);
            if (fallbackStopsDiv) {
                (window.__nimea_log && __nimea_log.log)("Using fallback element for event delegation");
                fallbackStopsDiv.addEventListener('click', handleRouteStopClick);
            }
            return;
        }
        
        // Use permanent event delegation - this listener will handle all future button clicks
    (window.__nimea_log && __nimea_log.log)("Adding click event listener to stopsDiv");
        stopsDiv.addEventListener('click', handleRouteStopClick);
        
        // Set up delegation for the clear button too (it's outside the stops div)
        const routeSidebar = domCache.get('route-sidebar');
        if (routeSidebar) {
            routeSidebar.addEventListener('click', handleClearButtonClick);
        }
        
    (window.__nimea_log && __nimea_log.log)("Route event delegation set up permanently");
    }

    /**
     * Handle clicks on clear route button specifically
     */
    function handleClearButtonClick(e) {
        if (e.target.id === 'clear-route-btn') {
            e.preventDefault();
            e.stopPropagation();
            (window.__nimea_log && __nimea_log.log)("Clear route button clicked via delegation");
            if (bridge.routingModule && bridge.routingModule.clearRoute) {
                bridge.routingModule.clearRoute();
            }
        }
    }

    /**
     * Delegated event handler for route stop interactions
     */
    function handleRouteStopClick(e) {
        const target = e.target;
    (window.__nimea_log && __nimea_log.log)("Route stop click detected:", target, "classes:", target.classList.toString(), "dataset:", target.dataset);
        
        // Handle remove button clicks
        if (target.classList.contains('mini-btn') && target.dataset.ridx !== undefined) {
            e.preventDefault();
            e.stopPropagation();
            const ridx = parseInt(target.dataset.ridx, 10);
            (window.__nimea_log && __nimea_log.log)("Remove button clicked for index:", ridx);
            if (bridge.routingModule && bridge.routingModule.removeRouteIndex) {
                (window.__nimea_log && __nimea_log.log)("Calling removeRouteIndex with:", ridx);
                bridge.routingModule.removeRouteIndex(ridx);
            } else {
                (window.__nimea_log && __nimea_log.error)("removeRouteIndex not available on bridge.routingModule");
            }
            return;
        }
        
    (window.__nimea_log && __nimea_log.log)("Click not handled - target doesn't match remove button criteria");
    }

    /**
     * Update route display with current stops and drag-drop support
     */
    function updateRouteDisplay(reorderCallback) {
        const stopsDiv = domCache.get('route-stops');
        if (!stopsDiv) {
            (window.__nimea_log && __nimea_log.error)('Route stops container not found');
            return;
        }

        try {
            // Add debugging to understand what's happening
            (window.__nimea_log && __nimea_log.log)("updateRouteDisplay called - bridge.state:", bridge.state);
            (window.__nimea_log && __nimea_log.log)("bridge.state.route:", bridge.state.route, "type:", typeof bridge.state.route, "isArray:", Array.isArray(bridge.state.route));
            
            if (!bridge.state.route || !Array.isArray(bridge.state.route)) {
                (window.__nimea_log && __nimea_log.error)("bridge.state.route is not a valid array:", bridge.state.route);
                stopsDiv.innerHTML = '<div class="error-message">Route data is invalid. Please refresh the page.</div>';
                return;
            }
            
            stopsDiv.innerHTML = bridge.state.route.map((stop, idx) => {
                (window.__nimea_log && __nimea_log.log)(`Rendering stop ${idx}:`, stop);
                const stopType = stop.isWaypoint ? 'waypoint' : 'marker';
                return `<div class="route-stop-row" draggable="true" data-route-index="${idx}">
                            <span class="drag-handle">⋮⋮</span>
                            <span class="stop-info">${idx+1}. ${stop.name}</span>
                            <button class="mini-btn" data-ridx="${idx}" title="Remove stop">✖</button>
                        </div>`;
    }).join('') + (bridge.state.route.length ? `<div class="route-actions">
        <button id="clear-route-btn" class="wiki-link clear-route-btn">${window.nimeaI18n ? window.nimeaI18n.t('clearRoute') : (window.location.pathname.startsWith('/en') ? 'Clear Route' : 'Rotayı Temizle')}</button>
            </div>` : '');
        
            // Event delegation handles all button clicks automatically
            // No need to manually attach event listeners here anymore
            
            // Setup drag and drop functionality (ALWAYS re-initialize after DOM update)
            if (bridge.state.route.length > 1) {
                // Clear the flag since we're regenerating HTML and need fresh event listeners
                stopsDiv._dragInitialized = false;
                routeDragDrop.setupDragAndDrop(stopsDiv, reorderCallback);
            }
        } catch (error) {
            (window.__nimea_log && __nimea_log.error)('Error updating route display:', error);
            // Fallback: ensure the div is cleared in case of partial failure
            if (stopsDiv) {
                stopsDiv.innerHTML = '<div class="error-message">Error loading route. Please refresh the page.</div>';
            }
        }
    }

    /**
     * Open route sidebar and show route
     */
    function openRouteSidebar() {
        const routeSidebar = domCache.get('route-sidebar');
        if (routeSidebar) {
            routeSidebar.classList.add('open');
        }
    }

    // Expose public functions
    window.__nimea_route_ui = {
        initRouteUI,
        setupRouteEventDelegation,
        updateRouteDisplay,
        openRouteSidebar
    };

})(window);
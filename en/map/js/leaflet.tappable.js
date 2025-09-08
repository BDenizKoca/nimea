/*
 * leaflet.tappable.js - Super simple touch handler for markers
 * A lightweight solution to handle tap events properly on mobile devices
 */
(function(L) {
    'use strict';
    
    // Very simple approach - just override the click handler with direct mobile tap detection
    L.Marker.include({
        enableTappable: function(clickCallback, dblClickCallback) {
            // Store callbacks
            this._singleTapCallback = clickCallback;
            this._doubleTapCallback = dblClickCallback;
            
            // Only proceed if we have an icon to attach events to
            if (!this._icon) {
                return this;
            }
            
            // Remove existing handlers to avoid duplication
            this.disableTappable();
            
            // Simple tap detection variables
            this._lastTap = 0;
            
            // Add new handlers - use touchend as it's more reliable across devices
            this._tappableHandler = (e) => {
                // Prevent the default click behavior
                L.DomEvent.preventDefault(e);
                L.DomEvent.stopPropagation(e);
                
                const now = Date.now();
                const timeSince = now - this._lastTap;
                
                if (timeSince < 300 && timeSince > 0) {
                    // Double tap detected
                    if (this._doubleTapCallback) {
                        this._doubleTapCallback(e);
                    }
                    this._lastTap = 0; // Reset to prevent triple-tap
                } else {
                    // Single tap - use timeout to wait for potential double tap
                    setTimeout(() => {
                        if (this._lastTap === now && this._singleTapCallback) {
                            this._singleTapCallback(e);
                        }
                    }, 300);
                    this._lastTap = now;
                }
            };
            
            // Apply the handlers
            if (L.Browser.touch) {
                L.DomEvent.on(this._icon, 'touchend', this._tappableHandler);
                console.log("Tappable touch handler added to marker");
            }
            
            return this;
        },
        
        disableTappable: function() {
            if (this._icon && this._tappableHandler) {
                L.DomEvent.off(this._icon, 'touchend', this._tappableHandler);
            }
            return this;
        }
    });
})(L);

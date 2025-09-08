// map/js/dm.js

(function(window) {
    'use strict';

    // This will be our connection to the main map script
    let bridge = {};

    // Module instances
    let dmControls = null;
    let dmModals = null;

    /**
     * Initializes the DM module.
     * This function is called by the main map script.
     * @param {object} nimeaBridge - The global bridge object from map.js
     */
    function initDmModule(nimeaBridge) {
        bridge = nimeaBridge;
        if (!bridge || !bridge.map) {
            console.error("DM module requires the global Nimea bridge with a map instance.");
            return;
        }

        // Check if required classes are available
        if (!window.DmControls) {
            console.error("DmControls class not found. Make sure dm-controls.js is loaded before dm.js");
            return;
        }
        if (!window.DmModals) {
            console.error("DmModals class not found. Make sure dm-modals.js is loaded before dm.js");
            return;
        }

        // Initialize sub-modules
        dmControls = new window.DmControls(bridge);
        dmModals = new window.DmModals(bridge);

        // Expose public functions via the bridge
        bridge.dmModule = {
            setupDmMode,
            saveMarkerFromForm: () => dmModals.saveMarkerFromForm(),
            updateMarkerPosition,
            editMarker: (markerData) => dmModals.editMarker(markerData),
            deleteMarker,
            openBulkImportModal: () => dmModals.openBulkImportModal(),
            exportData,
            publishAll
        };
        
        // Add helper functions from the main script that we need to the bridge if they aren't there
        // This makes the DM module more self-contained
        bridge.generateIdFromName = bridge.generateIdFromName || generateIdFromName;
        bridge.styleTerrainLayer = bridge.styleTerrainLayer || styleTerrainLayer;
        bridge.renderExistingTerrain = bridge.renderExistingTerrain || function() {
            if (bridge.terrainModule) {
                bridge.terrainModule.renderTerrain();
            }
        };
        bridge.openInfoSidebar = bridge.openInfoSidebar || function() { 
            console.error('openInfoSidebar not implemented on bridge'); 
        };
    }

    /**
     * Sets up all DM-related controls and event listeners.
     * This is the main entry point for DM functionality.
     */
    async function setupDmMode() {
        // If not in DM mode, we're done here.
        if (!bridge.state.isDmMode) {
            return;
        }

        // Initialize Git Gateway for live CMS functionality
        await initializeGitClient();

        // Add Leaflet-Geoman controls for drawing
        addGeomanControls();

        // Add all custom DM controls via the controls module
        dmControls.addAllControls();

        // Set up modals via the modals module
        dmModals.setupAllModals();

        // Set up Leaflet-Geoman event listeners
        setupMapEventListeners();
    }

    /**
     * Initializes the Git client for live CMS functionality
     */
    async function initializeGitClient() {
        try {
            await window.gitClient.initialize();
            if (window.gitClient.isAuthenticated) {
                bridge.state.isLiveCMS = true;
                bridge.showNotification('Live CMS mode enabled - changes save directly to repository!', 'success');
            } else {
                bridge.showNotification('Click "Login" to enable live CMS mode', 'info');
            }
        } catch (error) {
            console.warn('Git Gateway not available:', error);
            bridge.showNotification('Offline mode - use Export button to save data', 'info');
        }
    }

    /**
     * Adds Leaflet-Geoman drawing controls to the map
     */
    function addGeomanControls() {
        bridge.map.pm.addControls({
            position: 'topleft',
            drawMarker: true,
            drawPolygon: true,
            drawPolyline: true,
            editMode: true,
            removalMode: true,
        });
    }

    /**
     * Sets up all map event listeners for Geoman interactions
     */
    function setupMapEventListeners() {
        // Listen for new shapes created by Geoman
        bridge.map.on('pm:create', async (e) => {
            if (e.shape === 'Marker') {
                const marker = e.layer;
                marker.options.isPending = true; // Mark to avoid cleanup by other functions
                dmModals.setPendingMarker(marker);
                dmModals.openMarkerCreationModal(marker.getLatLng());
            } else if (e.shape === 'Polygon' || e.shape === 'Line') {
                dmModals.setPendingTerrain(e.layer);
                await dmModals.openTerrainTypeModal(dmControls); 
            }
        });

        // Listen for shapes being removed by Geoman
        bridge.map.on('pm:remove', (e) => {
            if (e.layer && e.layer.feature) {
                const removedId = e.layer.feature.properties._internal_id;
                if (!removedId) return; 

                const features = bridge.state.terrain.features;
                const index = features.findIndex(f => f.properties._internal_id === removedId);

                if (index > -1) {
                    features.splice(index, 1);
                    bridge.markDirty('terrain');
                    bridge.showNotification('Terrain feature removed.', 'success');
                }
            }
        });

        // Listen for shapes being edited by Geoman
        bridge.map.on('pm:edit', (e) => {
            if (e.layer && e.layer.feature) {
                const editedId = e.layer.feature.properties._internal_id;
                if (!editedId) return;

                const featureToUpdate = bridge.state.terrain.features.find(f => f.properties._internal_id === editedId);

                if (featureToUpdate) {
                    featureToUpdate.geometry = e.layer.toGeoJSON().geometry;
                    bridge.markDirty('terrain');
                    bridge.showNotification('Terrain feature updated.', 'info');
                }
            }
        });
    }

    /**
     * Updates an existing marker's position when dragged.
     * @param {object} markerData - The marker data object to update
     */
    function updateMarkerPosition(markerData) {
        // Find the marker in the state and update it
        const markerIndex = bridge.state.markers.findIndex(m => m.id === markerData.id);
        if (markerIndex !== -1) {
            bridge.state.markers[markerIndex] = markerData;
            bridge.markDirty('markers');
            console.log(`Updated marker "${markerData.name}" position to [${markerData.y}, ${markerData.x}]`);
            bridge.showNotification(`Moved "${markerData.name}"`, 'success');
        } else {
            console.error('Could not find marker to update:', markerData.id);
        }
    }
    
    /**
     * Deletes a marker by its ID
     * @param {string} markerId - The ID of the marker to delete
     */
    function deleteMarker(markerId) {
        if (!markerId) return;
        
        const markerIndex = bridge.state.markers.findIndex(m => m.id === markerId);
        if (markerIndex === -1) {
            console.error('Could not find marker to delete:', markerId);
            return;
        }
        
        const markerName = bridge.state.markers[markerIndex].name;
        
        // Remove the marker from the state
        bridge.state.markers.splice(markerIndex, 1);
        
        // Re-render all markers to remove it from the map
        if (bridge.markersModule && bridge.markersModule.renderMarkers) {
            bridge.markersModule.renderMarkers();
        }
        
        bridge.markDirty('markers');
        bridge.showNotification(`Marker "${markerName}" deleted`, 'success');
    }

    /**
     * Triggers a file download for the current marker and terrain data.
     */
    function exportData() {
        const markersBlob = new Blob([JSON.stringify({ markers: bridge.state.markers }, null, 2)], { type: 'application/json' });
        download(markersBlob, 'markers.json');

        const terrainBlob = new Blob([JSON.stringify(bridge.state.terrain, null, 2)], { type: 'application/json' });
        download(terrainBlob, 'terrain.geojson');
    }

    /**
     * Publishes all dirty data (markers, terrain) to the Git repository.
     */
    async function publishAll() {
        if (!window.gitClient || !window.gitClient.isAuthenticated) {
            bridge.showNotification('Login required to publish changes. Use Download button to save offline.', 'error');
            return;
        }
        bridge.showNotification('Publishing changes...', 'info');
        try {
            if (bridge.state.dirty.markers) {
                await window.gitClient.saveMarkersData({ markers: bridge.state.markers });
            }
            if (bridge.state.dirty.terrain) {
                await window.gitClient.saveTerrainData(bridge.state.terrain);
            }
            await window.gitClient.triggerRedeploy();
            
            bridge.state.dirty.markers = false;
            bridge.state.dirty.terrain = false;
            dmControls.updatePublishUI();
            
            bridge.showNotification('Published & site rebuild triggered!', 'success');
        } catch (e) {
            console.error('Publish failed:', e);
            bridge.showNotification('Publish failed. Try Download button to save offline, then manually commit files.', 'error');
        }
    }

    /**
     * Helper function to download a blob as a file
     * @param {Blob} blob - The blob to download
     * @param {string} filename - The filename for the download
     */
    function download(blob, filename) {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    /**
     * Helper function to generate ID from name (fallback if not available on bridge)
     * @param {string} name - The name to convert to ID
     * @returns {string} The generated ID
     */
    function generateIdFromName(name) {
        if (!name) return '';
        return name.toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
    }

    /**
     * Helper function to style terrain layers (fallback if not available on bridge)
     * @param {L.Layer} layer - The layer to style
     * @param {string} terrainType - The type of terrain
     */
    function styleTerrainLayer(layer, terrainType) {
        const styles = bridge.config.terrainStyles || {
            road: { color: '#4a90e2', weight: 4, opacity: 0.9, dashArray: '0' },
            unpassable: { color: '#d0021b', weight: 3, opacity: 0.9, fillColor: '#d0021b', fillOpacity: 0.4 },
            difficult: { color: '#f5a623', weight: 3, opacity: 0.85, fillColor: '#f5a623', fillOpacity: 0.25, dashArray: '4,4' },
        };

        if (layer.setStyle && styles[terrainType]) {
            layer.setStyle(styles[terrainType]);
        }
    }

    // Expose the initializer function to the global scope
    window.__nimea_dm_init = initDmModule;

})(window);
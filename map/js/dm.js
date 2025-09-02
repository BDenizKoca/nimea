// map/js/dm.js

(function(window) {
    'use strict';

    // This will be our connection to the main map script
    let bridge = {};

    // Module-specific state
    let pendingMarker = null;
    let pendingTerrain = null;
    let currentTerrainMode = null;

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

        // Expose public functions via the bridge
        bridge.dmModule = {
            setupDmMode,
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
        bridge.openInfoSidebar = bridge.openInfoSidebar || function() { console.error('openInfoSidebar not implemented on bridge'); };


        console.log("DM module initialized and attached to bridge.");
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

        // From here, we are in DM mode
        addAuthenticationControls();

        console.log('Setting up DM mode controls (DM mode active)...');

        // Initialize Git Gateway for live CMS functionality
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

        // Add Leaflet-Geoman controls for drawing
        bridge.map.pm.addControls({
            position: 'topleft',
            drawMarker: true,
            drawPolygon: true,
            drawPolyline: true,
            editMode: true,
            removalMode: true,
        });

        // Add custom DM controls
        addTerrainModeControls();
        addPublishControls();
        addBulkImportButton();

        // Set up modals
        setupMarkerCreationModal();
        setupBulkImportModal();
        setupTerrainTypeModal();

        // Listen for new shapes created by Geoman
        bridge.map.on('pm:create', async (e) => {
            if (e.shape === 'Marker') {
                pendingMarker = e.layer;
                pendingMarker.options.isPending = true; // Mark to avoid cleanup by other functions
                openMarkerCreationModal(pendingMarker.getLatLng());
            } else if (e.shape === 'Polygon' || e.shape === 'Line') {
                pendingTerrain = e.layer;
                await openTerrainTypeModal(); // This will either show a modal or auto-apply the current terrain mode
            }
        });
    }

    /**
     * Adds the control for publishing changes or downloading data.
     */
    function addPublishControls() {
        const PublishControl = L.Control.extend({
            options: { position: 'topleft' },
            onAdd: function () {
                const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control dm-publish-controls');
                container.style.display = 'flex';
                container.style.flexDirection = 'column';
                container.innerHTML = `
                  <a class="leaflet-control-button" id="dm-download-json" title="Download current markers & terrain JSON">💾</a>
                  <a class="leaflet-control-button" id="dm-publish-json" title="Commit changes to repo (requires login)">⬆️</a>
                  <span class="dm-dirty-indicator" style="display:none; background:#d9534f; color:#fff; font-size:10px; padding:2px 4px; text-align:center;">UNSAVED</span>
                `;
                
                const downloadBtn = container.querySelector('#dm-download-json');
                const publishBtn = container.querySelector('#dm-publish-json');

                downloadBtn.onclick = () => exportData();
                publishBtn.onclick = async () => {
                    if (!bridge.state.dirty.markers && !bridge.state.dirty.terrain) {
                        bridge.showNotification('No changes to publish', 'info');
                        return;
                    }
                    await publishAll();
                };

                // Initial UI update
                setTimeout(updatePublishUI, 50);
                return container;
            }
        });
        bridge.map.addControl(new PublishControl());
    }

    /**
     * Updates the UI of the publish control based on auth and dirty state.
     */
    function updatePublishUI() {
        const dirty = bridge.state.dirty.markers || bridge.state.dirty.terrain;
        const publishBtn = document.getElementById('dm-publish-json');
        const badge = document.querySelector('.dm-dirty-indicator');

        if (publishBtn) {
            const canPublish = window.gitClient && window.gitClient.isAuthenticated;
            publishBtn.style.opacity = canPublish ? '1' : '0.5';
            publishBtn.style.pointerEvents = canPublish ? 'auto' : 'none';
        }
        if (badge) {
            badge.style.display = dirty ? 'block' : 'none';
        }
    }

    /**
     * Adds the "Import" button for bulk marker import.
     */
    function addBulkImportButton() {
        const ImportButton = L.Control.extend({
            options: { position: 'topleft' },
            onAdd: function () {
                const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
                const button = L.DomUtil.create('a', 'leaflet-control-button', container);
                button.innerHTML = 'Import';
                button.title = 'Bulk import markers from CSV';
                button.onclick = () => openBulkImportModal();
                return container;
            }
        });
        bridge.map.addControl(new ImportButton());
    }

    /**
     * Adds the terrain painting mode selector.
     */
    function addTerrainModeControls() {
        const TerrainControls = L.Control.extend({
            options: { position: 'topleft' },
            onAdd: function () {
                const container = L.DomUtil.create('div', 'terrain-controls');
                container.innerHTML = `
                    <div class="leaflet-bar leaflet-control">
                        <a class="leaflet-control-button terrain-mode-btn" data-mode="road" title="Paint Roads">🛤️</a>
                        <a class="leaflet-control-button terrain-mode-btn" data-mode="difficult" title="Paint Difficult Terrain">🏔️</a>
                        <a class="leaflet-control-button terrain-mode-btn" data-mode="unpassable" title="Paint Unpassable Areas">🚫</a>
                        <a class="leaflet-control-button" id="clear-terrain-mode" title="Normal Drawing">✏️</a>
                    </div>
                `;
                
                container.addEventListener('click', (e) => {
                    const button = e.target.closest('.terrain-mode-btn');
                    if (button) {
                        const mode = button.dataset.mode;
                        setTerrainMode(mode);
                        container.querySelectorAll('.terrain-mode-btn').forEach(btn => btn.classList.remove('active'));
                        button.classList.add('active');
                    }
                    
                    if (e.target.id === 'clear-terrain-mode') {
                        clearTerrainMode();
                        container.querySelectorAll('.terrain-mode-btn').forEach(btn => btn.classList.remove('active'));
                    }
                });

                return container;
            }
        });
        bridge.map.addControl(new TerrainControls());
    }

    function setTerrainMode(mode) {
        currentTerrainMode = mode;
        bridge.showNotification(`Terrain mode: ${mode}. Draw polygons/lines to paint terrain.`, 'success');
    }

    function clearTerrainMode() {
        currentTerrainMode = null;
        bridge.showNotification('Normal drawing mode enabled', 'success');
    }

    /**
     * Adds the login/logout and status controls for Netlify Identity.
     */
    function addAuthenticationControls() {
        const AuthControls = L.Control.extend({
            options: { position: 'topright' },
            onAdd: function () {
                const container = L.DomUtil.create('div', 'auth-controls');
                container.innerHTML = `
                    <div class="leaflet-bar leaflet-control">
                        <a class="leaflet-control-button" id="dm-login-btn" title="Login for Live CMS">👤</a>
                        <a class="leaflet-control-button" id="dm-status-btn" title="CMS Status">📡</a>
                    </div>
                `;
                
                const loginBtn = container.querySelector('#dm-login-btn');
                const statusBtn = container.querySelector('#dm-status-btn');
                
                loginBtn.addEventListener('click', async () => {
                    try {
                        if (window.gitClient.isAuthenticated) {
                            window.gitClient.logout();
                        } else {
                            if (!window.gitClient.initialized) {
                                await window.gitClient.initialize();
                            }
                            await window.gitClient.login();
                        }
                    } catch (e) {
                        console.error('Login button error:', e);
                        bridge.showNotification('Authentication unavailable (see console).', 'error');
                    }
                });

                statusBtn.addEventListener('click', () => {
                    const status = bridge.state.isLiveCMS 
                        ? 'Live CMS: Changes save to repository automatically' 
                        : 'Offline Mode: Use Export button to save data';
                    bridge.showNotification(status, 'info');
                });

                // Initial UI update and event listeners
                updateAuthUI();
                if (window.netlifyIdentity) {
                    window.netlifyIdentity.on('login', () => {
                        bridge.state.isLiveCMS = true;
                        updateAuthUI();
                        bridge.showNotification('Live CMS mode enabled!', 'success');
                    });
                    window.netlifyIdentity.on('logout', () => {
                        bridge.state.isLiveCMS = false;
                        updateAuthUI();
                        bridge.showNotification('Logged out. Switched to offline mode.', 'info');
                    });
                }

                return container;
            }
        });
        bridge.map.addControl(new AuthControls());
    }

    /**
     * Updates the UI of the authentication controls.
     */
    function updateAuthUI() {
        const loginBtn = document.getElementById('dm-login-btn');
        const statusBtn = document.getElementById('dm-status-btn');
        const isAuthenticated = window.gitClient && window.gitClient.isAuthenticated;

        if (loginBtn) {
            loginBtn.innerHTML = isAuthenticated ? '👤✓' : '👤';
            loginBtn.title = isAuthenticated ? 'Logout' : 'Login for Live CMS';
        }
        
        if (statusBtn) {
            statusBtn.innerHTML = bridge.state.isLiveCMS ? '📡✓' : '📡';
            statusBtn.style.color = bridge.state.isLiveCMS ? '#28a745' : '#6c757d';
        }
        
        // Also update the publish UI since it depends on auth state
        updatePublishUI();
    }

    /**
     * Sets up event listeners for the marker creation modal.
     */
    function setupMarkerCreationModal() {
        const modal = document.getElementById('marker-creation-modal');
        const form = document.getElementById('marker-form');
        const nameInput = document.getElementById('marker-name');
        const idInput = document.getElementById('marker-id');
        const cancelBtn = document.getElementById('cancel-marker');

        nameInput.addEventListener('input', () => {
            idInput.value = bridge.generateIdFromName(nameInput.value);
        });

        cancelBtn.addEventListener('click', () => {
            if (pendingMarker) {
                bridge.map.removeLayer(pendingMarker);
                pendingMarker = null;
            }
            modal.classList.add('hidden');
        });

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            saveMarkerFromForm();
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) cancelBtn.click();
        });
    }

    function openMarkerCreationModal(latLng) {
        const modal = document.getElementById('marker-creation-modal');
        document.getElementById('marker-coordinates').value = `X: ${Math.round(latLng.lng)}, Y: ${Math.round(latLng.lat)}`;
        document.getElementById('marker-form').reset();
        document.getElementById('marker-public').checked = true;
        modal.classList.remove('hidden');
        document.getElementById('marker-name').focus();
    }

    function saveMarkerFromForm() {
        const form = document.getElementById('marker-form');
        const formData = new FormData(form);
        
        const id = formData.get('marker-id');
        const name = formData.get('marker-name');
        const summary = formData.get('marker-summary');
        const type = formData.get('marker-type');
        const faction = formData.get('marker-faction');
        const isPublic = formData.get('marker-public') === 'on';
        const wikiSlug = formData.get('marker-wiki-slug');

        if (!id || !name || !summary) {
            bridge.showNotification('Please fill in all required fields', 'error');
            return;
        }
        if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
            bridge.showNotification('ID can only contain letters, numbers, hyphens, and underscores', 'error');
            return;
        }
        if (bridge.state.markers.some(m => m.id === id)) {
            bridge.showNotification('Marker ID already exists', 'error');
            return;
        }

        const newMarkerData = {
            id, name,
            x: pendingMarker.getLatLng().lng,
            y: pendingMarker.getLatLng().lat,
            type,
            faction: faction || undefined,
            summary,
            images: [],
            public: isPublic,
            wikiSlug: wikiSlug ? wikiSlug.trim() || undefined : undefined,
        };

        bridge.state.markers.push(newMarkerData);
        pendingMarker.on('click', () => bridge.openInfoSidebar(newMarkerData));
        
        bridge.markDirty('markers');
        
        document.getElementById('marker-creation-modal').classList.add('hidden');
        pendingMarker.options.isPending = false; // Unmark it
        pendingMarker = null;
        
        bridge.showNotification(`Marker "${name}" created successfully!`, 'success');
    }

    /**
     * Sets up event listeners for the terrain type selection modal.
     */
    function setupTerrainTypeModal() {
        const modal = document.getElementById('terrain-type-modal');
        const cancelBtn = document.getElementById('cancel-terrain');

        modal.querySelectorAll('.terrain-btn').forEach(button => {
            button.addEventListener('click', () => {
                const terrainType = button.dataset.type;
                saveTerrainWithType(terrainType);
                modal.classList.add('hidden');
            });
        });

        cancelBtn.addEventListener('click', () => {
            if (pendingTerrain) {
                bridge.map.removeLayer(pendingTerrain);
                pendingTerrain = null;
            }
            modal.classList.add('hidden');
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) cancelBtn.click();
        });
    }

    async function openTerrainTypeModal() {
        // If a terrain mode is active, use it automatically without showing the modal
        if (currentTerrainMode) {
            await saveTerrainWithType(currentTerrainMode);
            return;
        }
        document.getElementById('terrain-type-modal').classList.remove('hidden');
    }

    function saveTerrainWithType(terrainType) {
        if (!pendingTerrain) return;

        const feature = pendingTerrain.toGeoJSON();
        feature.properties.kind = terrainType;
        
        // The terrain module will now handle the visual representation
        if (bridge.terrainModule) {
            bridge.terrainModule.renderTerrain();
        }
        
        bridge.showNotification(`${terrainType} terrain added`, 'success');
        bridge.markDirty('terrain');
        
        pendingTerrain = null;
    }

    /**
     * Sets up event listeners for the bulk CSV import modal.
     */
    function setupBulkImportModal() {
        const modal = document.getElementById('bulk-import-modal');
        const csvInput = document.getElementById('csv-input');
        const csvFile = document.getElementById('csv-file');
        const cancelBtn = document.getElementById('cancel-import');
        const processBtn = document.getElementById('process-import');

        csvFile.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => { csvInput.value = event.target.result; };
                reader.readAsText(file);
            }
        });

        cancelBtn.addEventListener('click', () => {
            modal.classList.add('hidden');
            csvInput.value = '';
            csvFile.value = '';
        });

        processBtn.addEventListener('click', () => processBulkImport(csvInput.value));
        modal.addEventListener('click', (e) => {
            if (e.target === modal) cancelBtn.click();
        });
    }

    function openBulkImportModal() {
        document.getElementById('bulk-import-modal').classList.remove('hidden');
        document.getElementById('csv-input').focus();
    }

    function processBulkImport(csvData) {
        if (!csvData.trim()) {
            bridge.showNotification('Please enter CSV data', 'error');
            return;
        }

        const lines = csvData.trim().split('\n');
        const headers = lines[0].split(',').map(h => h.trim());
        const hasHeaders = ['name', 'x', 'y'].every(h => headers.includes(h));
        const dataLines = hasHeaders ? lines.slice(1) : lines;
        
        let imported = 0;
        let errors = [];

        dataLines.forEach((line, index) => {
            const values = line.split(',').map(v => v.trim());
            try {
                const markerData = hasHeaders 
                    ? parseCSVWithHeaders(headers, values) 
                    : parseCSVWithoutHeaders(values);
                
                if (!markerData.name || isNaN(markerData.x) || isNaN(markerData.y)) {
                    errors.push(`Row ${index + 1}: Missing or invalid required fields (name, x, y)`);
                    return;
                }
                if (bridge.state.markers.some(m => m.id === markerData.id)) {
                    errors.push(`Row ${index + 1}: Marker ID "${markerData.id}" already exists`);
                    return;
                }

                bridge.state.markers.push(markerData);
                const marker = L.marker([markerData.y, markerData.x]).addTo(bridge.map);
                marker.on('click', () => bridge.openInfoSidebar(markerData));
                imported++;
                
            } catch (error) {
                errors.push(`Row ${index + 1}: ${error.message}`);
            }
        });

        if (imported > 0) {
            bridge.showNotification(`Imported ${imported} markers (not published yet)`, 'success');
            bridge.markDirty('markers');
        }
        if (errors.length > 0) {
            console.warn('Import errors:', errors);
            bridge.showNotification(`Imported ${imported} with ${errors.length} errors. See console.`, 'error');
        }

        document.getElementById('bulk-import-modal').classList.add('hidden');
    }

    function parseCSVWithHeaders(headers, values) {
        const data = {};
        headers.forEach((header, i) => { data[header] = values[i] || ''; });
        
        return {
            id: data.id || bridge.generateIdFromName(data.name),
            name: data.name,
            x: parseFloat(data.x),
            y: parseFloat(data.y),
            type: data.type || 'other',
            faction: data.faction || undefined,
            summary: data.summary || '',
            images: [],
            public: ['true', '1', 'yes'].includes((data.public || '').toLowerCase()),
        };
    }

    function parseCSVWithoutHeaders(values) {
        // Assume order: name,x,y,type,faction,summary,public
        return {
            id: bridge.generateIdFromName(values[0]),
            name: values[0],
            x: parseFloat(values[1]),
            y: parseFloat(values[2]),
            type: values[3] || 'other',
            faction: values[4] || undefined,
            summary: values[5] || '',
            images: [],
            public: ['true', '1', 'yes'].includes((values[6] || '').toLowerCase()),
        };
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
            bridge.showNotification('Login required to publish', 'error');
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
            updatePublishUI();
            
            bridge.showNotification('Published & site rebuild triggered!', 'success');
        } catch (e) {
            console.error('Publish failed:', e);
            bridge.showNotification('Publish failed (see console)', 'error');
        }
    }

    function download(blob, filename) {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        document.body.appendChild(a);
a.click();
        document.body.removeChild(a);
    }
    
    // --- Helper functions that might be needed internally ---
    
    function generateIdFromName(name) {
        if (!name) return '';
        return name.toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
    }

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

    function renderExistingTerrain() {
        if (bridge.terrainModule) {
            bridge.terrainModule.renderTerrain();
        }
    }


    // Expose the initializer function to the global scope
    window.__nimea_dm_init = initDmModule;

})(window);
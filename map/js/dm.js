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
            saveMarkerFromForm,
            updateMarkerPosition,
            editMarker,
            deleteMarker
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
                await openTerrainTypeModal(); 
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
        const saveBtn = document.getElementById('save-marker');

        // Update ID when name changes, but only for new markers (not when editing)
        nameInput.addEventListener('input', () => {
            // Only auto-generate ID if we're creating a new marker (not editing)
            // and the ID field hasn't been manually modified
            if (!form.dataset.editMode && !idInput.dataset.manuallyEdited) {
                idInput.value = bridge.generateIdFromName(nameInput.value);
            }
        });
        
        // Track if ID has been manually edited
        idInput.addEventListener('input', () => {
            idInput.dataset.manuallyEdited = 'true';
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
        console.log('Opening marker creation modal at:', latLng);
        const modal = document.getElementById('marker-creation-modal');
        const form = document.getElementById('marker-form');
        const saveBtn = document.getElementById('save-marker');
        const title = modal.querySelector('h3');
        
        // Reset form and set to creation mode
        form.reset();
        form.removeAttribute('data-edit-mode');
        form.removeAttribute('data-original-id');
        document.getElementById('marker-id').removeAttribute('data-manually-edited');
        
        // Update UI for creation mode
        title.textContent = 'Create New Marker';
        saveBtn.textContent = 'Create Marker';
        
        // Store raw coordinates in hidden fields
        document.getElementById('marker-lat').value = latLng.lat;
        document.getElementById('marker-lng').value = latLng.lng;

        // Display formatted coordinates for the user
        document.getElementById('marker-coordinates').value = `X: ${Math.round(latLng.lng)}, Y: ${Math.round(latLng.lat)}`;
        
        document.getElementById('marker-public').checked = true;
        modal.classList.remove('hidden');
        document.getElementById('marker-name').focus();
    }
    
    /**
     * Opens the marker edit modal with existing marker data
     * @param {Object} markerData - The marker data to edit
     */
    function editMarker(markerData) {
        if (!markerData || !markerData.id) {
            console.error('Invalid marker data for editing');
            return;
        }
        
        console.log('Opening edit modal for marker:', markerData.name);
        const modal = document.getElementById('marker-creation-modal');
        const form = document.getElementById('marker-form');
        const title = modal.querySelector('h3');
        const saveBtn = document.getElementById('save-marker');
        
        // Set form to edit mode and store original ID
        form.dataset.editMode = 'true';
        form.dataset.originalId = markerData.id;
        
        // Update UI for edit mode
        title.textContent = 'Edit Marker';
        saveBtn.textContent = 'Save Changes';
        
        // Fill in all existing values
        document.getElementById('marker-name').value = markerData.name || '';
        document.getElementById('marker-id').value = markerData.id || '';
        document.getElementById('marker-id').dataset.manuallyEdited = 'true'; // Prevent auto-generation
        document.getElementById('marker-type').value = markerData.type || 'other';
        document.getElementById('marker-faction').value = markerData.faction || '';
        document.getElementById('marker-summary').value = markerData.summary || '';
        document.getElementById('marker-wiki-slug').value = markerData.wikiSlug || '';
        document.getElementById('marker-public').checked = markerData.public !== false;
        
        // Store coordinates
        document.getElementById('marker-lat').value = markerData.y;
        document.getElementById('marker-lng').value = markerData.x;
        document.getElementById('marker-coordinates').value = `X: ${Math.round(markerData.x)}, Y: ${Math.round(markerData.y)}`;
        
        // Show the modal
        modal.classList.remove('hidden');
        document.getElementById('marker-name').focus();
    }

    function saveMarkerFromForm() {
        const form = document.getElementById('marker-form');
        const isEditMode = form.dataset.editMode === 'true';
        const originalId = isEditMode ? form.dataset.originalId : null;
        
        // When editing, we don't need a pending marker
        if (!isEditMode && !pendingMarker) {
            bridge.showNotification('Error: No pending marker to save. Please try again.', 'error');
            document.getElementById('marker-creation-modal').classList.add('hidden');
            return;
        }

        const formData = new FormData(form);
        
        const id = formData.get('marker-id');
        const name = formData.get('marker-name');
        const summary = formData.get('marker-summary');
        const type = formData.get('marker-type');
        const faction = formData.get('marker-faction');
        const isPublic = formData.get('marker-public') === 'on';
        const wikiSlug = formData.get('marker-wiki-slug');
        
        // Get coordinates from the hidden fields
        const lat = parseFloat(document.getElementById('marker-lat').value);
        const lng = parseFloat(document.getElementById('marker-lng').value);

        if (!id || !name || !summary) {
            bridge.showNotification('Please fill in all required fields', 'error');
            return;
        }
        if (isNaN(lat) || isNaN(lng)) {
            bridge.showNotification('Error: Invalid coordinates. Please place the marker again.', 'error');
            return;
        }
        if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
            bridge.showNotification('ID can only contain letters, numbers, hyphens, and underscores', 'error');
            return;
        }
        
        // Check for ID conflicts, but allow the same ID when editing
        if (!isEditMode && bridge.state.markers.some(m => m.id === id)) {
            bridge.showNotification('Marker ID already exists', 'error');
            return;
        }
        
        // Also check if we're editing but changing the ID to one that already exists
        if (isEditMode && id !== originalId && bridge.state.markers.some(m => m.id === id)) {
            bridge.showNotification('Cannot change ID: another marker with this ID already exists', 'error');
            return;
        }

        const markerData = {
            id, name,
            x: lng,
            y: lat,
            type,
            faction: faction || undefined,
            summary,
            images: [], // Preserve existing images in edit mode
            public: isPublic,
            wikiSlug: wikiSlug ? wikiSlug.trim() || undefined : undefined,
        };

        if (isEditMode) {
            // Edit existing marker
            const markerIndex = bridge.state.markers.findIndex(m => m.id === originalId);
            if (markerIndex === -1) {
                bridge.showNotification('Error: Could not find original marker to update', 'error');
                return;
            }
            
            // Preserve any images from the original marker
            if (bridge.state.markers[markerIndex].images && bridge.state.markers[markerIndex].images.length > 0) {
                markerData.images = [...bridge.state.markers[markerIndex].images];
            }
            
            // Replace the existing marker
            bridge.state.markers[markerIndex] = markerData;
            
            // Need to refresh all markers to update the marker on the map
            if (bridge.markersModule && bridge.markersModule.renderMarkers) {
                bridge.markersModule.renderMarkers();
            }
            
            console.log('Marker updated:', markerData.name);
            bridge.showNotification(`Marker "${name}" updated successfully!`, 'success');
        } else {
            // Create new marker
            bridge.state.markers.push(markerData);
            pendingMarker.on('click', () => bridge.openInfoSidebar(markerData));
            
            pendingMarker.options.isPending = false; // Unmark it
            pendingMarker = null;
            
            console.log('New marker created:', markerData.name);
            bridge.showNotification(`Marker "${name}" created successfully!`, 'success');
        }
        
        bridge.markDirty('markers');
        document.getElementById('marker-creation-modal').classList.add('hidden');
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
        // *** THIS IS THE CRITICAL FIX: Assign a unique ID ***
        feature.properties._internal_id = `terrain_${Date.now()}_${Math.random()}`;
        
        // Add the new feature to the state before re-rendering
        bridge.state.terrain.features.push(feature);

        // The terrain module will now handle the visual representation
        if (bridge.terrainModule) {
            bridge.terrainModule.renderTerrain();
        }
        
        bridge.showNotification(`${terrainType} terrain added`, 'success');
        bridge.markDirty('terrain');

        // Invalidate the routing graph so the next calculation uses the new terrain
        if (bridge.routingModule && bridge.routingModule.invalidateGraph) {
            bridge.routingModule.invalidateGraph();
        }
        
        // We no longer need the temporary layer drawn by Geoman, as renderTerrain has replaced it
        bridge.map.removeLayer(pendingTerrain);
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
            updatePublishUI();
            
            bridge.showNotification('Published & site rebuild triggered!', 'success');
        } catch (e) {
            console.error('Publish failed:', e);
            bridge.showNotification('Publish failed. Try Download button to save offline, then manually commit files.', 'error');
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
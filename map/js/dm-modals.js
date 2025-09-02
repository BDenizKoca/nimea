// map/js/dm-modals.js
// Modal management for DM Mode

(function(window) {
    'use strict';

    /**
     * Manages all DM-related modals and their functionality
     */
    class DmModals {
        constructor(bridge) {
            this.bridge = bridge;
            this.pendingMarker = null;
            this.pendingTerrain = null;
        }

        /**
         * Sets up all modal event listeners
         */
        setupAllModals() {
            this.setupMarkerCreationModal();
            this.setupBulkImportModal();
            this.setupTerrainTypeModal();
            this.setupModalClickOutsideToClose(); // Add click-outside-to-close functionality
        }

        /**
         * Sets up event listeners for the marker creation modal.
         */
        setupMarkerCreationModal() {
            const modal = document.getElementById('marker-creation-modal');
            const form = document.getElementById('marker-form');
            const nameInput = document.getElementById('marker-name');
            const idInput = document.getElementById('marker-id');
            const cancelBtn = document.getElementById('cancel-marker');

            // Update ID when name changes, but only for new markers (not when editing)
            nameInput.addEventListener('input', () => {
                // Only auto-generate ID if we're creating a new marker (not editing)
                // and the ID field hasn't been manually modified
                if (!form.dataset.editMode && !idInput.dataset.manuallyEdited) {
                    idInput.value = this.bridge.generateIdFromName(nameInput.value);
                }
            });
            
            // Track if ID has been manually edited
            idInput.addEventListener('input', () => {
                idInput.dataset.manuallyEdited = 'true';
            });

            cancelBtn.addEventListener('click', () => {
                if (this.pendingMarker) {
                    this.bridge.map.removeLayer(this.pendingMarker);
                    this.pendingMarker = null;
                }
                modal.classList.add('hidden');
            });

            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveMarkerFromForm();
            });

            modal.addEventListener('click', (e) => {
                if (e.target === modal) cancelBtn.click();
            });
        }

        /**
         * Sets up event listeners for the bulk CSV import modal.
         */
        setupBulkImportModal() {
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

            processBtn.addEventListener('click', () => this.processBulkImport(csvInput.value));
            modal.addEventListener('click', (e) => {
                if (e.target === modal) cancelBtn.click();
            });
        }

        /**
         * Sets up event listeners for the terrain type selection modal.
         */
        setupTerrainTypeModal() {
            const modal = document.getElementById('terrain-type-modal');
            const cancelBtn = document.getElementById('cancel-terrain');

            modal.querySelectorAll('.terrain-btn').forEach(button => {
                button.addEventListener('click', () => {
                    const terrainType = button.dataset.type;
                    this.saveTerrainWithType(terrainType);
                    modal.classList.add('hidden');
                });
            });

            cancelBtn.addEventListener('click', () => {
                if (this.pendingTerrain) {
                    this.bridge.map.removeLayer(this.pendingTerrain);
                    this.pendingTerrain = null;
                }
                modal.classList.add('hidden');
            });

            modal.addEventListener('click', (e) => {
                if (e.target === modal) cancelBtn.click();
            });
        }

        /**
         * Opens the marker creation modal at the specified coordinates
         * @param {L.LatLng} latLng - The coordinates for the new marker
         */
        openMarkerCreationModal(latLng) {
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
        editMarker(markerData) {
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

        /**
         * Opens the bulk import modal
         */
        openBulkImportModal() {
            document.getElementById('bulk-import-modal').classList.remove('hidden');
            document.getElementById('csv-input').focus();
        }

        /**
         * Opens the terrain type modal or auto-saves if a terrain mode is active
         * @param {Object} controls - The DM controls instance to check terrain mode
         */
        async openTerrainTypeModal(controls) {
            // If a terrain mode is active, use it automatically without showing the modal
            if (controls && controls.getCurrentTerrainMode()) {
                await this.saveTerrainWithType(controls.getCurrentTerrainMode());
                return;
            }
            document.getElementById('terrain-type-modal').classList.remove('hidden');
        }

        /**
         * Saves marker data from the form
         */
        saveMarkerFromForm() {
            const form = document.getElementById('marker-form');
            const isEditMode = form.dataset.editMode === 'true';
            const originalId = isEditMode ? form.dataset.originalId : null;
            
            // When editing, we don't need a pending marker
            if (!isEditMode && !this.pendingMarker) {
                this.bridge.showNotification('Error: No pending marker to save. Please try again.', 'error');
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

            // Validation
            if (!this.validateMarkerData(id, name, summary, lat, lng, isEditMode, originalId)) {
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
                this.updateExistingMarker(markerData, originalId);
            } else {
                this.createNewMarker(markerData);
            }
            
            this.bridge.markDirty('markers');
            document.getElementById('marker-creation-modal').classList.add('hidden');
        }

        /**
         * Validates marker form data
         * @param {string} id - Marker ID
         * @param {string} name - Marker name
         * @param {string} summary - Marker summary
         * @param {number} lat - Latitude
         * @param {number} lng - Longitude
         * @param {boolean} isEditMode - Whether we're editing an existing marker
         * @param {string} originalId - Original ID when editing
         * @returns {boolean} Whether the data is valid
         */
        validateMarkerData(id, name, summary, lat, lng, isEditMode, originalId) {
            if (!id || !name || !summary) {
                this.bridge.showNotification('Please fill in all required fields', 'error');
                return false;
            }
            if (isNaN(lat) || isNaN(lng)) {
                this.bridge.showNotification('Error: Invalid coordinates. Please place the marker again.', 'error');
                return false;
            }
            if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
                this.bridge.showNotification('ID can only contain letters, numbers, hyphens, and underscores', 'error');
                return false;
            }
            
            // Check for ID conflicts, but allow the same ID when editing
            if (!isEditMode && this.bridge.state.markers.some(m => m.id === id)) {
                this.bridge.showNotification('Marker ID already exists', 'error');
                return false;
            }
            
            // Also check if we're editing but changing the ID to one that already exists
            if (isEditMode && id !== originalId && this.bridge.state.markers.some(m => m.id === id)) {
                this.bridge.showNotification('Cannot change ID: another marker with this ID already exists', 'error');
                return false;
            }

            return true;
        }

        /**
         * Updates an existing marker
         * @param {Object} markerData - The new marker data
         * @param {string} originalId - The original marker ID
         */
        updateExistingMarker(markerData, originalId) {
            const markerIndex = this.bridge.state.markers.findIndex(m => m.id === originalId);
            if (markerIndex === -1) {
                this.bridge.showNotification('Error: Could not find original marker to update', 'error');
                return;
            }
            
            // Preserve any images from the original marker
            if (this.bridge.state.markers[markerIndex].images && this.bridge.state.markers[markerIndex].images.length > 0) {
                markerData.images = [...this.bridge.state.markers[markerIndex].images];
            }
            
            // Replace the existing marker
            this.bridge.state.markers[markerIndex] = markerData;
            
            // Need to refresh all markers to update the marker on the map
            if (this.bridge.markersModule && this.bridge.markersModule.renderMarkers) {
                this.bridge.markersModule.renderMarkers();
            }
            
            console.log('Marker updated:', markerData.name);
            this.bridge.showNotification(`Marker "${markerData.name}" updated successfully!`, 'success');
        }

        /**
         * Creates a new marker
         * @param {Object} markerData - The marker data
         */
        createNewMarker(markerData) {
            this.bridge.state.markers.push(markerData);
            this.pendingMarker.on('click', () => this.bridge.openInfoSidebar(markerData));
            
            this.pendingMarker.options.isPending = false; // Unmark it
            this.pendingMarker = null;
            
            console.log('New marker created:', markerData.name);
            this.bridge.showNotification(`Marker "${markerData.name}" created successfully!`, 'success');
        }

        /**
         * Saves terrain with the specified type
         * @param {string} terrainType - The type of terrain
         */
        saveTerrainWithType(terrainType) {
            if (!this.pendingTerrain) return;

            const feature = this.pendingTerrain.toGeoJSON();
            feature.properties.kind = terrainType;
            // *** THIS IS THE CRITICAL FIX: Assign a unique ID ***
            feature.properties._internal_id = `terrain_${Date.now()}_${Math.random()}`;
            
            // Add the new feature to the state before re-rendering
            this.bridge.state.terrain.features.push(feature);

            // The terrain module will now handle the visual representation
            if (this.bridge.terrainModule) {
                this.bridge.terrainModule.renderTerrain();
            }
            
            this.bridge.showNotification(`${terrainType} terrain added`, 'success');
            this.bridge.markDirty('terrain');

            // Refresh publish UI so the UNSAVED badge / button state updates immediately
            try {
                if (this.bridge.dmModule && this.bridge.state && this.bridge.state.isDmMode) {
                    if (this.bridge.uiModule && this.bridge.uiModule.updatePublishUI) {
                        this.bridge.uiModule.updatePublishUI();
                    } else if (window.DmControls) {
                        // Attempt to find existing control instance via DOM manipulation (lightweight fallback)
                        const publishBtn = document.getElementById('dm-publish-json');
                        if (publishBtn) {
                            publishBtn.style.outline = '2px solid #d9534f';
                            setTimeout(()=>publishBtn.style.outline='',1200);
                        }
                    }
                }
            } catch (e) { console.warn('Failed to refresh publish UI after terrain save', e); }

            // Invalidate the routing graph so the next calculation uses the new terrain
            if (this.bridge.routingModule && this.bridge.routingModule.invalidateGraph) {
                this.bridge.routingModule.invalidateGraph();
            }
            
            // We no longer need the temporary layer drawn by Geoman, as renderTerrain has replaced it
            this.bridge.map.removeLayer(this.pendingTerrain);
            this.pendingTerrain = null;
        }

        /**
         * Processes bulk CSV import
         * @param {string} csvData - The CSV data to import
         */
        processBulkImport(csvData) {
            if (!csvData.trim()) {
                this.bridge.showNotification('Please enter CSV data', 'error');
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
                        ? this.parseCSVWithHeaders(headers, values) 
                        : this.parseCSVWithoutHeaders(values);
                    
                    if (!markerData.name || isNaN(markerData.x) || isNaN(markerData.y)) {
                        errors.push(`Row ${index + 1}: Missing or invalid required fields (name, x, y)`);
                        return;
                    }
                    if (this.bridge.state.markers.some(m => m.id === markerData.id)) {
                        errors.push(`Row ${index + 1}: Marker ID "${markerData.id}" already exists`);
                        return;
                    }

                    this.bridge.state.markers.push(markerData);
                    const marker = L.marker([markerData.y, markerData.x]).addTo(this.bridge.map);
                    marker.on('click', () => this.bridge.openInfoSidebar(markerData));
                    imported++;
                    
                } catch (error) {
                    errors.push(`Row ${index + 1}: ${error.message}`);
                }
            });

            if (imported > 0) {
                this.bridge.showNotification(`Imported ${imported} markers (not published yet)`, 'success');
                this.bridge.markDirty('markers');
            }
            if (errors.length > 0) {
                console.warn('Import errors:', errors);
                this.bridge.showNotification(`Imported ${imported} with ${errors.length} errors. See console.`, 'error');
            }

            document.getElementById('bulk-import-modal').classList.add('hidden');
        }

        /**
         * Parses CSV data with headers
         * @param {Array} headers - The CSV headers
         * @param {Array} values - The CSV values
         * @returns {Object} Parsed marker data
         */
        parseCSVWithHeaders(headers, values) {
            const data = {};
            headers.forEach((header, i) => { data[header] = values[i] || ''; });
            
            return {
                id: data.id || this.bridge.generateIdFromName(data.name),
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

        /**
         * Parses CSV data without headers
         * @param {Array} values - The CSV values
         * @returns {Object} Parsed marker data
         */
        parseCSVWithoutHeaders(values) {
            // Assume order: name,x,y,type,faction,summary,public
            return {
                id: this.bridge.generateIdFromName(values[0]),
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
         * Sets the pending marker
         * @param {L.Marker} marker - The pending marker
         */
        setPendingMarker(marker) {
            this.pendingMarker = marker;
        }

        /**
         * Sets the pending terrain
         * @param {L.Layer} terrain - The pending terrain layer
         */
        setPendingTerrain(terrain) {
            this.pendingTerrain = terrain;
        }

        /**
         * Sets up click-outside-to-close functionality for all modals
         */
        setupModalClickOutsideToClose() {
            // Get all modal elements
            const modals = document.querySelectorAll('.modal');
            
            modals.forEach(modal => {
                // Skip if already has click outside handler
                if (modal.hasAttribute('data-click-outside-setup')) return;
                modal.setAttribute('data-click-outside-setup', 'true');
                
                modal.addEventListener('click', (e) => {
                    // Only close if clicking on the modal backdrop (not the content)
                    if (e.target === modal) {
                        modal.classList.add('hidden');
                        
                        // Clean up any pending operations
                        if (modal.id === 'marker-creation-modal' && this.pendingMarker) {
                            this.bridge.map.removeLayer(this.pendingMarker);
                            this.pendingMarker = null;
                        }
                        if (modal.id === 'terrain-type-modal' && this.pendingTerrain) {
                            this.bridge.map.removeLayer(this.pendingTerrain);
                            this.pendingTerrain = null;
                        }
                    }
                });
                
                // Prevent clicks on modal content from bubbling up to close the modal
                const modalContent = modal.querySelector('.modal-content');
                if (modalContent) {
                    modalContent.addEventListener('click', (e) => {
                        e.stopPropagation();
                    });
                }
            });
        }
    }

    // Export the class to global scope
    window.DmModals = DmModals;

})(window);
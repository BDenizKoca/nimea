// map/js/dm-controls.js
// UI Controls for DM Mode

(function(window) {
    'use strict';

    /**
     * Creates and manages all DM-specific UI controls
     */
    class DmControls {
        constructor(bridge) {
            this.bridge = bridge;
            this.currentTerrainMode = null;
        }

        /**
         * Adds all DM controls to the map
         */
        addAllControls() {
            this.addPublishControls();
            this.addTerrainModeControls();
            this.addBulkImportButton();
            this.addAuthenticationControls();
        }

        /**
         * Adds the control for publishing changes or downloading data.
         */
        addPublishControls() {
            const self = this;
            const PublishControl = L.Control.extend({
                options: { position: 'topleft' },
                onAdd: function () {
                    const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control dm-publish-controls');
                    container.style.display = 'flex';
                    container.style.flexDirection = 'column';
                                        container.innerHTML = `
                                            <a class="leaflet-control-button" id="dm-download-json" title="Download marker and terrain data">Download</a>
                                            <a class="leaflet-control-button" id="dm-publish-json" title="Save changes to repository (login required)">Publish</a>
                                            <span class="dm-dirty-indicator" style="display:none; background:#d9534f; color:#fff; font-size:10px; padding:2px 4px; text-align:center;">UNSAVED</span>
                                        `;
                    
                    const downloadBtn = container.querySelector('#dm-download-json');
                    const publishBtn = container.querySelector('#dm-publish-json');

                    downloadBtn.onclick = () => self.bridge.dmModule.exportData();
                    publishBtn.onclick = async () => {
                        if (!self.bridge.state.dirty.markers && !self.bridge.state.dirty.terrain) {
                            self.bridge.showNotification('No changes to publish', 'info');
                            return;
                        }
                        await self.bridge.dmModule.publishAll();
                    };

                    // Initial UI update
                    setTimeout(() => self.updatePublishUI(), 50);
                    return container;
                }
            });
            this.bridge.map.addControl(new PublishControl());
        }

        /**
         * Adds the terrain painting mode selector.
         */
        addTerrainModeControls() {
            const self = this;
            const TerrainControls = L.Control.extend({
                options: { position: 'topleft' },
                onAdd: function () {
                    const container = L.DomUtil.create('div', 'terrain-controls');
                    container.innerHTML = `
                        <div class="leaflet-bar leaflet-control">
                            <a class="leaflet-control-button terrain-mode-btn" data-mode="road" title="Paint roads">Road</a>
                            <a class="leaflet-control-button terrain-mode-btn" data-mode="difficult" title="Zorlu araziyi boya">Zorlu</a>
                            <a class="leaflet-control-button terrain-mode-btn" data-mode="unpassable" title="Paint impassable areas">Impassable</a>
                            <a class="leaflet-control-button" id="clear-terrain-mode" title="Normal drawing">Normal</a>
                        </div>
                    `;
                    
                    container.addEventListener('click', (e) => {
                        const button = e.target.closest('.terrain-mode-btn');
                        if (button) {
                            const mode = button.dataset.mode;
                            self.setTerrainMode(mode);
                            container.querySelectorAll('.terrain-mode-btn').forEach(btn => btn.classList.remove('active'));
                            button.classList.add('active');
                        }
                        
                        if (e.target.id === 'clear-terrain-mode') {
                            self.clearTerrainMode();
                            container.querySelectorAll('.terrain-mode-btn').forEach(btn => btn.classList.remove('active'));
                        }
                    });

                    return container;
                }
            });
            this.bridge.map.addControl(new TerrainControls());
        }

        /**
         * Adds the "Import" button for bulk marker import.
         */
        addBulkImportButton() {
            const self = this;
            const ImportButton = L.Control.extend({
                options: { position: 'topleft' },
                onAdd: function () {
                    const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
                    const button = L.DomUtil.create('a', 'leaflet-control-button', container);
                    button.innerHTML = 'Import';
                    button.title = 'Import markers from CSV';
                    button.onclick = () => self.bridge.dmModule.openBulkImportModal();
                    return container;
                }
            });
            this.bridge.map.addControl(new ImportButton());
        }

        /**
         * Adds the login/logout and status controls for authentication.
         */
        addAuthenticationControls() {
            const self = this;
            const AuthControls = L.Control.extend({
                options: { position: 'topright' },
                onAdd: function () {
                    const container = L.DomUtil.create('div', 'auth-controls');
                    container.innerHTML = `
                        <div class="leaflet-bar leaflet-control">
                            <a class="leaflet-control-button" id="dm-login-btn" title="Login for live CMS">Login</a>
                            <a class="leaflet-control-button" id="dm-status-btn" title="CMS durumu">Durum</a>
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
                            self.bridge.showNotification('Authentication unavailable (check console).', 'error');
                        }
                    });

                    statusBtn.addEventListener('click', () => {
                        const status = self.bridge.state.isLiveCMS 
                            ? 'Live CMS: Changes are automatically saved to repository' 
                            : 'Offline Mode: Use Export button to save data';
                        self.bridge.showNotification(status, 'info');
                    });

                    // Initial UI update and event listeners
                    self.updateAuthUI();
                    if (window.netlifyIdentity) {
                        window.netlifyIdentity.on('login', () => {
                            self.bridge.state.isLiveCMS = true;
                            self.updateAuthUI();
                            self.bridge.showNotification('Live CMS mode enabled', 'success');
                        });
                        window.netlifyIdentity.on('logout', () => {
                            self.bridge.state.isLiveCMS = false;
                            self.updateAuthUI();
                            self.bridge.showNotification('Logged out. Switched to offline mode.', 'info');
                        });
                    }

                    return container;
                }
            });
            this.bridge.map.addControl(new AuthControls());
        }

        /**
         * Sets the terrain painting mode
         * @param {string} mode - The terrain mode to set
         */
        setTerrainMode(mode) {
            this.currentTerrainMode = mode;
            const modeEn = mode === 'road' ? 'Road' : mode === 'difficult' ? 'Difficult' : mode === 'unpassable' ? 'Impassable' : mode;
            this.bridge.showNotification(`Terrain mode: ${modeEn}. Draw polygons/lines to paint terrain.`, 'success');
        }

        /**
         * Clears the terrain painting mode
         */
        clearTerrainMode() {
            this.currentTerrainMode = null;
            this.bridge.showNotification('Normal drawing kipi etkin', 'success');
        }

        /**
         * Gets the current terrain mode
         * @returns {string|null} The current terrain mode
         */
        getCurrentTerrainMode() {
            return this.currentTerrainMode;
        }

        /**
         * Updates the UI of the publish control based on auth and dirty state.
         */
        updatePublishUI() {
            const dirty = this.bridge.state.dirty.markers || this.bridge.state.dirty.terrain;
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
         * Updates the UI of the authentication controls.
         */
        updateAuthUI() {
            const loginBtn = document.getElementById('dm-login-btn');
            const statusBtn = document.getElementById('dm-status-btn');
            const isAuthenticated = window.gitClient && window.gitClient.isAuthenticated;

            if (loginBtn) {
                loginBtn.textContent = isAuthenticated ? 'Logout' : 'Login';
                loginBtn.title = isAuthenticated ? 'Logout' : 'Login for live CMS';
            }
            
            if (statusBtn) {
                statusBtn.textContent = this.bridge.state.isLiveCMS ? 'Status: Live' : 'Status: Offline';
                statusBtn.style.color = this.bridge.state.isLiveCMS ? '#28a745' : '#6c757d';
            }
            
            // Also update the publish UI since it depends on auth state
            this.updatePublishUI();
        }
    }

    // Export the class to global scope
    window.DmControls = DmControls;

})(window);




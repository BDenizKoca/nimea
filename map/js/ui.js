// map/js/ui.js

(function(window) {
    'use strict';

    let bridge = {};

    function initUiModule(nimeaBridge) {
        bridge = nimeaBridge;
        if (!bridge) {
            console.error("UI module requires the global Nimea bridge.");
            return;
        }

        bridge.uiModule = {
            applyOverlayMode,
            openInfoSidebar,
            showNotification,
            updatePublishUI,
        };
        
        bridge.showNotification = showNotification;
        bridge.openInfoSidebar = openInfoSidebar;

        // Initial setup
        setupSidebars();
        setupOverlayControls(); // Always set up overlay controls, not just in DM mode
        setupMobileUI();
    }

    function setupSidebars() {
        const infoSidebar = document.getElementById('info-sidebar');
        const closeInfoSidebarBtn = document.getElementById('close-info-sidebar');
        if (infoSidebar && closeInfoSidebarBtn) {
            closeInfoSidebarBtn.addEventListener('click', () => infoSidebar.classList.remove('open'));
        }
    }

    function setupOverlayControls() {
        const overlayToggleContainer = document.querySelector('#overlay-toggles .overlay-segmented');
        if (overlayToggleContainer) {
            overlayToggleContainer.addEventListener('click', (e) => {
                const btn = e.target.closest('button[data-mode]');
                if (!btn) return;
                const mode = btn.getAttribute('data-mode');
                applyOverlayMode(mode);
            });
        }
    }

    function setupMobileUI() {
        const routeSidebar = document.getElementById('route-sidebar');
        const infoSidebar = document.getElementById('info-sidebar');

        function isNarrow() { return window.innerWidth <= 700; }

        window.addEventListener('resize', () => {
            if (!isNarrow()) {
                if (routeSidebar.classList.contains('open')) routeSidebar.classList.add('open');
                if (infoSidebar.classList.contains('open')) infoSidebar.classList.add('open');
            }
        });
    }

    function applyOverlayMode(mode) {
        bridge.state.currentOverlayMode = mode;
        const regionsOverlay = bridge.state.overlays.regions;
        const bordersOverlay = bridge.state.overlays.borders;

        if (regionsOverlay) {
            if (mode === 'both' || mode === 'regions') bridge.map.addLayer(regionsOverlay);
            else bridge.map.removeLayer(regionsOverlay);
        }
        if (bordersOverlay) {
            if (mode === 'both' || mode === 'borders') bridge.map.addLayer(bordersOverlay);
            else bridge.map.removeLayer(bordersOverlay);
        }

        const overlayToggleContainer = document.querySelector('#overlay-toggles .overlay-segmented');
        if (overlayToggleContainer) {
            overlayToggleContainer.querySelectorAll('button[data-mode]').forEach(btn => {
                const active = btn.getAttribute('data-mode') === mode;
                btn.classList.toggle('active', active);
                btn.setAttribute('aria-pressed', active ? 'true' : 'false');
            });
        }
    }

    function openInfoSidebar(data) {
        const infoSidebar = document.getElementById('info-sidebar');
        const infoContent = document.getElementById('info-content');
        if (!infoSidebar || !infoContent) return;

        const wikiLink = bridge.generateWikiLink(data);
        const addRouteBtn = bridge.state.isDmMode ? '' : `<button class="add-to-route" data-id="${data.id}">Add to Route</button>`;
        
        // Add edit button for DM mode
        const dmButtons = bridge.state.isDmMode ? `
            <div class="dm-actions">
                <button class="edit-marker-btn" data-id="${data.id}">✏️ Edit Marker</button>
                <button class="delete-marker-btn" data-id="${data.id}">🗑️ Delete</button>
            </div>
        ` : '';
        
        const content = `
            <h2>${data.name}</h2>
            <p>${data.summary}</p>
            ${data.type ? `<p><strong>Type:</strong> ${data.type}</p>` : ''}
            ${data.faction ? `<p><strong>Faction:</strong> ${data.faction}</p>` : ''}
            ${data.images && data.images.length > 0 ? data.images.map(img => `<img src="../${img}" alt="${data.name}" style="width:100%;">`).join('') : ''}
            ${wikiLink ? `<a href="${wikiLink}" class="wiki-link" target="_blank">📚 View in Wiki</a>` : ''}
            ${addRouteBtn}
            ${dmButtons}
        `;
        infoContent.innerHTML = content;
        infoSidebar.classList.add('open');

        if (!bridge.state.isDmMode) {
            const btn = infoContent.querySelector('.add-to-route');
            if (btn) {
                btn.addEventListener('click', (e) => {
                    const markerId = e.target.dataset.id;
                    const marker = bridge.state.markers.find(m => m.id === markerId);
                    if (marker && bridge.routingModule) {
                        bridge.routingModule.addToRoute(marker);
                    }
                });
            }
        } else {
            // Add event listeners for DM buttons
            const editBtn = infoContent.querySelector('.edit-marker-btn');
            if (editBtn) {
                editBtn.addEventListener('click', (e) => {
                    const markerId = e.target.dataset.id;
                    const marker = bridge.state.markers.find(m => m.id === markerId);
                    if (marker && bridge.dmModule && bridge.dmModule.editMarker) {
                        bridge.dmModule.editMarker(marker);
                        // Close the info sidebar after clicking edit
                        infoSidebar.classList.remove('open');
                    }
                });
            }
            
            const deleteBtn = infoContent.querySelector('.delete-marker-btn');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', (e) => {
                    const markerId = e.target.dataset.id;
                    if (confirm(`Are you sure you want to delete the marker "${data.name}"? This cannot be undone.`)) {
                        if (bridge.dmModule && bridge.dmModule.deleteMarker) {
                            bridge.dmModule.deleteMarker(markerId);
                            // Close the info sidebar after deletion
                            infoSidebar.classList.remove('open');
                        }
                    }
                });
            }
        }
    }

    function showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
    
    function updatePublishUI() {
        if (!bridge.state.isDmMode) return;
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


    window.__nimea_ui_init = initUiModule;

})(window);

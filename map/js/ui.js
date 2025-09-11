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
            closeInfoSidebar,
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
        const routeSidebar = document.getElementById('route-sidebar');
        const closeRouteSidebarBtn = document.getElementById('close-route-sidebar');
        
        // Info sidebar close button
        if (infoSidebar && closeInfoSidebarBtn) {
            closeInfoSidebarBtn.addEventListener('click', () => closeInfoSidebar());
        }
        
        // Route sidebar close button
        if (routeSidebar && closeRouteSidebarBtn) {
            closeRouteSidebarBtn.addEventListener('click', () => {
                routeSidebar.classList.remove('open');
                // Update overlay toggle pressed state
                const overlayRouteBtn = document.querySelector('#overlay-toggles .route-toggle');
                if (overlayRouteBtn) overlayRouteBtn.setAttribute('aria-pressed', 'false');
            });
        }
        
        // Overlay bar route toggle button
        if (routeSidebar) {
            const overlayRouteBtn = document.querySelector('#overlay-toggles .route-toggle');
            if (overlayRouteBtn) {
                overlayRouteBtn.addEventListener('click', () => {
                    const isOpen = routeSidebar.classList.toggle('open');
                    overlayRouteBtn.setAttribute('aria-pressed', isOpen ? 'true' : 'false');
                });
            }
        }

        // Add click-outside-to-close functionality for info sidebar on mobile
        if (infoSidebar) {
            document.addEventListener('click', (e) => {
                // Only on mobile/narrow screens
                if (window.innerWidth > 700) return;
                
                // Check if sidebar is open
                if (!infoSidebar.classList.contains('open')) return;
                
                // Check if click was outside the sidebar
                if (!infoSidebar.contains(e.target)) {
                    closeInfoSidebar();
                }
            });
        }
    }

    // Removed deprecated reopen FAB positioning helper

    function setupOverlayControls() {
        const overlayToggleContainer = document.querySelector('#overlay-toggles .overlay-segmented');
        if (overlayToggleContainer) {
            overlayToggleContainer.addEventListener('click', (e) => {
                const btn = e.target.closest('button[data-mode]');
                if (!btn) return;
                const mode = btn.getAttribute('data-mode');
                applyOverlayMode(mode);
            });
            // Markers on/off toggle
            const markersToggle = overlayToggleContainer.querySelector('.markers-toggle');
            if (markersToggle) {
                // Initialize aria state from current bridge flag
                markersToggle.setAttribute('aria-pressed', bridge.state.showMarkers ? 'true' : 'false');
                // Apply initial layer visibility just in case markers module hadn't toggled
                if (bridge.state.markersLayer) {
                    const pressed = !!bridge.state.showMarkers;
                    if (pressed && !bridge.map.hasLayer(bridge.state.markersLayer)) {
                        bridge.map.addLayer(bridge.state.markersLayer);
                    }
                    if (!pressed && bridge.map.hasLayer(bridge.state.markersLayer)) {
                        bridge.map.removeLayer(bridge.state.markersLayer);
                    }
                }
                markersToggle.addEventListener('click', (e) => {
                    // Prevent the click from bubbling into data-mode handler
                    e.stopPropagation();
                    e.preventDefault();
                    bridge.state.showMarkers = !bridge.state.showMarkers;
                    const pressed = bridge.state.showMarkers;
                    markersToggle.setAttribute('aria-pressed', pressed ? 'true' : 'false');
                    if (bridge.state.markersLayer) {
                        if (pressed) {
                            if (!bridge.map.hasLayer(bridge.state.markersLayer)) bridge.map.addLayer(bridge.state.markersLayer);
                        } else {
                            if (bridge.map.hasLayer(bridge.state.markersLayer)) bridge.map.removeLayer(bridge.state.markersLayer);
                        }
                    }
                });
            }
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
        // Removed FAB repositioning hooks
    }

    function applyOverlayMode(mode) {
        bridge.state.currentOverlayMode = mode;
        const regionsOverlay = bridge.state.overlays.regions;
        const bordersOverlay = bridge.state.overlays.borders;
    // shadeLayer removed (was previously a semi-transparent rectangle beneath overlays)

        if (regionsOverlay) {
            if (mode === 'both' || mode === 'regions') bridge.map.addLayer(regionsOverlay);
            else bridge.map.removeLayer(regionsOverlay);
        }
        if (bordersOverlay) {
            if (mode === 'both' || mode === 'borders') bridge.map.addLayer(bordersOverlay);
            else bridge.map.removeLayer(bordersOverlay);
        }

        // (Shade layer logic removed – darkening is now baked into overlay assets)

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
        // Localize fields if i18n is present
        const isEnglish = window.location.pathname.startsWith('/en');
        const langKey = isEnglish ? 'en' : 'tr';
        const loc = (data.i18n && data.i18n[langKey]) ? data.i18n[langKey] : null;
        const name = (loc && loc.name) || data.name;
        const summary = (loc && loc.summary) || data.summary;
        const faction = (loc && loc.faction) || data.faction;

        const wikiLink = bridge.generateWikiLink(data);
    const addRouteBtn = bridge.state.isDmMode ? '' : `<button class=\"wiki-link add-to-route\" data-id=\"${data.id}\">${window.nimeaI18n ? window.nimeaI18n.t('addToRoute') : 'Rotaya Ekle'}</button>`;
        const setBannerLbl = isEnglish ? 'Set as banner' : 'Banner yap';
        const clearBannerLbl = isEnglish ? 'Clear banner' : 'Bannerı kaldır';
        
        // Resolve assets to absolute URLs (keep http(s) as-is)
        const resolveAssetUrl = (u) => {
            if (!u) return null;
            if (/^https?:\/\//i.test(u)) return u;
            // Ensure leading slash to point to site root (works for /en too)
            return u.startsWith('/') ? u : '/' + u.replace(/^\.\/?/, '');
        };
        // Determine banner image (explicit banner takes priority, else first image)
        let bannerUrl = null;
        let usedFirstFromImages = false;
        if (data.banner) {
            bannerUrl = resolveAssetUrl(data.banner);
        } else if (Array.isArray(data.images) && data.images.length > 0) {
            bannerUrl = resolveAssetUrl(data.images[0]);
            usedFirstFromImages = true;
        }
        // Remaining images for below-the-fold gallery (avoid duplicating banner)
        let galleryImages = Array.isArray(data.images) ? (usedFirstFromImages ? data.images.slice(1) : data.images) : [];
        if (bannerUrl && Array.isArray(data.images)) {
            // Exclude whatever matches the resolved banner URL
            galleryImages = galleryImages.filter(img => resolveAssetUrl(img) !== bannerUrl);
        }
        const galleryHtml = galleryImages && galleryImages.length > 0
            ? galleryImages.map(img => {
                const src = resolveAssetUrl(img);
                if (bridge.state.isDmMode) {
                    return `<div class="info-image"><img src="${src}" alt="${name}" style="width:100%;"><div><button class=\"wiki-link set-banner-btn\" data-id=\"${data.id}\" data-src=\"${src}\">${setBannerLbl}</button></div></div>`;
                }
                return `<img src="${src}" alt="${name}" style="width:100%;">`;
              }).join('')
            : '';
        
        // Add DM action buttons when in DM mode
        const dmButtons = bridge.state.isDmMode ? `
            <div class="dm-actions">
                <button class="edit-marker-btn" data-id="${data.id}">${window.nimeaI18n ? window.nimeaI18n.t('edit') : 'Düzenle'}</button>
                <button class="dm-icon-btn" data-id="${data.id}">Icon</button>
                <button class="dm-banner-btn" data-id="${data.id}">Banner</button>
                <button class="delete-marker-btn" data-id="${data.id}">${window.nimeaI18n ? window.nimeaI18n.t('delete') : 'Sil'}</button>
            </div>
        ` : '';
        
        const content = `
            ${bannerUrl ? `<div class="info-banner"><img src="${bannerUrl}" alt="${name} banner"></div>` : ''}
            <h2>${name}</h2>
            ${addRouteBtn ? `<div class="info-primary-action">${addRouteBtn}</div>` : ''}
            <p>${summary}</p>
            ${data.type ? `<p><strong>Tür:</strong> ${data.type}</p>` : ''}
            ${faction ? `<p><strong>Cemiyet/Devlet:</strong> ${faction}</p>` : ''}
            ${bridge.state.isDmMode && bannerUrl ? `<div><button class=\"wiki-link clear-banner-btn\" data-id=\"${data.id}\">${clearBannerLbl}</button></div>` : ''}
            ${galleryHtml}
            ${wikiLink ? `<div class=\"info-secondary-action\"><a href=\"${wikiLink}\" class=\"wiki-link\" target=\"_blank\">${window.nimeaI18n ? window.nimeaI18n.t('showOnWiki') : 'Külliyatta Gör'}</a></div>` : ''}
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
                        closeInfoSidebar();
                    }
                });
            }
            
            const deleteBtn = infoContent.querySelector('.delete-marker-btn');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', (e) => {
                    const markerId = e.target.dataset.id;
                    if (confirm(`"${data.name}" ${window.nimeaI18n ? window.nimeaI18n.t('confirmDelete') : 'işaretini silmek istediğine emin misin? Bu işlem geri alınamaz.'}`)) {
                        if (bridge.dmModule && bridge.dmModule.deleteMarker) {
                            bridge.dmModule.deleteMarker(markerId);
                            // Close the info sidebar after deletion
                            closeInfoSidebar();
                        }
                    }
                });
            }

            // DM: Set banner from existing images
            const unresolveAssetUrl = (u) => {
                if (!u) return u;
                // Keep http(s) as-is
                if (/^https?:\/\//i.test(u)) return u;
                return u.startsWith('/') ? u.slice(1) : u;
            };
            infoContent.querySelectorAll('.set-banner-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const markerId = e.currentTarget.dataset.id;
                    const resolvedSrc = e.currentTarget.dataset.src;
                    const markerIdx = bridge.state.markers.findIndex(m => m.id === markerId);
                    if (markerIdx === -1) return;
                    const rawMatch = (bridge.state.markers[markerIdx].images || []).find(img => resolveAssetUrl(img) === resolvedSrc);
                    const bannerRaw = rawMatch || unresolveAssetUrl(resolvedSrc);
                    bridge.state.markers[markerIdx].banner = bannerRaw;
                    bridge.markDirty('markers');
                    if (bridge.uiModule && bridge.uiModule.updatePublishUI) bridge.uiModule.updatePublishUI();
                    // Re-open to refresh UI
                    openInfoSidebar(bridge.state.markers[markerIdx]);
                    bridge.showNotification(isEnglish ? 'Banner set for location.' : 'Banner ayarlandı.', 'success');
                });
            });

            const clearBtn = infoContent.querySelector('.clear-banner-btn');
            if (clearBtn) {
                clearBtn.addEventListener('click', (e) => {
                    const markerId = e.currentTarget.dataset.id;
                    const markerIdx = bridge.state.markers.findIndex(m => m.id === markerId);
                    if (markerIdx === -1) return;
                    delete bridge.state.markers[markerIdx].banner;
                    bridge.markDirty('markers');
                    if (bridge.uiModule && bridge.uiModule.updatePublishUI) bridge.uiModule.updatePublishUI();
                    openInfoSidebar(bridge.state.markers[markerIdx]);
                    bridge.showNotification(isEnglish ? 'Banner cleared.' : 'Banner kaldırıldı.', 'success');
                });
            }
            const iconBtn = infoContent.querySelector('.dm-icon-btn');
            if (iconBtn) {
                iconBtn.addEventListener('click', (e) => {
                    const markerId = e.target.dataset.id;
                    const marker = bridge.state.markers.find(m => m.id === markerId);
                    if (marker && bridge.dmModule && bridge.dmModule.openIconModal) {
                        bridge.dmModule.openIconModal(marker);
                    }
                });
            }

            const bannerBtn = infoContent.querySelector('.dm-banner-btn');
            if (bannerBtn) {
                bannerBtn.addEventListener('click', (e) => {
                    const markerId = e.target.dataset.id;
                    const marker = bridge.state.markers.find(m => m.id === markerId);
                    if (marker && bridge.dmModule && bridge.dmModule.openBannerModal) {
                        bridge.dmModule.openBannerModal(marker);
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

    function closeInfoSidebar() {
        const infoSidebar = document.getElementById('info-sidebar');
        if (infoSidebar) {
            infoSidebar.classList.remove('open');
        }
    }

    window.__nimea_ui_init = initUiModule;

})(window);

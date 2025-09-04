// map/js/routing/route-drag-drop.js - Drag and drop functionality for route reordering

(function(window) {
    'use strict';

    let bridge = {};
    let domCache = {};
    // Track per-container state so we can cleanly reinitialize without stacking listeners
    const containerStates = new WeakMap();

    /**
     * Initialize the drag-drop module
     */
    function initRouteDragDrop(bridgeObj, domCacheObj) {
        bridge = bridgeObj;
        domCache = domCacheObj;
        
        console.log("Route drag-drop module initialized");
    }

    /**
     * Setup drag and drop functionality for route reordering
     */
    function setupDragAndDrop(container, reorderCallback) {
        // If already initialized, remove previous listeners to avoid duplicates
        const existing = containerStates.get(container);
        if (existing && existing.cleanup) existing.cleanup();

        // State
        let isActive = true;
        let dragging = false;
        let draggedEl = null;
        let placeholder = null;
        let startIndex = null;
        let pointerId = null;
        let startY = 0;
        let offsetY = 0; // pointer to element top
        let containerRect = null;

        // Helpers
        const rows = () => Array.from(container.querySelectorAll('.route-stop-row'));

        function indexFromPlaceholder() {
            const all = rows().filter(r => r !== draggedEl);
            return all.indexOf(placeholder);
        }

        function placePlaceholderAtIndex(idx) {
            const all = rows().filter(r => r !== draggedEl);
            const actions = container.querySelector('.route-actions');
            if (idx <= 0) {
                container.insertBefore(placeholder, all[0] || actions || null);
            } else if (idx >= all.length) {
                if (actions) container.insertBefore(placeholder, actions);
                else container.appendChild(placeholder);
            } else {
                container.insertBefore(placeholder, all[idx]);
            }
        }

        function computeInsertionIndex(y) {
            const list = rows().filter(r => r !== draggedEl);
            if (!list.length) return 0;
            for (let i = 0; i < list.length; i++) {
                const rect = list[i].getBoundingClientRect();
                const mid = rect.top + rect.height / 2;
                if (y < mid) return i;
            }
            return list.length;
        }

        function onPointerDown(e) {
            if (!isActive) return;
            if (e.button !== 0) return; // primary
            const handle = e.target.closest('.drag-handle');
            const row = e.target.closest('.route-stop-row');
            if (!handle || !row || e.target.closest('.mini-btn')) return;

            // Start drag
            draggedEl = row;
            startIndex = rows().indexOf(row);
            pointerId = e.pointerId;
            containerRect = container.getBoundingClientRect();
            const rect = row.getBoundingClientRect();
            startY = e.clientY;
            offsetY = startY - rect.top;

            // Create placeholder occupying original space
            placeholder = document.createElement('div');
            placeholder.className = 'route-stop-row drag-placeholder';
            placeholder.style.height = rect.height + 'px';
            placeholder.style.margin = window.getComputedStyle(row).margin;
            placeholder.style.border = '2px dashed #357abd';
            placeholder.style.borderRadius = '4px';
            placeholder.style.background = 'rgba(53,122,189,0.06)';

            row.parentNode.insertBefore(placeholder, row.nextSibling);

            // Elevate dragged element
            row.classList.add('dragging');
            row.style.position = 'absolute';
            row.style.width = rect.width + 'px';
            row.style.left = (rect.left - containerRect.left + container.scrollLeft) + 'px';
            row.style.top = (rect.top - containerRect.top + container.scrollTop) + 'px';
            row.style.zIndex = '1000';
            row.style.pointerEvents = 'none';
            row.style.boxShadow = '0 8px 16px rgba(0,0,0,0.25)';
            row.style.transform = 'rotate(0.5deg)';
            // Disable transitions to avoid stutter
            row.style.transition = 'none';
            rows().forEach(r => r.style.transition = 'none');

            // Capture pointer and prevent text selection/scrolling
            try { row.setPointerCapture(pointerId); } catch(_) {}
            try { document.body.style.userSelect = 'none'; } catch(_) {}
            dragging = true;
            e.preventDefault();

            window.addEventListener('pointermove', onPointerMove, { passive: false });
            window.addEventListener('pointerup', onPointerUp, { passive: true });
            window.addEventListener('pointercancel', onPointerCancel, { passive: true });
        }

        function onPointerMove(e) {
            if (!dragging || e.pointerId !== pointerId) return;
            e.preventDefault();

            const y = e.clientY;
            const top = (y - offsetY) - containerRect.top + container.scrollTop;
            draggedEl.style.top = top + 'px';

            // Placement
            const insertion = computeInsertionIndex(y);
            placePlaceholderAtIndex(insertion);
        }

        function endDrag(cancelled) {
            if (!dragging) return;
            dragging = false;
            try { draggedEl.releasePointerCapture(pointerId); } catch(_) {}
            try { document.body.style.userSelect = ''; } catch(_) {}
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('pointerup', onPointerUp);
            window.removeEventListener('pointercancel', onPointerCancel);

            // Determine new index from placeholder position
            const finalIndex = cancelled ? startIndex : indexFromPlaceholder();

            // Reset dragged element styles
            draggedEl.classList.remove('dragging');
            draggedEl.style.position = '';
            draggedEl.style.width = '';
            draggedEl.style.left = '';
            draggedEl.style.top = '';
            draggedEl.style.zIndex = '';
            draggedEl.style.pointerEvents = '';
            draggedEl.style.boxShadow = '';
            draggedEl.style.transform = '';
            draggedEl.style.transition = '';
            rows().forEach(r => r.style.transition = '');

            // Remove placeholder
            if (placeholder && placeholder.parentNode) placeholder.parentNode.removeChild(placeholder);

            const from = startIndex;
            const to = finalIndex;
            draggedEl = null;
            placeholder = null;
            startIndex = null;
            pointerId = null;

            if (!cancelled && from !== to && to >= 0) {
                reorderCallback(from, to);
            }
        }

        function onPointerUp(e) { if (e.pointerId === pointerId) endDrag(false); }
        function onPointerCancel(e) { if (e.pointerId === pointerId) endDrag(true); }

        container.addEventListener('pointerdown', onPointerDown, true);

        function cleanup() {
            try {
                isActive = false;
                endDrag(true);
                container.removeEventListener('pointerdown', onPointerDown, true);
            } catch(_) {}
        }
        containerStates.set(container, { cleanup });
    }

    /**
     * Setup mobile touch drag and drop functionality
     */
    // Pointer-based DnD handles both desktop and mobile; no separate touch styles needed

    // Expose public functions
    window.__nimea_route_drag_drop = {
        initRouteDragDrop,
        setupDragAndDrop
    };

})(window);
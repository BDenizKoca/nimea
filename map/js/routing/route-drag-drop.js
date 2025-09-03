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
        if (existing && existing.cleanup) {
            existing.cleanup();
        }

    // Ensure rows aren't draggable by default; we'll enable only when using the handle
    Array.from(container.querySelectorAll('.route-stop-row')).forEach(r => r.setAttribute('draggable', 'false'));

    // Store drag state
        let draggedElement = null;
        let draggedIndex = null;
        let touchDragging = false;
        let touchStartY = 0;
        let touchCurrentRow = null;
        let isActive = true; // guard to ignore events after cleanup
    let allowDrag = false; // only allow when handle initiated
        // Gate drag start to only when pressing on the handle (desktop)
        function handleMouseDown(e) {
            if (!isActive) return;
            const handle = e.target.closest('.drag-handle');
            const row = e.target.closest('.route-stop-row');
            // Enable draggable ONLY when pressed on handle for the corresponding row
            if (handle && row) {
                allowDrag = true;
                // Disable draggability for all rows, then enable just this one
                Array.from(container.querySelectorAll('.route-stop-row')).forEach(r => r.setAttribute('draggable', 'false'));
                row.setAttribute('draggable', 'true');
            } else {
                allowDrag = false;
                Array.from(container.querySelectorAll('.route-stop-row')).forEach(r => r.setAttribute('draggable', 'false'));
            }
        }

        function handleMouseUpOrLeave() {
            allowDrag = false;
            // Disable draggability after interaction ends
            Array.from(container.querySelectorAll('.route-stop-row')).forEach(r => r.setAttribute('draggable', 'false'));
        }

        // Mark as initialized to prevent duplicate setup (debug flag)
        container._dragInitialized = true;
        
        // Drag start handler
        function handleDragStart(e) {
            if (!isActive) return;
            // Don't start drag when clicking remove button
            if (e.target.closest('.mini-btn')) return;
            // Enforce gating: only allow if handle initiated made the row draggable
            if (!allowDrag) {
                // Safety: disable draggability to avoid ghost drags
                try { e.preventDefault(); } catch (_) {}
                return;
            }
            // Only handle draggable route rows
            if (!e.target.matches('.route-stop-row[draggable="true"]') && 
                !e.target.closest('.route-stop-row[draggable="true"]')) {
                return;
            }
            
            const draggableRow = e.target.closest('.route-stop-row[draggable="true"]');
            if (!draggableRow) return;
            
            draggedElement = draggableRow;
            draggedIndex = parseInt(draggableRow.dataset.routeIndex, 10);
            draggableRow.classList.add('dragging');
            
            if (e.dataTransfer) {
                e.dataTransfer.effectAllowed = 'move';
                // Some browsers require setData for DnD to initiate
                try { e.dataTransfer.setData('text/plain', draggedIndex.toString()); } catch (_) {}
            }
            
            console.log(`🟢 Drag started: index ${draggedIndex}, element:`, draggableRow);
        }

        // Drag end handler
        function handleDragEnd(e) {
            if (!isActive) return;
            if (draggedElement) {
                draggedElement.classList.remove('dragging');
            }
            
            // Clean up drop indicators
            try { container.querySelectorAll('.drop-indicator').forEach(indicator => indicator.remove()); } catch (_) {}
            
            console.log('🔴 Drag ended');
            draggedElement = null;
            draggedIndex = null;
            handleMouseUpOrLeave();
        }

        // Drag over handler
        function handleDragOver(e) {
            if (!isActive || !draggedElement) return;
            
            e.preventDefault();
            if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
            
            const targetRow = e.target.closest('.route-stop-row');
            if (targetRow && targetRow !== draggedElement && !targetRow.classList.contains('dragging')) {
                // Remove existing indicators
                container.querySelectorAll('.drop-indicator').forEach(indicator => indicator.remove());
                
                // Add drop indicator
                const rect = targetRow.getBoundingClientRect();
                const midpoint = rect.top + rect.height / 2;
                
                const indicator = document.createElement('div');
                indicator.className = 'drop-indicator';
                indicator.style.cssText = 'height: 2px; background: #357abd; margin: 2px 0; pointer-events: none;';
                
                if (e.clientY < midpoint) {
                    targetRow.parentNode.insertBefore(indicator, targetRow);
                } else {
                    targetRow.parentNode.insertBefore(indicator, targetRow.nextSibling);
                }
            }
        }

        // Drag enter handler
        function handleDragEnter(e) {
            if (!isActive || !draggedElement) return;
            e.preventDefault();
        }

        // Drop handler
        function handleDrop(e) {
            if (!isActive) return;
            e.preventDefault();
            
            if (!draggedElement || draggedIndex === null) {
                console.warn('⚠️ Drop event but no dragged element');
                return;
            }
            
            const targetRow = e.target.closest('.route-stop-row');
            if (!targetRow || targetRow === draggedElement || targetRow.classList.contains('dragging')) {
                console.warn('⚠️ Invalid drop target');
                return;
            }
            
            const targetIndex = parseInt(targetRow.dataset.routeIndex, 10);
            const rect = targetRow.getBoundingClientRect();
            const midpoint = rect.top + rect.height / 2;
            
            let newIndex = targetIndex;
            if (e.clientY > midpoint) {
                newIndex = targetIndex + 1;
            }
            
            // Adjust for removal of dragged item
            if (draggedIndex < newIndex) {
                newIndex--;
            }
            
            console.log(`🟡 Drop: from ${draggedIndex} to ${newIndex}`);
            
            if (draggedIndex !== newIndex && newIndex >= 0) {
                reorderCallback(draggedIndex, newIndex);
            }
            
            // Clean up drop indicators
            container.querySelectorAll('.drop-indicator').forEach(indicator => indicator.remove());
        }

    // Add event listeners with capture to ensure they fire
    container.addEventListener('mousedown', handleMouseDown, true);
    container.addEventListener('mouseup', handleMouseUpOrLeave, true);
    container.addEventListener('mouseleave', handleMouseUpOrLeave, true);
        container.addEventListener('dragstart', handleDragStart, true);
        container.addEventListener('dragend', handleDragEnd, true);
        container.addEventListener('dragover', handleDragOver, true);
        container.addEventListener('dragenter', handleDragEnter, true);
        container.addEventListener('drop', handleDrop, true);
        
        console.log('🔧 Drag and drop initialized for', container.querySelectorAll('.route-stop-row[draggable="true"]').length, 'items');

        // --- Mobile touch fallback (long press + move) ---
        // Activate only if no native drag events (basic heuristic: touch events present)
        if ('ontouchstart' in window) {
            ensureMobileDnDStyles();
            setupMobileTouchDragDrop(container, reorderCallback);
        }

        // Register cleanup so next initialization can remove old listeners
        function cleanup() {
            try {
                isActive = false;
                allowDrag = false;
                container.removeEventListener('mousedown', handleMouseDown, true);
                container.removeEventListener('mouseup', handleMouseUpOrLeave, true);
                container.removeEventListener('mouseleave', handleMouseUpOrLeave, true);
                container.removeEventListener('dragstart', handleDragStart, true);
                container.removeEventListener('dragend', handleDragEnd, true);
                container.removeEventListener('dragover', handleDragOver, true);
                container.removeEventListener('dragenter', handleDragEnter, true);
                container.removeEventListener('drop', handleDrop, true);
                container.querySelectorAll('.drop-indicator').forEach(indicator => indicator.remove());
            } catch (_) {}
        }
        containerStates.set(container, { cleanup });
    }

    /**
     * Setup mobile touch drag and drop functionality
     */
    function setupMobileTouchDragDrop(container, reorderCallback) {
        let dragOriginIndex = null;
        let targetIndex = null;
        let targetHighlightRow = null;
        let touchDragging = false;
        let touchStartY = 0;
        let touchCurrentRow = null;

        const rows = () => Array.from(container.querySelectorAll('.route-stop-row'));

        function clearHighlight() {
            if (targetHighlightRow) {
                targetHighlightRow.classList.remove('touch-drop-before');
                targetHighlightRow.classList.remove('touch-drop-after');
                targetHighlightRow = null;
            }
        }

        // Use event delegation instead of attaching to individual rows
        container.addEventListener('touchstart', (e) => {
            if (e.touches.length !== 1) return;
            const row = e.target.closest('.route-stop-row');
            if (!row) return;
            // Require touching the drag-handle for stability and to avoid scroll conflicts
            if (!e.target.closest('.drag-handle')) return;
            
            touchStartY = e.touches[0].clientY;
            touchCurrentRow = row;
            dragOriginIndex = parseInt(row.dataset.routeIndex, 10);
            row.classList.add('touch-press');
            row._longPressTimer = setTimeout(() => {
                touchDragging = true;
                row.classList.add('dragging');
                // Fix height to avoid layout shift
                row.style.height = row.getBoundingClientRect().height + 'px';
            }, 180); // faster long press for responsiveness
        }, { passive: true });

        container.addEventListener('touchmove', (e) => {
            if (!touchCurrentRow) return;
            const y = e.touches[0].clientY;
            if (!touchDragging) {
                if (Math.abs(y - touchStartY) > 12) { // tolerance
                    clearTimeout(touchCurrentRow._longPressTimer);
                    touchCurrentRow.classList.remove('touch-press');
                    touchCurrentRow = null;
                }
                return;
            }
            e.preventDefault();
            // Identify potential target index by comparing to row midpoints
            const rowList = rows();
            let provisionalIndex = dragOriginIndex;
            for (let i = 0; i < rowList.length; i++) {
                const r = rowList[i];
                if (r === touchCurrentRow) continue; // skip dragged
                const rect = r.getBoundingClientRect();
                const midpoint = rect.top + rect.height / 2;
                if (y < midpoint) { // would insert before r
                    provisionalIndex = parseInt(r.dataset.routeIndex, 10);
                    clearHighlight();
                    r.classList.add('touch-drop-before');
                    targetHighlightRow = r;
                    break;
                }
                // if we reach end, place after last
                if (i === rowList.length - 1) {
                    provisionalIndex = parseInt(r.dataset.routeIndex, 10) + 1;
                    clearHighlight();
                    r.classList.add('touch-drop-after');
                    targetHighlightRow = r;
                }
            }
            targetIndex = provisionalIndex;
        }, { passive: false });

        function finalizeTouchDrag(cancelled) {
            if (touchCurrentRow) {
                clearTimeout(touchCurrentRow._longPressTimer);
                touchCurrentRow.classList.remove('touch-press');
                touchCurrentRow.classList.remove('dragging');
                touchCurrentRow.style.height = '';
            }
            clearHighlight();
            if (!cancelled && touchDragging && targetIndex !== null && dragOriginIndex !== null) {
                let finalTarget = targetIndex;
                // Adjust if moving downward past original position
                if (finalTarget > dragOriginIndex) finalTarget -= 1;
                if (finalTarget !== dragOriginIndex && finalTarget >= 0) {
                    reorderCallback(dragOriginIndex, finalTarget);
                }
            }
            touchDragging = false;
            touchCurrentRow = null;
            dragOriginIndex = null;
            targetIndex = null;
        }

    container.addEventListener('touchend', () => finalizeTouchDrag(false));
    container.addEventListener('touchcancel', () => finalizeTouchDrag(true));
    }

    /**
     * Inject minimal styles for mobile drag indicators once
     */
    function ensureMobileDnDStyles() {
        if (document.getElementById('route-mobile-dnd-styles')) return;
        const style = document.createElement('style');
        style.id = 'route-mobile-dnd-styles';
        style.textContent = `
            .route-stop-row.touch-press { opacity: 0.85; }
            .route-stop-row.dragging { background: #1e3a8a10; }
            .route-stop-row.touch-drop-before { box-shadow: inset 0 3px 0 #1e40af; }
            .route-stop-row.touch-drop-after { box-shadow: inset 0 -3px 0 #1e40af; }
        `;
        document.head.appendChild(style);
    }

    // Expose public functions
    window.__nimea_route_drag_drop = {
        initRouteDragDrop,
        setupDragAndDrop
    };

})(window);
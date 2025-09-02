// map/js/routing/route-drag-drop.js - Drag and drop functionality for route reordering

(function(window) {
    'use strict';

    let bridge = {};
    let domCache = {};

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
        // Prevent duplicate initialization - check if already initialized
        if (container._dragInitialized) return;
        
        // Store drag state
        let draggedElement = null;
        let draggedIndex = null;
        let touchDragging = false;
        let touchStartY = 0;
        let touchCurrentRow = null;

        // Clear any existing handlers by cloning the container
        const newContainer = container.cloneNode(true);
        container.parentNode.replaceChild(newContainer, container);
        
        // Update reference to the new container and mark it as initialized
        domCache.clear('route-stops'); // Clear cache since we cloned the element
        const stopsDiv = domCache.get('route-stops');
        stopsDiv._dragInitialized = true;
        
        // Drag start handler
        function handleDragStart(e) {
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
            
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', draggedIndex.toString());
            
            console.log(`🟢 Drag started: index ${draggedIndex}, element:`, draggableRow);
        }

        // Drag end handler
        function handleDragEnd(e) {
            if (draggedElement) {
                draggedElement.classList.remove('dragging');
            }
            
            // Clean up drop indicators
            stopsDiv.querySelectorAll('.drop-indicator').forEach(indicator => {
                indicator.remove();
            });
            
            console.log('🔴 Drag ended');
            draggedElement = null;
            draggedIndex = null;
        }

        // Drag over handler
        function handleDragOver(e) {
            if (!draggedElement) return;
            
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            
            const targetRow = e.target.closest('.route-stop-row');
            if (targetRow && targetRow !== draggedElement && !targetRow.classList.contains('dragging')) {
                // Remove existing indicators
                stopsDiv.querySelectorAll('.drop-indicator').forEach(indicator => {
                    indicator.remove();
                });
                
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
            if (!draggedElement) return;
            e.preventDefault();
        }

        // Drop handler
        function handleDrop(e) {
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
            stopsDiv.querySelectorAll('.drop-indicator').forEach(indicator => {
                indicator.remove();
            });
        }

        // Add event listeners with capture to ensure they fire
        stopsDiv.addEventListener('dragstart', handleDragStart, true);
        stopsDiv.addEventListener('dragend', handleDragEnd, true);
        stopsDiv.addEventListener('dragover', handleDragOver, true);
        stopsDiv.addEventListener('dragenter', handleDragEnter, true);
        stopsDiv.addEventListener('drop', handleDrop, true);
        
        console.log('🔧 Drag and drop initialized for', stopsDiv.querySelectorAll('.route-stop-row[draggable="true"]').length, 'items');

        // --- Mobile touch fallback (long press + move) ---
        // Activate only if no native drag events (basic heuristic: touch events present)
        if ('ontouchstart' in window) {
            ensureMobileDnDStyles();
            setupMobileTouchDragDrop(stopsDiv, reorderCallback);
        }
    }

    /**
     * Setup mobile touch drag and drop functionality
     */
    function setupMobileTouchDragDrop(stopsDiv, reorderCallback) {
        let dragOriginIndex = null;
        let targetIndex = null;
        let targetHighlightRow = null;
        let touchDragging = false;
        let touchStartY = 0;
        let touchCurrentRow = null;

        const rows = () => Array.from(stopsDiv.querySelectorAll('.route-stop-row'));

        function clearHighlight() {
            if (targetHighlightRow) {
                targetHighlightRow.classList.remove('touch-drop-before');
                targetHighlightRow.classList.remove('touch-drop-after');
                targetHighlightRow = null;
            }
        }

        rows().forEach(row => {
            row.addEventListener('touchstart', (e) => {
                if (e.touches.length !== 1) return;
                touchStartY = e.touches[0].clientY;
                touchCurrentRow = row;
                dragOriginIndex = parseInt(row.dataset.routeIndex, 10);
                row.classList.add('touch-press');
                row._longPressTimer = setTimeout(() => {
                    touchDragging = true;
                    row.classList.add('dragging');
                    // Fix height to avoid layout shift
                    row.style.height = row.getBoundingClientRect().height + 'px';
                }, 280); // slightly longer to reduce accidental drags
            }, { passive: true });

            row.addEventListener('touchmove', (e) => {
                if (!touchCurrentRow) return;
                const y = e.touches[0].clientY;
                if (!touchDragging) {
                    if (Math.abs(y - touchStartY) > 14) { // tolerance
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

            row.addEventListener('touchend', () => finalizeTouchDrag(false));
            row.addEventListener('touchcancel', () => finalizeTouchDrag(true));
        });
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
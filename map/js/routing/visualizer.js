// map/js/routing/visualizer.js - Route visualization and UI module

(function(window) {
    'use strict';

    // This will be set by the main routing module
    let bridge = {};

    /**
     * Initialize the visualizer with dependencies
     */
    function initVisualizer(bridgeObj) {
        bridge = bridgeObj;
    }

    /**
     * Analyze path segments to distinguish between road and terrain traversal
     */
    function analyzePathSegments(pathIds, routingGraph) {
        const segments = [];
        let currentSegment = null;
        
        for (let i = 0; i < pathIds.length; i++) {
            const nodeId = pathIds[i];
            const node = routingGraph.nodes.get(nodeId);
            const point = [node.y, node.x]; // Leaflet uses [lat, lng]
            
            // Determine segment type based on next edge
            let segmentType = 'terrain';
            if (i < pathIds.length - 1) {
                const nextNodeId = pathIds[i + 1];
                const edgeKey = `${nodeId}|${nextNodeId}`;
                const edge = routingGraph.edgeMap.get(edgeKey);
                
                if (edge && (edge.type === 'road' || edge.type === 'road_intersection')) {
                    segmentType = 'road';
                } else if (edge && edge.type.includes('bridge')) {
                    segmentType = 'bridge';
                }
            }
            
            // Group consecutive points of the same type
            if (!currentSegment || currentSegment.type !== segmentType) {
                if (currentSegment) {
                    segments.push(currentSegment);
                }
                currentSegment = {
                    type: segmentType,
                    points: [point]
                };
            } else {
                currentSegment.points.push(point);
            }
        }
        
        if (currentSegment) {
            segments.push(currentSegment);
        }
        
        return segments;
    }

    /**
     * Render hybrid path with different styles for different segment types
     */
    function renderHybridPath(segments) {
        // Option 1: Unified blue route line only (recommended for cleaner look)
        renderUnifiedRouteLine(segments);
        
        // Option 2: Detailed segments on top (uncomment if you want detailed segment visualization)
        /* 
        segments.forEach(segment => {
            if (segment.points.length < 2) return;
            
            let style;
            switch (segment.type) {
                case 'road':
                    style = { 
                        color: '#2563eb', // Blue for roads
                        weight: 4, 
                        opacity: 0.9,
                        pane: 'routePane'
                    };
                    break;
                case 'terrain':
                    style = { 
                        color: '#dc2626', // Red for terrain traversal
                        weight: 3, 
                        opacity: 0.8,
                        dashArray: '8, 8', // Dashed for off-road
                        pane: 'routePane'
                    };
                    break;
                case 'bridge':
                    style = { 
                        color: '#7c3aed', // Purple for bridges
                        weight: 3, 
                        opacity: 0.7,
                        dashArray: '4, 4',
                        pane: 'routePane'
                    };
                    break;
                default:
                    style = { 
                        color: '#6b7280', // Gray fallback
                        weight: 2, 
                        opacity: 0.6,
                        pane: 'routePane'
                    };
            }
            
            const polyline = L.polyline(segment.points, style).addTo(bridge.map);
            bridge.state.routePolylines.push(polyline);
        });
        */
    }

    /**
     * Render a unified smooth blue route line connecting all segments
     */
    function renderUnifiedRouteLine(segments) {
        if (!segments || segments.length === 0) return;
        
        // Collect all points from all segments to create a continuous path
        const allPoints = [];
        
        segments.forEach((segment, index) => {
            if (segment.points && segment.points.length > 0) {
                if (index === 0) {
                    // First segment: add all points
                    allPoints.push(...segment.points);
                } else {
                    // Subsequent segments: skip first point to avoid duplication
                    allPoints.push(...segment.points.slice(1));
                }
            }
        });
        
        if (allPoints.length < 2) return;
        
        // Create a unified blue route line
        const unifiedStyle = {
            color: '#1e40af', // Solid blue
            weight: 6,
            opacity: 0.7,
            pane: 'routePane',
            className: 'unified-route-line'
        };
        
        const unifiedPolyline = L.polyline(allPoints, unifiedStyle).addTo(bridge.map);
        bridge.state.routePolylines.push(unifiedPolyline);
    }

    /**
     * Compute distance of a path segment in kilometers
     */
    function computeSegmentDistance(points) {
        if (!points || points.length < 2) return 0;
        
        let totalDistancePx = 0;
        for (let i = 1; i < points.length; i++) {
            const dx = points[i][1] - points[i-1][1]; // x coordinates
            const dy = points[i][0] - points[i-1][0]; // y coordinates (lat)
            totalDistancePx += Math.sqrt(dx * dx + dy * dy);
        }
        
        return totalDistancePx * bridge.config.kmPerPixel;
    }

    /**
     * Generate comprehensive route summary with composition analysis
     */
    function updateRouteSummaryFromLegs() {
        const summaryDiv = document.getElementById('route-summary');
        if (!summaryDiv) return;
        if (!bridge.state.routeLegs.length) { 
            updateRouteSummaryEmpty(); 
            return; 
        }
        
        const totalKm = bridge.state.routeLegs.reduce((a, l) => a + l.distanceKm, 0);
        const hasUnreachable = bridge.state.routeLegs.some(l => l.unreachable);
        
        // Analyze route composition
        let roadKm = 0;
        let terrainKm = 0;
        let bridgeKm = 0;
        
        bridge.state.routeLegs.forEach(leg => {
            if (leg.segments) {
                leg.segments.forEach(segment => {
                    const segmentDistance = computeSegmentDistance(segment.points);
                    switch (segment.type) {
                        case 'road':
                            roadKm += segmentDistance;
                            break;
                        case 'terrain':
                            terrainKm += segmentDistance;
                            break;
                        case 'bridge':
                            bridgeKm += segmentDistance;
                            break;
                    }
                });
            }
        });
        
        const legsHtml = bridge.state.routeLegs.map((l, i) => {
            let legInfo = `Leg ${i + 1}: ${l.from.name} → ${l.to.name}: ${l.distanceKm.toFixed(2)} km`;
            
            if (l.unreachable) {
                legInfo += ' <span class="route-status blocked">BLOCKED!</span>';
            } else if (l.hybrid) {
                legInfo += ' <span class="route-status hybrid">hybrid route</span>';
            } else if (l.fallback) {
                legInfo += ' <span class="route-status terrain">direct terrain</span>';
            }
            
            return `<li>${legInfo}</li>`;
        }).join('');
        
        // Generate warnings and info
        let alertsHtml = '';
        if (hasUnreachable) {
            alertsHtml += '<div class="route-alert warning">⚠️ Some destinations are unreachable due to terrain barriers!</div>';
        } else if (terrainKm > roadKm) {
            alertsHtml += '<div class="route-alert info">ℹ️ Route primarily uses off-road terrain (slower travel)</div>';
        } else if (terrainKm > 0) {
            alertsHtml += '<div class="route-alert info">ℹ️ Route includes some off-road terrain sections</div>';
        }
        
        // Route composition breakdown
        const compositionHtml = `
            <div class="route-composition">
                <h4>Route Composition</h4>
                <div class="composition-item road">
                    <span class="composition-color" style="background-color: #2563eb;"></span>
                    Roads: ${roadKm.toFixed(1)} km (${((roadKm / totalKm) * 100).toFixed(0)}%)
                </div>
                <div class="composition-item terrain">
                    <span class="composition-color" style="background-color: #dc2626;"></span>
                    Off-road: ${terrainKm.toFixed(1)} km (${((terrainKm / totalKm) * 100).toFixed(0)}%)
                </div>
                ${bridgeKm > 0 ? `
                <div class="composition-item bridge">
                    <span class="composition-color" style="background-color: #7c3aed;"></span>
                    Connections: ${bridgeKm.toFixed(1)} km (${((bridgeKm / totalKm) * 100).toFixed(0)}%)
                </div>` : ''}
            </div>
        `;
        
        summaryDiv.innerHTML = `
            <h3>Hybrid Route Summary</h3>
            ${alertsHtml}
            <div class="route-totals">
                <p><strong>Total Distance:</strong> ${totalKm.toFixed(2)} km</p>
                ${compositionHtml}
            </div>
            <div class="route-legs">
                <h4>Route Legs</h4>
                <ul>${legsHtml}</ul>
            </div>
            <div class="travel-times">
                <h4>Estimated Travel Times</h4>
                <div class="travel-time-item">
                    <strong>Walking:</strong> ${(totalKm / bridge.config.profiles.walk.speed).toFixed(1)} days
                </div>
                <div class="travel-time-item">
                    <strong>Wagon:</strong> ${(totalKm / bridge.config.profiles.wagon.speed).toFixed(1)} days
                    ${terrainKm > 0 ? '<small>(+25% for off-road sections)</small>' : ''}
                </div>
                <div class="travel-time-item">
                    <strong>Horse:</strong> ${(totalKm / bridge.config.profiles.horse.speed).toFixed(1)} days
                    ${terrainKm > 0 ? '<small>(+15% for off-road sections)</small>' : ''}
                </div>
            </div>
        `;
        
        // Add styling if not already present
        ensureRoutingStyles();
    }

    /**
     * Update route summary for calculating state
     */
    function updateRouteSummaryCalculating() {
        const summaryDiv = document.getElementById('route-summary');
        if (!summaryDiv) return;
        summaryDiv.innerHTML = '<p>Calculating route...</p>';
    }

    /**
     * Update route summary for empty state
     */
    function updateRouteSummaryEmpty() {
        const summaryDiv = document.getElementById('route-summary');
        if (!summaryDiv) return;
        if (!bridge.state.route.length) { 
            summaryDiv.innerHTML = '<p>No route defined yet. Add a marker.</p>'; 
            return; 
        }
        if (bridge.state.route.length === 1) { 
            summaryDiv.innerHTML = '<p>Add a second stop to compute a route.</p>'; 
            return; 
        }
    }

    /**
     * Ensure routing styles are added to the document
     */
    function ensureRoutingStyles() {
        if (!document.getElementById('hybrid-routing-styles')) {
            const style = document.createElement('style');
            style.id = 'hybrid-routing-styles';
            style.textContent = `
                .route-alert { padding: 8px 12px; margin: 8px 0; border-radius: 4px; font-size: 14px; }
                .route-alert.warning { background: #fef3c7; border: 1px solid #f59e0b; color: #92400e; }
                .route-alert.info { background: #dbeafe; border: 1px solid #3b82f6; color: #1e40af; }
                .route-status { font-size: 11px; padding: 2px 6px; border-radius: 3px; color: white; }
                .route-status.blocked { background: #dc2626; }
                .route-status.hybrid { background: #059669; }
                .route-status.terrain { background: #d97706; }
                .route-composition { margin: 10px 0; }
                .composition-item { display: flex; align-items: center; margin: 4px 0; font-size: 13px; }
                .composition-color { width: 12px; height: 12px; margin-right: 8px; border-radius: 2px; }
                .route-totals, .route-legs, .travel-times { margin: 12px 0; }
                .travel-time-item { margin: 4px 0; }
                .travel-time-item small { color: #666; display: block; margin-left: 20px; }
            `;
            document.head.appendChild(style);
        }
    }

    // Expose module functions
    window.__nimea_visualizer = {
        initVisualizer,
        analyzePathSegments,
        renderHybridPath,
        computeSegmentDistance,
        updateRouteSummaryFromLegs,
        updateRouteSummaryCalculating,
        updateRouteSummaryEmpty
    };

})(window);
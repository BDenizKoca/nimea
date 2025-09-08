// map/js/routing/visualizer.js - Route visualization and UI module

(function(window) {
    'use strict';

    // This will be set by the main routing module
    let bridge = {};
    let pathNaturalizer = null;

    /**
     * Initialize the visualizer with dependencies
     */
    function initVisualizer(bridgeObj) {
        bridge = bridgeObj;
        pathNaturalizer = window.__nimea_path_naturalizer;
        if (!pathNaturalizer) {
            console.warn("Path naturalizer not available - using basic path rendering");
        }
    }

    /**        if (bridge.state.route.length === 0) { 
            summaryDiv.innerHTML = '<p>Henüz rota tanımlanmadı. Bir işaretçi ekleyin.</p>'; 
            return; 
        }
        if (bridge.state.route.length === 1) { 
            summaryDiv.innerHTML = '<p>Rota hesaplamak için ikinci bir durak ekleyin.</p>'; 
            return; 
        } Analyze path segments to distinguish between road and terrain traversal
     */
    function analyzePathSegments(pathIds, routingGraph, startMarker = null, endMarker = null) {
        console.log(`Analyzing path with ${pathIds.length} nodes:`, pathIds);
        const segments = [];
        let currentSegment = null;
        
        for (let i = 0; i < pathIds.length; i++) {
            const nodeId = pathIds[i];
            const node = routingGraph.nodes.get(nodeId);
            if (!node) {
                console.error(`Node ${nodeId} not found in graph!`);
                continue;
            }
            
            const point = [node.y, node.x]; // Leaflet uses [lat, lng]
            console.log(`Node ${i}: ${nodeId} (${node.type}) at [${node.y}, ${node.x}]`);
            
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
        
        // CRITICAL FIX: Ensure path connects properly to both start and end markers
        if (pathIds.length > 0 && segments.length > 0) {
            // Fix starting point
            const firstNodeId = pathIds[0];
            const firstNode = routingGraph.nodes.get(firstNodeId);
            if (firstNode && firstNode.type === 'marker') {
                const firstSegment = segments[0];
                firstSegment.points[0] = [firstNode.y, firstNode.x];
                console.log(`Fixed path start to marker position: [${firstNode.y}, ${firstNode.x}]`);
            } else if (startMarker) {
                const firstSegment = segments[0];
                firstSegment.points.unshift([startMarker.y, startMarker.x]);
                console.log(`Extended path from provided start marker: [${startMarker.y}, ${startMarker.x}]`);
            }
        }
        
        // CRITICAL FIX: Ensure the path actually reaches destination markers
        // If the last node is not a marker but the path should end at a marker,
        // extend the path to the actual marker position
        if (pathIds.length > 0) {
            const lastNodeId = pathIds[pathIds.length - 1];
            const lastNode = routingGraph.nodes.get(lastNodeId);
            
            console.log(`Last node in path: ${lastNodeId} (${lastNode?.type}) at [${lastNode?.y}, ${lastNode?.x}]`);
            
            // Check if this is supposed to end at a marker but doesn't
            if (lastNode && lastNode.type === 'marker') {
                // The path already ends at the marker node, so coordinates should be correct
                // But let's double-check the last segment ends at the exact marker position
                if (segments.length > 0) {
                    const lastSegment = segments[segments.length - 1];
                    const lastPoint = lastSegment.points[lastSegment.points.length - 1];
                    
                    // Always force the endpoint to match the marker position exactly
                    lastSegment.points[lastSegment.points.length - 1] = [lastNode.y, lastNode.x];
                    console.log(`Fixed path endpoint to marker position: [${lastNode.y}, ${lastNode.x}]`);
                }
            } else {
                console.warn(`Path does not end at a marker node! Last node type: ${lastNode?.type}`);
                
                // If the path doesn't end at a marker, use provided endMarker if available
                if (endMarker && segments.length > 0) {
                    const lastSegment = segments[segments.length - 1];
                    lastSegment.points.push([endMarker.y, endMarker.x]);
                    console.log(`Extended path to provided destination marker: [${endMarker.y}, ${endMarker.x}]`);
                }
            }
        }
        
        console.log(`Generated ${segments.length} segments for visualization`);
        return segments;
        
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
        
        // Convert Leaflet [lat, lng] format to [x, y] for naturalization
        const coordinatesForNaturalization = allPoints.map(point => [point[1], point[0]]); // swap to [x, y]
        
        let finalPoints = allPoints; // Default to original points
        
        // Apply path naturalization if available
        if (pathNaturalizer) {
            try {
                // Naturalize the path using terrain-aware nudging and smoothing
                const naturalizedCoords = pathNaturalizer.naturalizePath(
                    coordinatesForNaturalization, 
                    null, // terrainGrid will use built-in terrain utilities
                    {
                        nudgeStep: 8,           // Resample every 8 map units for smooth curves
                        nudgeOffset: 4,         // Check terrain 4 units away
                        nudgeStrength: 1.0,     // Moderate nudging strength
                        smoothIterations: 2,    // 2 iterations of smoothing
                        smoothRatio: 0.25,      // Standard corner cutting
                        terrainSensitivity: 1.0 // Full terrain awareness
                    }
                );
                
                // Convert back to Leaflet format [lat, lng]
                finalPoints = pathNaturalizer.coordinatesToLeafletFormat(naturalizedCoords);
                
                console.log(`Naturalized path: ${allPoints.length} → ${finalPoints.length} points`);
            } catch (error) {
                console.warn("Path naturalization failed, using original path:", error);
                finalPoints = allPoints;
            }
        }

        // HARD SNAP: Ensure the unified route starts/ends exactly at the current route's markers
        if (bridge && bridge.state && Array.isArray(bridge.state.route) && bridge.state.route.length >= 2) {
            const startStop = bridge.state.route[0];
            const endStop = bridge.state.route[bridge.state.route.length - 1];
            if (startStop && endStop) {
                // Replace first and last points with exact marker positions [lat, lng]
                finalPoints[0] = [startStop.y, startStop.x];
                finalPoints[finalPoints.length - 1] = [endStop.y, endStop.x];
                console.log('Snapped unified route endpoints to markers:', finalPoints[0], finalPoints[finalPoints.length - 1]);
            }
        }
        
        // Create a unified blue route line with natural curves
        const unifiedStyle = {
            color: '#1e3a8a', // Slightly deeper blue
            weight: 3,        // Thinner per user request
            opacity: 0.85,
            pane: 'routePane',
            className: 'unified-route-line',
            smoothFactor: 1.0,
            lineCap: 'round',
            lineJoin: 'round'
        };

        // Replace existing polyline if present
        if (bridge.state.routeUnifiedPolyline) {
            if (bridge.map.hasLayer(bridge.state.routeUnifiedPolyline)) {
                bridge.map.removeLayer(bridge.state.routeUnifiedPolyline);
            }
            bridge.state.routeUnifiedPolyline = null;
        }

        const unifiedPolyline = L.polyline(finalPoints, unifiedStyle).addTo(bridge.map);
        bridge.state.routeUnifiedPolyline = unifiedPolyline;
    }

    /**
     * Render a single unified route spanning all legs (post-Ayak computation) with gentle waviness.
     * Uses the already computed Ayak segments to collect original node sequences.
     */
    function renderFullUnifiedRoute(routeLegs) {
        if (!routeLegs || !routeLegs.length) return;

        // Gather all segment points in Leaflet [lat,lng]
        const points = [];
        routeLegs.forEach((leg, li) => {
            if (!leg.segments) return;
            leg.segments.forEach((segment, si) => {
                if (!segment.points || segment.points.length === 0) return;
                if (points.length === 0) {
                    points.push(...segment.points);
                } else {
                    // Avoid duplicate junction point
                    points.push(...segment.points.slice(1));
                }
            });
        });
        if (points.length < 2) return;

        // Convert to [x,y] for optional naturalization (reuse existing naturalize pipeline)
        let processed = points.map(p => [p[1], p[0]]);
        if (pathNaturalizer) {
            try {
                processed = pathNaturalizer.naturalizePath(processed, null, {
                    nudgeStep: 10,
                    nudgeOffset: 5,
                    nudgeStrength: 0.8,
                    smoothIterations: 2,
                    smoothRatio: 0.22,
                    terrainSensitivity: 0.8
                });
            } catch (e) {
                console.warn('Naturalization in unified route failed, falling back to raw:', e);
            }
        }

        // Apply gentle sine-wave waviness along the path for aesthetic (does not alter endpoints much)
        const wavy = applyWaviness(processed, 6, 3); // wavelength px, amplitude px
        const leafletPts = pathNaturalizer ? pathNaturalizer.coordinatesToLeafletFormat(wavy) : wavy.map(c => [c[1], c[0]]);

        // HARD SNAP: Ensure the full unified route starts/ends exactly at the current route's first/last markers
        if (bridge && bridge.state && Array.isArray(bridge.state.route) && bridge.state.route.length >= 2) {
            const startStop = bridge.state.route[0];
            const endStop = bridge.state.route[bridge.state.route.length - 1];
            if (startStop && endStop) {
                leafletPts[0] = [startStop.y, startStop.x];
                leafletPts[leafletPts.length - 1] = [endStop.y, endStop.x];
                console.log('Snapped full unified route endpoints to markers:', leafletPts[0], leafletPts[leafletPts.length - 1]);
            }
        }

        // Render using same unified style (reuse function but here direct to map)
        if (bridge.state.routeUnifiedPolyline) {
            if (bridge.map.hasLayer(bridge.state.routeUnifiedPolyline)) {
                bridge.map.removeLayer(bridge.state.routeUnifiedPolyline);
            }
            bridge.state.routeUnifiedPolyline = null;
        }
        const unifiedPolyline = L.polyline(leafletPts, {
            color: '#1e3a8a',
            weight: 3,
            opacity: 0.85,
            pane: 'routePane',
            className: 'unified-route-line',
            lineCap: 'round',
            lineJoin: 'round'
        }).addTo(bridge.map);
        bridge.state.routeUnifiedPolyline = unifiedPolyline;
    }

    /**
     * Apply a subtle waviness to a polyline by offsetting points along perpendicular directions.
     * amplitudePx: maximum perpendicular displacement
     * wavelengthPx: distance over which wave completes one cycle
     */
    function applyWaviness(points, wavelengthPx = 8, amplitudePx = 2) {
        if (!points || points.length < 3) return points;
        let total = 0;
        const out = [points[0]];
        for (let i = 1; i < points.length - 1; i++) {
            const prev = points[i - 1];
            const cur = points[i];
            const next = points[i + 1];
            const dx = cur[0] - prev[0];
            const dy = cur[1] - prev[1];
            const segLen = Math.sqrt(dx*dx + dy*dy) || 1;
            total += segLen;
            // Unit direction
            const ux = dx / segLen;
            const uy = dy / segLen;
            // Perpendicular
            const px = -uy;
            const py = ux;
            const phase = (2 * Math.PI * (total / wavelengthPx));
            // Taper amplitude near endpoints
            const t = i / (points.length - 1);
            const taper = Math.sin(Math.PI * t); // 0 at ends, 1 mid
            const offset = Math.sin(phase) * amplitudePx * taper;
            out.push([cur[0] + px * offset, cur[1] + py * offset]);
        }
        out.push(points[points.length - 1]);
        return out;
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
        
        // Analyze Rota Bileşimi
        let roadKm = 0;
        let terrainKm = 0;
        let bridgeKm = 0;
        
        bridge.state.routeLegs.forEach(Ayak => {
            if (Ayak.segments) {
                Ayak.segments.forEach(segment => {
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
                        default:
                            // Handle any unclassified segments
                            console.warn(`Unclassified segment type: ${segment.type}, adding to terrain`);
                            terrainKm += segmentDistance;
                            break;
                    }
                });
            } else {
                // If Ayak has no segments, treat entire Ayak as terrain
                console.warn(`Ayak ${Ayak.from.name} → ${Ayak.to.name} has no segments, treating as terrain`);
                terrainKm += Ayak.distanceKm;
            }
        });
        
        // Check if segment distances match total distance
        const segmentTotal = roadKm + terrainKm + bridgeKm;
        const discrepancy = Math.abs(totalKm - segmentTotal);
        
        if (discrepancy > 0.1) { // If more than 100m difference
            console.warn(`Distance discrepancy: Total ${totalKm.toFixed(2)}km vs Segments ${segmentTotal.toFixed(2)}km (diff: ${discrepancy.toFixed(2)}km)`);
            // Adjust the largest component to match the total
            const adjustment = totalKm - segmentTotal;
            if (terrainKm >= roadKm && terrainKm >= bridgeKm) {
                terrainKm += adjustment;
            } else if (roadKm >= bridgeKm) {
                roadKm += adjustment;
            } else {
                bridgeKm += adjustment;
            }
        }
        
        const legsHtml = bridge.state.routeLegs.map((l, i) => {
            let legInfo = `Ayak ${i + 1}: ${l.from.name} → ${l.to.name}: ${l.distanceKm.toFixed(2)} km`;
            
            if (l.unreachable) {
                legInfo += ' <span class="route-status blocked">BLOCKED!</span>';
                if (l.error) {
                    legInfo += `<br><small class="route-error">Hata: ${l.error}</small>`;
                }
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
            alertsHtml += '<div class="route-alert warning">⚠️ Bazı hedefler arazi engelleri nedeniyle ulaşılamaz!</div>';
        } else if (terrainKm > roadKm) {
            alertsHtml += '<div class="route-alert info">ℹ️ Rota ağırlıklı olarak arazi dışı yolları kullanır (daha yavaş seyahat)</div>';
        } else if (terrainKm > 0) {
            alertsHtml += '<div class="route-alert info">ℹ️ Rota bazı arazi dışı bölümler içerir</div>';
        }
        
        // Rota Bileşimi breakdown with proper percentage calculation
        // Use the corrected segment totals for percentage calculation
        const actualTotal = roadKm + terrainKm + bridgeKm;
        let roadPercent = actualTotal > 0 ? Math.round((roadKm / actualTotal) * 100) : 0;
        let terrainPercent = actualTotal > 0 ? Math.round((terrainKm / actualTotal) * 100) : 0;
        let bridgePercent = actualTotal > 0 ? Math.round((bridgeKm / actualTotal) * 100) : 0;
        
        // Ensure percentages add up to 100% by adjusting the largest component
        let totalPercent = roadPercent + terrainPercent + bridgePercent;
        if (totalPercent !== 100 && actualTotal > 0) {
            let difference = 100 - totalPercent;
            // Add the difference to the largest component
            if (roadPercent >= terrainPercent && roadPercent >= bridgePercent) {
                roadPercent += difference;
            } else if (terrainPercent >= bridgePercent) {
                terrainPercent += difference;
            } else {
                bridgePercent += difference;
            }
        }
        
        const compositionHtml = `
            <div class="route-composition">
                <h4>Rota Bileşimi</h4>
                <div class="composition-item road">
                    <span class="composition-color" style="background-color: #2563eb;"></span>
                    Yollar: ${roadKm.toFixed(1)} km (${roadPercent}%)
                </div>
                <div class="composition-item terrain">
                    <span class="composition-color" style="background-color: #dc2626;"></span>
                    Arazi: ${terrainKm.toFixed(1)} km (${terrainPercent}%)
                </div>
                ${bridgeKm > 0 ? `
                <div class="composition-item bridge">
                    <span class="composition-color" style="background-color: #7c3aed;"></span>
                    Köprüler: ${bridgeKm.toFixed(1)} km (${bridgePercent}%)
                </div>` : ''}
            </div>
        `;
        
        summaryDiv.innerHTML = `
            <h3>Hibrit Rota Özeti</h3>
            ${alertsHtml}
            <div class="route-totals">
                <p><strong>Toplam Mesafe:</strong> ${totalKm.toFixed(2)} km</p>
                ${compositionHtml}
            </div>
            <div class="route-legs">
                <h4>Rota Ayakları</h4>
                <ul>${legsHtml}</ul>
            </div>
            <div class="travel-times">
                <h4>Tahmini Seyahat Süreleri</h4>
                <div class="travel-time-item">
                    <strong>Yürüyüş:</strong> ${(totalKm / bridge.config.profiles.walk.speed).toFixed(1)} gün
                </div>
                <div class="travel-time-item">
                    <strong>Vagon:</strong> ${(totalKm / bridge.config.profiles.wagon.speed).toFixed(1)} gün
                    ${terrainKm > 0 ? '<small>(arazi dışı bölümler için +%25)</small>' : ''}
                </div>
                <div class="travel-time-item">
                    <strong>At:</strong> ${(totalKm / bridge.config.profiles.horse.speed).toFixed(1)} gün
                    ${terrainKm > 0 ? '<small>(arazi dışı bölümler için +%15)</small>' : ''}
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
        summaryDiv.innerHTML = '<p>Rota hesaplanıyor...</p>';
    }

    /**
     * Update route summary for empty state
     */
    function updateRouteSummaryEmpty() {
        const summaryDiv = document.getElementById('route-summary');
        if (!summaryDiv) return;
        if (!bridge.state.route.length) { 
            summaryDiv.innerHTML = '<p>Henüz rota tanımlanmadı. Bir işaretçi ekleyin.</p>'; 
            return; 
        }
        if (bridge.state.route.length === 1) { 
            summaryDiv.innerHTML = '<p>Rota hesaplamak için ikinci bir durak ekleyin.</p>'; 
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
        updateRouteSummaryEmpty,
        renderFullUnifiedRoute
    };

})(window);


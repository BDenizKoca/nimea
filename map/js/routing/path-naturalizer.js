// map/js/routing/path-naturalizer.js - Transform raw A* paths into natural-looking walking trails

(function(window) {
    'use strict';

    // Dependencies (will be set by initialization)
    let bridge = {};
    let terrainUtils = {};

    /**
     * Initialize path naturalizer with dependencies
     */
    function initPathNaturalizer(bridgeObj, terrainUtilsObj) {
        bridge = bridgeObj;
        terrainUtils = terrainUtilsObj;
    }

    /**
     * Calculate distance between two points
     */
    function distance(p1, p2) {
        const dx = p2[0] - p1[0];
        const dy = p2[1] - p1[1];
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * Get terrain cost at a specific coordinate using the terrain utilities
     */
    function terrainCost(point, terrainGrid) {
        // Use the existing terrain utilities to get cost at point
        // Point is [x, y] in map coordinates
        return terrainUtils.getTerrainCostAtPoint(point[0], point[1]);
    }

    /**
     * Terrain-aware nudging: resample path segments and nudge points away from difficult terrain
     * @param {Array} points - Array of [x, y] coordinates (raw A* path)
     * @param {Function|Object} terrainGrid - Function or lookup table for terrain cost
     * @param {number} step - Resampling distance in map units (default: 200)
     * @param {number} offset - How far to check left/right of path (default: 0.1)
     * @param {number} nudgeStrength - How much to nudge (default: 0.005)
     */
    function nudgePath(points, terrainGrid, step = 200, offset = 0.1, nudgeStrength = 0.005) {
        if (!points || points.length < 2) return points;

        let nudged = [];
        
        for (let i = 0; i < points.length - 1; i++) {
            let p0 = points[i];
            let p1 = points[i + 1];
            let pathLength = distance(p0, p1);
            let steps = Math.max(1, Math.ceil(pathLength / step));

            for (let s = 0; s <= steps; s++) {
                let t = s / steps;
                let x = p0[0] + t * (p1[0] - p0[0]);
                let y = p0[1] + t * (p1[1] - p0[1]);

                // Calculate perpendicular direction for left/right checks
                let dx = p1[0] - p0[0];
                let dy = p1[1] - p0[1];
                let pathLen = Math.sqrt(dx * dx + dy * dy);
                
                if (pathLen > 0) {
                    // Normalize direction vector
                    dx /= pathLen;
                    dy /= pathLen;
                    
                    // Perpendicular vectors (rotate 90 degrees)
                    let perpX = -dy;
                    let perpY = dx;
                    
                    // Check terrain cost to left and right
                    let leftPoint = [x + perpX * offset, y + perpY * offset];
                    let rightPoint = [x - perpX * offset, y - perpY * offset];
                    
                    let costCenter = terrainCost([x, y], terrainGrid);
                    let costLeft = terrainCost(leftPoint, terrainGrid);
                    let costRight = terrainCost(rightPoint, terrainGrid);
                    
                    // Nudge toward lower cost terrain, but only if significantly better
                    let nudgeX = 0;
                    let nudgeY = 0;
                    
                    if (costLeft < costCenter && costLeft < costRight) {
                        // Nudge left if left is clearly better
                        nudgeX = perpX * nudgeStrength;
                        nudgeY = perpY * nudgeStrength;
                    } else if (costRight < costCenter && costRight < costLeft) {
                        // Nudge right if right is clearly better
                        nudgeX = -perpX * nudgeStrength;
                        nudgeY = -perpY * nudgeStrength;
                    }
                    // If costs are similar, stay centered (no nudge)
                    
                    x += nudgeX;
                    y += nudgeY;
                }

                nudged.push([x, y]);
            }
        }
        
        // Remove duplicate points that are too close together
        let filtered = [nudged[0]];
        for (let i = 1; i < nudged.length; i++) {
            if (distance(filtered[filtered.length - 1], nudged[i]) > 15) {
                filtered.push(nudged[i]);
            }
        }
        
        return filtered;
    }

    /**
     * Path smoothing using Chaikin's corner-cutting algorithm
     * Creates natural curves by iteratively refining the path
     * @param {Array} points - Array of [x, y] coordinates
     * @param {number} iterations - Number of smoothing iterations (default: 1)
     * @param {number} ratio - Corner cutting ratio (default: 0.01, microscopic curves)
     */
    function smoothPath(points, iterations = 1, ratio = 0.01) {
        if (!points || points.length < 3) return points;
        
        let currentPoints = [...points];
        
        for (let k = 0; k < iterations; k++) {
            let newPoints = [currentPoints[0]]; // Keep first point
            
            for (let i = 0; i < currentPoints.length - 1; i++) {
                let p0 = currentPoints[i];
                let p1 = currentPoints[i + 1];
                
                // Chaikin's algorithm: create two new points between each pair
                let Q = [
                    p0[0] * (1 - ratio) + p1[0] * ratio,
                    p0[1] * (1 - ratio) + p1[1] * ratio
                ];
                let R = [
                    p0[0] * ratio + p1[0] * (1 - ratio),
                    p0[1] * ratio + p1[1] * (1 - ratio)
                ];
                
                newPoints.push(Q);
                if (i < currentPoints.length - 2) {
                    newPoints.push(R);
                }
            }
            
            newPoints.push(currentPoints[currentPoints.length - 1]); // Keep last point
            currentPoints = newPoints;
        }
        
        return currentPoints;
    }

    /**
     * Enhanced smoothing using cubic Bézier curves for even more natural look
     * @param {Array} points - Array of [x, y] coordinates
     * @param {number} tension - Curve tension (0-1, default: 0.3)
     * @param {number} segments - Number of segments per curve (default: 8)
     */
    function smoothPathBezier(points, tension = 0.3, segments = 8) {
        if (!points || points.length < 3) return points;
        
        let smoothed = [points[0]];
        
        for (let i = 1; i < points.length - 1; i++) {
            let p0 = points[i - 1];
            let p1 = points[i];
            let p2 = points[i + 1];
            
            // Calculate control points for smooth curve
            let cp1x = p1[0] + (p2[0] - p0[0]) * tension * 0.3;
            let cp1y = p1[1] + (p2[1] - p0[1]) * tension * 0.3;
            let cp2x = p1[0] - (p2[0] - p0[0]) * tension * 0.3;
            let cp2y = p1[1] - (p2[1] - p0[1]) * tension * 0.3;
            
            // Generate curve segments
            for (let t = 0; t <= 1; t += 1 / segments) {
                let u = 1 - t;
                let x = u * u * u * p0[0] + 3 * u * u * t * cp1x + 3 * u * t * t * cp2x + t * t * t * p1[0];
                let y = u * u * u * p0[1] + 3 * u * u * t * cp1y + 3 * u * t * t * cp2y + t * t * t * p1[1];
                
                if (t > 0) { // Skip first point to avoid duplication
                    smoothed.push([x, y]);
                }
            }
        }
        
        smoothed.push(points[points.length - 1]);
        return smoothed;
    }

    /**
     * Main function: Transform raw A* path into natural-looking walking trail
     * @param {Array} points - Array of [x, y] coordinates (raw A* path)
     * @param {Function|Object} terrainGrid - Function or lookup table for terrain cost
     * @param {Object} options - Configuration options
     */
    function naturalizePath(points, terrainGrid, options = {}) {
        if (!points || points.length < 2) return points;
        
        // CRITICAL: Store original endpoints to force preservation
        const originalStart = [points[0][0], points[0][1]];
        const originalEnd = [points[points.length - 1][0], points[points.length - 1][1]];
        
        const settings = {
            // Nudging parameters - microscopic for almost-invisible human walking variation
            nudgeStep: options.nudgeStep || 200,          // Resample every 200 map units (very sparse)
            nudgeOffset: options.nudgeOffset || 0.1,      // Check terrain 0.1 units left/right (tiny)
            nudgeStrength: options.nudgeStrength || 0.005, // Microscopic nudging
            
            // Smoothing parameters - minimal for almost-straight human paths
            smoothIterations: options.smoothIterations || 1,  // Single pass only
            smoothRatio: options.smoothRatio || 0.01,         // Microscopic corner cutting
            
            // Style preferences
            useEnhancedSmoothing: options.useEnhancedSmoothing || false,  // Keep it simple
            bezierTension: options.bezierTension || 0.01,     // Microscopic tension
            
            // Terrain sensitivity - barely reactive for natural human walking
            terrainSensitivity: options.terrainSensitivity || 0.1  // Minimal terrain reaction
        };
        
        // Step 1: Terrain-aware nudging
        let nudgedPath = nudgePath(
            points, 
            terrainGrid, 
            settings.nudgeStep, 
            settings.nudgeOffset, 
            settings.nudgeStrength * settings.terrainSensitivity
        );
        
        // Step 2: Path smoothing
        let smoothedPath;
        if (settings.useEnhancedSmoothing) {
            smoothedPath = smoothPathBezier(nudgedPath, settings.bezierTension);
        } else {
            smoothedPath = smoothPath(nudgedPath, settings.smoothIterations, settings.smoothRatio);
        }
        
        // CRITICAL: Force restore original endpoints after naturalization
        if (smoothedPath && smoothedPath.length > 0) {
            smoothedPath[0] = originalStart;
            smoothedPath[smoothedPath.length - 1] = originalEnd;
            console.log(`Forced endpoint preservation: start [${originalStart[0]}, ${originalStart[1]}], end [${originalEnd[0]}, ${originalEnd[1]}]`);
        }
        
        return smoothedPath;
    }

    /**
     * Convert graph node path to coordinate array for naturalization
     * @param {Array} pathIds - Array of node IDs from A* pathfinding
     * @param {Object} routingGraph - The routing graph with nodes
     * @returns {Array} Array of [x, y] coordinates
     */
    function pathIdsToCoordinates(pathIds, routingGraph) {
        if (!pathIds || !routingGraph) return [];
        
        return pathIds.map(nodeId => {
            const node = routingGraph.nodes.get(nodeId);
            if (!node) {
                console.warn(`Node not found: ${nodeId}`);
                return [0, 0];
            }
            return [node.x, node.y];
        });
    }

    /**
     * Convert coordinates back to Leaflet format [lat, lng]
     * @param {Array} coordinates - Array of [x, y] coordinates
     * @returns {Array} Array of [lat, lng] coordinates for Leaflet
     */
    function coordinatesToLeafletFormat(coordinates) {
        return coordinates.map(coord => [coord[1], coord[0]]); // Swap x,y to lat,lng
    }

    // Expose module functions
    window.__nimea_path_naturalizer = {
        initPathNaturalizer,
        nudgePath,
        smoothPath,
        smoothPathBezier,
        naturalizePath,
        pathIdsToCoordinates,
        coordinatesToLeafletFormat,
        distance,
        terrainCost
    };

})(window);
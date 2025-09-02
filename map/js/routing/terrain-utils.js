// map/js/routing/terrain-utils.js - Terrain cost calculation and geometry utilities

(function(window) {
    'use strict';

    // This will be set by the main routing module
    let bridge = {};
    let TERRAIN_COSTS = {};

    /**
     * Initialize terrain utilities with dependencies
     */
    function initTerrainUtils(bridgeObj, terrainCosts) {
        bridge = bridgeObj;
        TERRAIN_COSTS = terrainCosts;
    }

    /**
     * Get terrain cost at a specific point
     * Checks terrain features to determine movement cost
     */
    function getTerrainCostAtPoint(x, y) {
        // Check if point is in any unpassable areas
        const unpassableFeatures = bridge.state.terrain.features.filter(f => 
            f.properties.kind === 'unpassable' || f.properties.kind === 'blocked'
        );
        
        for (const feature of unpassableFeatures) {
            if (feature.geometry.type === 'Polygon') {
                if (pointInPolygon([x, y], feature.geometry.coordinates[0])) {
                    return Infinity; // Unpassable
                }
            }
        }
        
        // Check for different terrain types (matching what's available in DM mode)
        const difficultFeatures = bridge.state.terrain.features.filter(f => 
            ['difficult', 'forest'].includes(f.properties.kind)
        );
        
        for (const feature of difficultFeatures) {
            if (feature.geometry.type === 'Polygon') {
                if (pointInPolygon([x, y], feature.geometry.coordinates[0])) {
                    // Map terrain types to costs
                    const kind = feature.properties.kind;
                    return TERRAIN_COSTS[kind] || TERRAIN_COSTS.difficult;
                }
            }
        }
        
        // Default to normal terrain (open areas)
        return TERRAIN_COSTS.normal;
    }

    /**
     * Calculate terrain cost between two points based on terrain features
     * Used for bridge connections between graph layers
     */
    function getTerrainCostBetweenPoints(from, to) {
        // Check if path crosses unpassable/blocked areas
        const unpassableFeatures = bridge.state.terrain.features.filter(f => 
            f.properties.kind === 'unpassable' || f.properties.kind === 'blocked'
        );
        
        for (const feature of unpassableFeatures) {
            if (feature.geometry.type === 'Polygon') {
                // Simple line-polygon intersection check
                if (lineIntersectsPolygon([from.x, from.y], [to.x, to.y], feature.geometry.coordinates[0])) {
                    return Infinity; // Unpassable
                }
            }
        }
        
        // Check for difficult terrain (increases cost)
        const difficultFeatures = bridge.state.terrain.features.filter(f => 
            ['difficult', 'forest'].includes(f.properties.kind)
        );
        
        for (const feature of difficultFeatures) {
            if (feature.geometry.type === 'Polygon') {
                // If path goes through difficult terrain, increase cost
                if (lineIntersectsPolygon([from.x, from.y], [to.x, to.y], feature.geometry.coordinates[0])) {
                    const kind = feature.properties.kind;
                    return TERRAIN_COSTS[kind] || TERRAIN_COSTS.difficult;
                }
            }
        }
        
        // Default terrain cost
        return TERRAIN_COSTS.normal;
    }

    /**
     * Check if point is inside polygon using ray casting algorithm
     */
    function pointInPolygon(point, polygon) {
        const [x, y] = point;
        let inside = false;
        
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const [xi, yi] = polygon[i];
            const [xj, yj] = polygon[j];
            
            if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
                inside = !inside;
            }
        }
        
        return inside;
    }

    /**
     * Simple line-polygon intersection test
     * Checks if a line segment intersects any edge of a polygon
     */
    function lineIntersectsPolygon(lineStart, lineEnd, polygon) {
        // Check if line intersects any edge of the polygon
        for (let i = 0; i < polygon.length - 1; i++) {
            if (linesIntersect(
                lineStart, lineEnd,
                polygon[i], polygon[i + 1]
            )) {
                return true;
            }
        }
        return false;
    }

    /**
     * Check if two line segments intersect
     * Uses parametric line intersection formula
     */
    function linesIntersect(line1Start, line1End, line2Start, line2End) {
        const x1 = line1Start[0], y1 = line1Start[1];
        const x2 = line1End[0], y2 = line1End[1];
        const x3 = line2Start[0], y3 = line2Start[1];
        const x4 = line2End[0], y4 = line2End[1];

        const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
        if (denom === 0) return false; // Lines are parallel

        const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
        const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;

        return t >= 0 && t <= 1 && u >= 0 && u <= 1;
    }

    /**
     * Compute direct distance between two points in kilometers
     */
    function computeDirectKm(a, b, kmPerPixel) {
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const distPx = Math.sqrt(dx * dx + dy * dy);
        return distPx * kmPerPixel;
    }

    // Expose module functions
    window.__nimea_terrain_utils = {
        initTerrainUtils,
        getTerrainCostAtPoint,
        getTerrainCostBetweenPoints,
        pointInPolygon,
        lineIntersectsPolygon,
        linesIntersect,
        computeDirectKm
    };

})(window);